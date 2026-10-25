//! Exact heads-up push/fold (chip EV or ICM) for the browser. The combo-pair equities are
//! loaded once from `data/equity/preflop-pairs.json` and kept for the session.

use serde_json::{Value, json};
use solver_core::cards::{COMBOS, Combo};
use solver_core::hands::{HandClass, NUM_CLASSES};
use solver_core::preflop::pairs::{PairEquity, pair_equity_from_json};
use solver_core::preflop::pushfold::{PushFoldSpot, hu_spot, solve};
use std::cell::RefCell;

thread_local! {
    static PAIRS: RefCell<Option<PairEquity>> = const { RefCell::new(None) };
}

pub fn load_pairs(json_text: &str) -> Result<Value, String> {
    let v: Value = serde_json::from_str(json_text).map_err(|e| format!("bad pairs file: {e}"))?;
    let pe = pair_equity_from_json(&v)?;
    PAIRS.with(|p| *p.borrow_mut() = Some(pe));
    Ok(json!({ "loaded": true }))
}

pub fn pairs_loaded() -> bool {
    PAIRS.with(|p| p.borrow().is_some())
}

fn per_class(per_combo: &[f64]) -> Vec<Value> {
    HandClass::all()
        .map(|c| {
            let vals: Vec<f64> = c
                .combos()
                .iter()
                .map(|x| per_combo[x.index()])
                .filter(|x| x.is_finite())
                .collect();
            if vals.is_empty() {
                Value::Null
            } else {
                json!(vals.iter().sum::<f64>() / vals.len() as f64)
            }
        })
        .collect()
}

/// Spot: `{stacks: [bb...], pusher, caller, ante, payouts: [prize...]}` (empty payouts =
/// chip EV). Returns per-class shove/call frequencies and EVs (bb for chip EV, prize units
/// for ICM) and the exploitability reached.
pub fn solve_spot(spot_json: &str) -> Result<Value, String> {
    let v: Value = serde_json::from_str(spot_json).map_err(|e| format!("bad spot: {e}"))?;
    let nums = |k: &str| -> Vec<f64> {
        v[k].as_array()
            .map(|a| a.iter().filter_map(Value::as_f64).collect())
            .unwrap_or_default()
    };
    let spot = PushFoldSpot {
        stacks: nums("stacks"),
        pusher: v["pusher"].as_u64().ok_or("missing pusher")? as usize,
        caller: v["caller"].as_u64().ok_or("missing caller")? as usize,
        small_blind: 0.5,
        big_blind: 1.0,
        ante: v["ante"].as_f64().unwrap_or(0.0),
        payouts: nums("payouts"),
    };
    if spot.stacks.len() > 9 {
        return Err("at most 9 players".into());
    }
    if spot.payouts.iter().any(|&x| x < 0.0) {
        return Err("payouts can't be negative".into());
    }
    let p = spot.payoffs()?;
    let scale = [p.fold, p.steal, p.win, p.tie, p.lose]
        .iter()
        .flatten()
        .fold(0.0f64, |m, x| m.max(x.abs()))
        .max(1e-9);
    PAIRS.with(|cell| {
        let pairs = cell.borrow();
        let eq = pairs.as_ref().ok_or("preflop equities are not loaded")?;
        let game = hu_spot(&spot, eq)?;
        // Chip EV: the same target as the committed charts (1e-6 bb), so results match them.
        // ICM: a millionth of the largest payoff (prize units).
        let target = if spot.payouts.is_empty() { 1e-6 } else { 1e-6 * scale };
        let (solver, report) = solve(game, target, 4_000, 50);
        let (x, y) = (solver.average(0), solver.average(1));
        let vals = solver.values(&x, &y);
        let n = COMBOS.len();
        let div = |a: &[f64], m: &[f64]| -> Vec<f64> { (0..n).map(|i| if m[i] > 0.0 { a[i] / m[i] } else { f64::NAN }).collect() };
        let class_freq = |f: &[f64]| -> Vec<f64> {
            HandClass::all().map(|c| c.combos().iter().map(|x| f[x.index()]).sum::<f64>() / c.num_combos() as f64).collect()
        };
        let (xs, ys) = (class_freq(&x), class_freq(&y));
        Ok(json!({
            "units": if spot.payouts.is_empty() { "bb" } else { "prize" },
            "iterations": solver.iterations(),
            "exploitability": report.exploitability,
            "value": report.value,
            "classes": HandClass::all().map(|c| c.to_string()).collect::<Vec<_>>(),
            "pusher": {
                "actions": ["Fold", "All-in"],
                "strategy": (0..NUM_CLASSES).map(|c| [1.0 - xs[c], xs[c]]).collect::<Vec<_>>(),
                "ev": per_class(&div(&vals.fold, &vals.pusher_mass)).into_iter().zip(per_class(&div(&vals.shove, &vals.pusher_mass))).map(|(a, b)| json!([a, b])).collect::<Vec<_>>(),
            },
            "caller": {
                "actions": ["Fold", "Call"],
                "strategy": (0..NUM_CLASSES).map(|c| [1.0 - ys[c], ys[c]]).collect::<Vec<_>>(),
                "ev": per_class(&div(&vals.pass, &vals.caller_mass)).into_iter().zip(per_class(&div(&vals.call, &vals.caller_mass))).map(|(a, b)| json!([a, b])).collect::<Vec<_>>(),
            },
        }))
    })
}

