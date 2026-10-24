//! JSON form of a postflop spot (`openrange.spot/1`), used by the CLI, the WASM API and
//! golden files. Amounts are in big blinds; percentages are of the pot.
//!
//! ```json
//! {
//!   "board": "Qs Jh 7d 4c 2s",
//!   "pot": 10, "stack": 90,
//!   "ranges": { "oop": "22+, A2s+", "ip": "QQ+, AK" },
//!   "sizes": {
//!     "default": { "oop": { "bet": "33, 75", "raise": "100" }, "ip": { "bet": "33, 75", "raise": "100" } },
//!     "river":   { "oop": { "bet": "75, a", "raise": "" },    "ip": { "bet": "50", "raise": "100" } }
//!   },
//!   "maxRaises": 2, "allInThreshold": 0.67,
//!   "rake": { "percent": 5, "capBb": 3 }
//! }
//! ```

use super::game::SpotConfig;
use super::tree::{BB, BetSizes, Rake, Size, Street, StreetSizes, TreeConfig};
use crate::cards::parse_cards;
use crate::range::Range;
use serde_json::{Value, json};

fn bb_to_chips(x: f64) -> i64 {
    (x * BB as f64).round() as i64
}

fn sizes_of(v: &Value, what: &str) -> Result<BetSizes, String> {
    let list = |k: &str| -> Result<Vec<Size>, String> {
        match v.get(k) {
            None | Some(Value::Null) => Ok(Vec::new()),
            Some(Value::String(s)) => Size::parse_list(s).map_err(|e| format!("{what} {k}: {e}")),
            Some(_) => Err(format!("{what} {k}: expected text like \"33, 75, a\"")),
        }
    };
    Ok(BetSizes {
        bet: list("bet")?,
        raise: list("raise")?,
    })
}

fn street_sizes(v: &Value, name: &str) -> Result<StreetSizes, String> {
    Ok(StreetSizes {
        oop: sizes_of(v.get("oop").unwrap_or(&Value::Null), &format!("{name} OOP"))?,
        ip: sizes_of(v.get("ip").unwrap_or(&Value::Null), &format!("{name} IP"))?,
    })
}

/// `maxRaises` is either one number for every street or `{ "flop": 1, "turn": 1, "river": 2 }`.
fn max_raises(v: Option<&Value>) -> Result<[u8; 3], String> {
    let clamp = |x: u64| x.min(10) as u8;
    match v {
        None | Some(Value::Null) => Ok([3; 3]),
        Some(Value::Number(n)) => {
            Ok([clamp(n.as_u64().ok_or("maxRaises must be a whole number")?); 3])
        }
        Some(Value::Object(o)) => {
            let mut out = [3u8; 3];
            for (i, k) in ["flop", "turn", "river"].iter().enumerate() {
                if let Some(x) = o.get(*k) {
                    out[i] = clamp(x.as_u64().ok_or("maxRaises values must be whole numbers")?);
                }
            }
            Ok(out)
        }
        Some(_) => Err("maxRaises must be a number or an object with flop/turn/river".into()),
    }
}

