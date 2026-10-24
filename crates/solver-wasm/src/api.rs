//! JSON request handling behind the wasm-bindgen exports.

use serde_json::{Value, json};
use solver_core::cards::{CardSet, parse_cards};
use solver_core::equity::{exact_cost, exact_range_vs_range, monte_carlo};
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

#[cfg(test)]
mod tests {
    use super::*;

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
