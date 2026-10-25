//! JSON request handling behind the wasm-bindgen exports.

use serde_json::{Value, json};
use solver_core::cards::{CardSet, parse_cards};
use solver_core::equity::{exact_cost, exact_range_vs_range, monte_carlo};
use solver_core::eval::Evaluator;
use solver_core::range::Range;

/// Above this many hand evaluations, "auto" mode switches from exact enumeration to
/// Monte Carlo (about half a second of work in the browser).
const EXACT_BUDGET: f64 = 3.0e7;
const DEFAULT_SAMPLES: u64 = 200_000;
const MAX_SAMPLES: u64 = 5_000_000;
const MAX_PLAYERS: usize = 6;

fn err(msg: impl std::fmt::Display) -> Value {
    json!({ "ok": false, "error": msg.to_string() })
}

pub fn parse_range(text: &str) -> Value {
    match Range::parse(text) {
        Ok(r) => json!({
            "ok": true,
            "canonical": r.to_string(),
            "combos": r.combo_count(),
            "weights": r.weights().to_vec(),
        }),
        Err(e) => err(e),
    }
}

fn cards_field(req: &Value, name: &str) -> Result<Vec<solver_core::cards::Card>, String> {
    let text = req.get(name).and_then(Value::as_str).unwrap_or("");
    parse_cards(text)
        .ok_or_else(|| format!("can't read the {name} cards \"{text}\" (use e.g. AsKd7h)"))
}

pub fn equity(request_json: &str) -> Value {
    match equity_inner(request_json) {
        Ok(v) => v,
        Err(e) => err(e),
    }
}

fn equity_inner(request_json: &str) -> Result<Value, String> {
    let req: Value = serde_json::from_str(request_json).map_err(|e| format!("bad request: {e}"))?;
    let texts = req
        .get("ranges")
        .and_then(Value::as_array)
        .ok_or("missing ranges")?;
    if texts.len() < 2 || texts.len() > MAX_PLAYERS {
        return Err(format!("choose between 2 and {MAX_PLAYERS} players"));
    }
    let mut ranges = Vec::new();
    for (i, t) in texts.iter().enumerate() {
        let text = t.as_str().unwrap_or("");
        let r = Range::parse(text).map_err(|e| format!("player {}: {e}", i + 1))?;
        if r.combo_count() == 0.0 {
            return Err(format!("player {}: the range is empty", i + 1));
        }
        ranges.push(r);
    }
    let board = cards_field(&req, "board")?;
    let dead_cards = cards_field(&req, "dead")?;
    let dead = CardSet::from_cards(&dead_cards);
    let mode = req.get("mode").and_then(Value::as_str).unwrap_or("auto");
    let samples = req
        .get("samples")
        .and_then(Value::as_u64)
        .unwrap_or(DEFAULT_SAMPLES)
        .clamp(1_000, MAX_SAMPLES);
    let seed = req.get("seed").and_then(Value::as_u64).unwrap_or(1);

    let exact = match mode {
        "exact" if ranges.len() == 2 => true,
        "exact" => {
            return Err("exact enumeration supports two players; use Monte Carlo for more".into());
        }
        "montecarlo" => false,
        "auto" => {
            ranges.len() == 2 && exact_cost(&ranges[0], &ranges[1], &board, dead) <= EXACT_BUDGET
        }
        other => return Err(format!("unknown mode {other}")),
    };

    if exact {
        let hero = exact_range_vs_range(&ranges[0], &ranges[1], &board, dead)
            .map_err(|e| e.to_string())?;
        let villain = exact_range_vs_range(&ranges[1], &ranges[0], &board, dead)
            .map_err(|e| e.to_string())?;
        let per_combo = |r: &solver_core::equity::RangeVsRange| -> Vec<Value> {
            r.per_combo.iter().map(|c| json!({ "combo": c.combo.to_string(), "weight": c.weight, "equity": c.equity })).collect()
        };
        Ok(json!({
            "ok": true,
            "method": "exact",
            "runouts": hero.runouts,
            "players": [
                { "equity": hero.equity, "tie": hero.tie, "perCombo": per_combo(&hero) },
                { "equity": villain.equity, "tie": villain.tie, "perCombo": per_combo(&villain) },
            ],
        }))
    } else {
        let mc = monte_carlo(&ranges, &board, dead, samples, seed).map_err(|e| e.to_string())?;
        let players: Vec<Value> = (0..ranges.len())
            .map(|p| json!({ "equity": mc.equity[p], "win": mc.win[p], "tie": mc.tie[p], "stdError": mc.std_error[p] }))
            .collect();
        Ok(
            json!({ "ok": true, "method": "montecarlo", "samples": mc.samples, "seed": seed, "players": players }),
        )
    }
}

