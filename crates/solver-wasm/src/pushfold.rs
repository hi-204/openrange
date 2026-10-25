//! Exact heads-up push/fold (chip EV or ICM) for the browser. The combo-pair equities are
//! loaded once from `data/equity/preflop-pairs.json` and kept for the session.

use serde_json::{Value, json};
use solver_core::cards::COMBOS;
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