pub fn spot_from_json(v: &Value) -> Result<SpotConfig, String> {
    let board_text = v
        .get("board")
        .and_then(Value::as_str)
        .ok_or("missing board")?;
    let board =
        parse_cards(board_text).ok_or_else(|| format!("can't read the board \"{board_text}\""))?;
    let street =
        Street::from_board_len(board.len()).ok_or("the board must have 3, 4 or 5 cards")?;
    let num = |k: &str| v.get(k).and_then(Value::as_f64);
    let pot = num("pot").ok_or("missing pot (in big blinds)")?;
    let stack = num("stack").ok_or("missing stack (in big blinds)")?;
    if !pot.is_finite() || !stack.is_finite() || pot <= 0.0 || stack < 0.0 {
        return Err("pot must be positive and stack non-negative".into());
    }
    let ranges = v.get("ranges").ok_or("missing ranges")?;
    let range = |k: &str| -> Result<Range, String> {
        let text = ranges
            .get(k)
            .and_then(Value::as_str)
            .ok_or_else(|| format!("missing {k} range"))?;
        Range::parse(text).map_err(|e| format!("{} range: {e}", k.to_uppercase()))
    };
    let sizes_v = v.get("sizes").cloned().unwrap_or(json!({}));
    let default = sizes_v.get("default").cloned().unwrap_or(json!({}));
    let mut sizes: [StreetSizes; 3] = Default::default();
    for (i, name) in ["flop", "turn", "river"].iter().enumerate() {
        sizes[i] = street_sizes(sizes_v.get(*name).unwrap_or(&default), name)?;
    }
    let rake = match v.get("rake") {
        Some(r) if !r.is_null() => Rake {
            fraction: r.get("percent").and_then(Value::as_f64).unwrap_or(0.0) / 100.0,
            cap: bb_to_chips(r.get("capBb").and_then(Value::as_f64).unwrap_or(0.0)),
        },
        _ => Rake::default(),
    };
    if !(0.0..=0.25).contains(&rake.fraction) {
        return Err("rake must be between 0% and 25%".into());
    }
    Ok(SpotConfig {
        tree: TreeConfig {
            street,
            pot: bb_to_chips(pot),
            stack: bb_to_chips(stack),
            sizes,
            max_raises: max_raises(v.get("maxRaises"))?,
            allin_threshold: num("allInThreshold").unwrap_or(0.67),
            rake,
        },
        board,
        ranges: [range("oop")?, range("ip")?],
    })
}

fn sizes_text(s: &[Size]) -> String {
    s.iter()
        .map(|x| match x {
            Size::Pot(f) => format!("{}", (f * 100.0 * 1e6).round() / 1e6),
            Size::AllIn => "a".into(),
        })
        .collect::<Vec<_>>()
        .join(", ")
}

pub fn spot_to_json(cfg: &SpotConfig) -> Value {
    let t = &cfg.tree;
    let street = |s: &StreetSizes| {
        json!({
            "oop": { "bet": sizes_text(&s.oop.bet), "raise": sizes_text(&s.oop.raise) },
            "ip": { "bet": sizes_text(&s.ip.bet), "raise": sizes_text(&s.ip.raise) },
        })
    };
    json!({
        "schema": "openrange.spot/1",
        "board": cfg.board.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(" "),
        "pot": t.pot as f64 / BB as f64,
        "stack": t.stack as f64 / BB as f64,
        "ranges": { "oop": cfg.ranges[0].to_string(), "ip": cfg.ranges[1].to_string() },
        "sizes": { "flop": street(&t.sizes[0]), "turn": street(&t.sizes[1]), "river": street(&t.sizes[2]) },
        "maxRaises": { "flop": t.max_raises[0], "turn": t.max_raises[1], "river": t.max_raises[2] },
        "allInThreshold": t.allin_threshold,
        "rake": { "percent": t.rake.fraction * 100.0, "capBb": t.rake.cap as f64 / BB as f64 },
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip() {
        let v = json!({
            "board": "Qs Jh 7d 4c 2s", "pot": 10, "stack": 90.5,
            "ranges": { "oop": "22+, A2s+", "ip": "QQ+, AK" },
            "sizes": { "default": { "oop": { "bet": "33, 75", "raise": "100" }, "ip": { "bet": "50, a" } } },
            "maxRaises": 2, "rake": { "percent": 5, "capBb": 3 }
        });
        let cfg = spot_from_json(&v).unwrap();
        assert_eq!(cfg.tree.pot, 1000);
        assert_eq!(cfg.tree.stack, 9050);
        assert_eq!(cfg.tree.rake.cap, 300);
        assert_eq!(cfg.tree.sizes[2].ip.bet, vec![Size::Pot(0.5), Size::AllIn]);
        let back = spot_from_json(&spot_to_json(&cfg)).unwrap();
        assert_eq!(back.tree, cfg.tree);
        assert_eq!(back.board, cfg.board);
        assert_eq!(back.ranges[0], cfg.ranges[0]);
    }

    #[test]
    fn readable_errors() {
        let e = spot_from_json(&json!({ "board": "Qs Jh", "pot": 10, "stack": 90 })).unwrap_err();
        assert!(e.contains("3, 4 or 5"), "{e}");
        let e = spot_from_json(&json!({ "board": "Qs Jh 7d", "pot": 10, "stack": 90, "ranges": { "oop": "ZZ", "ip": "AA" } }))
            .unwrap_err();
        assert!(e.contains("OOP range"), "{e}");
    }
}