/// Evaluate 5 to 7 cards ("AsKd7h2c9s…"): category, a strength that compares hands (higher
/// wins, equal ties) and the best five cards. Used by the lesson widgets.
pub fn evaluate(cards_text: &str) -> Value {
    let Some(cards) = parse_cards(cards_text) else {
        return err(format!(
            "can't read the cards \"{cards_text}\" (use e.g. AsKd7h2c9s)"
        ));
    };
    if !(5..=7).contains(&cards.len()) {
        return err("give 5, 6 or 7 cards");
    }
    if CardSet::from_cards(&cards).len() as usize != cards.len() {
        return err("a card appears twice");
    }
    let ev = Evaluator::get();
    let strength = ev.eval(&cards);
    // The best five: the first 5-card subset that is as strong as the whole hand.
    let n = cards.len();
    let mut best = Vec::new();
    'search: for a in 0..n {
        for b in a + 1..n {
            for c in b + 1..n {
                for d in c + 1..n {
                    for e in d + 1..n {
                        let five = [cards[a], cards[b], cards[c], cards[d], cards[e]];
                        if ev.eval(&five) == strength {
                            best = five.to_vec();
                            break 'search;
                        }
                    }
                }
            }
        }
    }
    json!({
        "ok": true,
        "strength": strength.0,
        "category": strength.category().name(),
        "categoryIndex": strength.category() as u8,
        "best": best.iter().map(|c| c.to_string()).collect::<Vec<_>>(),
    })
}