/// `{hero: "AhKd" | "AKo", villain: [169 class weights]}`. The villain holds a uniformly
/// random combo that doesn't share a card with the hero's and continues (shoves, calls…) with
/// it at its class weight. For each hero combo: `share` = probability the villain continues,
/// `equity` = hero's all-in equity against the hands that continue (exact, from the
/// combo-pair table). Used by the trainer's explanations.
pub fn matchup(json_text: &str) -> Result<Value, String> {
    let v: Value = serde_json::from_str(json_text).map_err(|e| format!("bad matchup: {e}"))?;
    let hero = v["hero"].as_str().ok_or("missing hero")?;
    let combos: Vec<Combo> = match Combo::parse(hero) {
        Some(c) => vec![c],
        None => HandClass::parse(hero)
            .ok_or_else(|| format!("'{hero}' is neither a combo nor a hand class"))?
            .combos(),
    };
    let weights: Vec<f64> = v["villain"]
        .as_array()
        .ok_or("missing villain weights")?
        .iter()
        .map(|x| x.as_f64().ok_or("villain weights must be numbers"))
        .collect::<Result<_, _>>()?;
    if weights.len() != NUM_CLASSES {
        return Err(format!("villain needs {NUM_CLASSES} class weights"));
    }
    let class_of: Vec<usize> = COMBOS.iter().map(|c| HandClass::of(*c).index()).collect();
    PAIRS.with(|cell| {
        let pairs = cell.borrow();
        let eq = pairs.as_ref().ok_or("preflop equities are not loaded")?;
        let rows: Vec<Value> = combos
            .iter()
            .map(|h| {
                let (mut alive, mut cont, mut eq_sum) = (0f64, 0f64, 0f64);
                for (j, villain) in COMBOS.iter().enumerate() {
                    if villain.cards().intersects(h.cards()) {
                        continue;
                    }
                    alive += 1.0;
                    let w = weights[class_of[j]];
                    cont += w;
                    eq_sum += w * eq.equity(h.index(), j) as f64;
                }
                json!({
                    "combo": h.to_string(),
                    "share": cont / alive,
                    "equity": if cont > 0.0 { Value::from(eq_sum / cont) } else { Value::Null },
                })
            })
            .collect();
        Ok(json!({ "combos": rows }))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn load() {
        let path = concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../../data/equity/preflop-pairs.json"
        );
        load_pairs(&std::fs::read_to_string(path).unwrap()).unwrap();
    }

    fn weights(classes: &[&str]) -> Vec<f64> {
        let mut w = vec![0.0; NUM_CLASSES];
        for c in classes {
            w[HandClass::parse(c).unwrap().index()] = 1.0;
        }
        w
    }

    #[test]
    fn matchup_has_exact_card_removal() {
        load();
        // AhAd vs a villain who continues only with AA: one combo (AcAs) survives out of 1225.
        let r =
            matchup(&json!({ "hero": "AhAd", "villain": weights(&["AA"]) }).to_string()).unwrap();
        let row = &r["combos"][0];
        assert!((row["share"].as_f64().unwrap() - 1.0 / 1225.0).abs() < 1e-12);
        assert!((row["equity"].as_f64().unwrap() - 0.5).abs() < 0.03);
        // A class expands to its combos; AKs vs KK: the hero holds one K, 3 KK combos remain.
        let r =
            matchup(&json!({ "hero": "AKs", "villain": weights(&["KK"]) }).to_string()).unwrap();
        let rows = r["combos"].as_array().unwrap();
        assert_eq!(rows.len(), 4);
        for row in rows {
            assert!((row["share"].as_f64().unwrap() - 3.0 / 1225.0).abs() < 1e-12);
            let e = row["equity"].as_f64().unwrap();
            assert!(e > 0.25 && e < 0.40, "AKs vs KK equity {e}");
        }
        // Villain never continues: no equity to report.
        let r = matchup(&json!({ "hero": "72o", "villain": vec![0.0; NUM_CLASSES] }).to_string())
            .unwrap();
        assert!(r["combos"][0]["equity"].is_null());
        assert!(
            matchup(&json!({ "hero": "XX", "villain": vec![0.0; NUM_CLASSES] }).to_string())
                .is_err()
        );
    }
}