/// Outs against a known hand: `{"hero": "AhKh", "villain": "QsQd", "board": "Qh7h2c"}` (flop
/// or turn). For every card that can come next: does the hero end up ahead, tied or behind?
/// `behindNow` compares the hands on the current board.
pub fn outs(request_json: &str) -> Value {
    let inner = || -> Result<Value, String> {
        let req: Value =
            serde_json::from_str(request_json).map_err(|e| format!("bad request: {e}"))?;
        let hero = cards_field(&req, "hero")?;
        let villain = cards_field(&req, "villain")?;
        let board = cards_field(&req, "board")?;
        if hero.len() != 2 || villain.len() != 2 || !(3..=4).contains(&board.len()) {
            return Err("give two cards each and a flop or turn board".into());
        }
        let all: Vec<_> = hero.iter().chain(&villain).chain(&board).copied().collect();
        let used = CardSet::from_cards(&all);
        if used.len() as usize != all.len() {
            return Err("a card appears twice".into());
        }
        let ev = Evaluator::get();
        let strength = |hand: &[solver_core::cards::Card],
                        extra: Option<solver_core::cards::Card>| {
            let mut cards: Vec<_> = hand.iter().chain(&board).copied().collect();
            cards.extend(extra);
            ev.eval(&cards)
        };
        let (mut ahead, mut tied, mut behind) = (Vec::new(), Vec::new(), Vec::new());
        for i in 0..52u8 {
            let c = solver_core::cards::Card::from_index(i);
            if used.contains(c) {
                continue;
            }
            let (h, v) = (strength(&hero, Some(c)), strength(&villain, Some(c)));
            let bucket = if h > v {
                &mut ahead
            } else if h == v {
                &mut tied
            } else {
                &mut behind
            };
            bucket.push(c.to_string());
        }
        Ok(json!({
            "ok": true,
            "behindNow": strength(&hero, None) < strength(&villain, None),
            "tiedNow": strength(&hero, None) == strength(&villain, None),
            "ahead": ahead, "tied": tied, "behind": behind,
        }))
    };
    inner().unwrap_or_else(err)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn outs_against_a_known_hand() {
        // Nut flush draw against a set on Qh 7h 2c: 9 hearts are left, but 2h pairs the board
        // and gives QsQd a full house, so 8 hearts (and nothing else) put AhKh ahead.
        let r = outs(r#"{"hero": "AhKh", "villain": "QsQd", "board": "Qh7h2c"}"#);
        assert_eq!(r["ok"], true, "{r}");
        assert_eq!(r["behindNow"], true);
        let ahead: Vec<String> = serde_json::from_value(r["ahead"].clone()).unwrap();
        let mut hearts: Vec<&str> = ahead
            .iter()
            .map(String::as_str)
            .filter(|c| c.ends_with('h'))
            .collect();
        hearts.sort();
        assert_eq!(hearts, vec!["3h", "4h", "5h", "6h", "8h", "9h", "Jh", "Th"]);
        assert!(
            ahead.iter().all(|c| c.ends_with('h')),
            "only hearts help: {ahead:?}"
        );
        let n = ahead.len()
            + r["tied"].as_array().unwrap().len()
            + r["behind"].as_array().unwrap().len();
        assert_eq!(n, 45);
        assert_eq!(
            outs(r#"{"hero": "AhKh", "villain": "AhQd", "board": "Qh7h2c"}"#)["ok"],
            false
        );
    }

    #[test]
    fn evaluate_finds_category_strength_and_best_five() {
        let flush = evaluate("AhKh7h2h9hQsQd");
        assert_eq!(flush["category"], "flush");
        let best: Vec<String> = serde_json::from_value(flush["best"].clone()).unwrap();
        assert_eq!(best.len(), 5);
        assert!(best.iter().all(|c| c.ends_with('h')), "{best:?}");
        // The board plays: both hands use the same five cards and tie.
        let a = evaluate("2c3dAsKsQsJsTs");
        let b = evaluate("4c5dAsKsQsJsTs");
        assert_eq!(a["category"], "straight flush");
        assert_eq!(a["strength"], b["strength"]);
        // A kicker decides.
        let ak = evaluate("AhKdAs7c2d");
        let aq = evaluate("AhQdAs7c2d");
        assert!(ak["strength"].as_u64() > aq["strength"].as_u64());
        assert_eq!(evaluate("AhKd")["ok"], false);
        assert_eq!(evaluate("AhAhKd7c2d")["ok"], false);
    }

    #[test]
    fn parse_range_reports_canonical_form_and_errors() {
        let v = parse_range("AA,KK,QQ");
        assert_eq!(v["canonical"], "QQ+");
        assert_eq!(v["combos"], 18.0);
        assert_eq!(v["weights"].as_array().unwrap().len(), 1326);
        assert_eq!(parse_range("AX")["ok"], false);
    }

    #[test]
    fn auto_mode_picks_exact_for_small_two_way_spots() {
        let v = equity(r#"{"ranges":["AA","KK"],"board":"2c7d9h","dead":""}"#);
        assert_eq!(v["method"], "exact", "{v}");
        let a = v["players"][0]["equity"].as_f64().unwrap();
        let b = v["players"][1]["equity"].as_f64().unwrap();
        assert!((a + b - 1.0).abs() < 1e-12);
    }

    #[test]
    fn auto_mode_falls_back_to_monte_carlo() {
        let v = equity(r#"{"ranges":["22+","A2s+","KTo+"],"board":"","dead":"","samples":2000}"#);
        assert_eq!(v["method"], "montecarlo", "{v}");
        assert_eq!(v["players"].as_array().unwrap().len(), 3);
    }

    #[test]
    fn readable_errors() {
        assert!(
            equity(r#"{"ranges":["AA"]}"#)["error"]
                .as_str()
                .unwrap()
                .contains("between 2")
        );
        assert!(
            equity(r#"{"ranges":["AA","ZZ"]}"#)["error"]
                .as_str()
                .unwrap()
                .contains("player 2")
        );
        assert!(
            equity(r#"{"ranges":["AA","KK"],"board":"AsAs"}"#)["error"]
                .as_str()
                .unwrap()
                .contains("board")
        );
    }
}
