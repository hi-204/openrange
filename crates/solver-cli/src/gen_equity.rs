//! `solver-cli gen-equity`: exact 169×169 preflop all-in equity table.
//!
//! Every pair of non-overlapping starting combos is enumerated over all C(48,5) = 1,712,304
//! boards. Pairs that differ only by a suit relabelling have identical equity, so each suit
//! class is computed once; mirrored pairs reuse the result (equity(b,a) = 1 − equity(a,b)).
//! Class-vs-class values average over all non-overlapping combo pairs, so card removal is
//! exact (e.g. AKs vs AA counts only the combos that can actually be dealt together).

use crate::provenance::{Source, provenance};
use rayon::prelude::*;
use serde_json::json;
use solver_core::cards::{COMBOS, CardSet, Combo, NUM_COMBOS};
use solver_core::equity::hand_vs_hand;
use solver_core::hands::{HandClass, NUM_CLASSES};
use solver_core::iso::canonical_combo_pair;
use std::collections::HashMap;
use std::time::Instant;

pub struct Table {
    /// equity[a][b] = equity of class a against class b (ties split).
    pub equity: Vec<Vec<f64>>,
    pub tie: Vec<Vec<f64>>,
    /// Number of non-overlapping combo pairs behind each cell.
    pub pairs: Vec<Vec<u32>>,
    pub suit_classes: usize,
}

pub fn compute(progress: bool) -> Table {
    // 1. One representative per suit class of unordered combo pairs.
    let mut keys: HashMap<(u16, u16), usize> = HashMap::new();
    let mut reps: Vec<(u16, u16)> = Vec::new();
    // For every ordered pair (a, b): which rep, and whether it is stored reversed.
    let mut lookup: Vec<(u32, bool)> = vec![(u32::MAX, false); NUM_COMBOS * NUM_COMBOS];
    for a in 0..NUM_COMBOS {
        for b in (a + 1)..NUM_COMBOS {
            let (ca, cb) = (COMBOS[a], COMBOS[b]);
            if ca.cards().intersects(cb.cards()) {
                continue;
            }
            let (fwd, rev) = (canonical_combo_pair(ca, cb), canonical_combo_pair(cb, ca));
            let (key, reversed) = if fwd <= rev {
                (fwd, false)
            } else {
                (rev, true)
            };
            let id = *keys.entry(key).or_insert_with(|| {
                reps.push(key);
                reps.len() - 1
            });
            lookup[a * NUM_COMBOS + b] = (id as u32, reversed);
            lookup[b * NUM_COMBOS + a] = (id as u32, !reversed);
        }
    }
    if progress {
        eprintln!(
            "gen-equity: {} suit classes of combo pairs to enumerate",
            reps.len()
        );
    }

    // 2. Exact enumeration per representative, in parallel. `collect` keeps input order,
    //    so the result does not depend on thread scheduling.
    let start = Instant::now();
    let done = std::sync::atomic::AtomicUsize::new(0);
    let results: Vec<(f64, f64)> = reps
        .par_iter()
        .map(|&(x, y)| {
            let r = hand_vs_hand(
                Combo::from_index(x as usize),
                Combo::from_index(y as usize),
                &[],
                CardSet::EMPTY,
            )
            .expect("disjoint combos");
            let n = done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
            if progress && n.is_multiple_of(5000) {
                eprintln!(
                    "gen-equity: {n}/{} ({:.0}s)",
                    reps.len(),
                    start.elapsed().as_secs_f64()
                );
            }
            (r.equity(), r.tie)
        })
        .collect();

    // 3. Aggregate to classes.
    let mut eq_sum = vec![vec![0f64; NUM_CLASSES]; NUM_CLASSES];
    let mut tie_sum = vec![vec![0f64; NUM_CLASSES]; NUM_CLASSES];
    let mut pairs = vec![vec![0u32; NUM_CLASSES]; NUM_CLASSES];
    for a in 0..NUM_COMBOS {
        let ca = HandClass::of(COMBOS[a]).index();
        for b in 0..NUM_COMBOS {
            let (id, reversed) = lookup[a * NUM_COMBOS + b];
            if id == u32::MAX {
                continue;
            }
            let (eq, tie) = results[id as usize];
            let cb = HandClass::of(COMBOS[b]).index();
            eq_sum[ca][cb] += if reversed { 1.0 - eq } else { eq };
            tie_sum[ca][cb] += tie;
            pairs[ca][cb] += 1;
        }
    }
    let avg = |sum: &Vec<Vec<f64>>| -> Vec<Vec<f64>> {
        (0..NUM_CLASSES)
            .map(|a| {
                (0..NUM_CLASSES)
                    .map(|b| sum[a][b] / pairs[a][b] as f64)
                    .collect()
            })
            .collect()
    };
    Table {
        equity: avg(&eq_sum),
        tie: avg(&tie_sum),
        pairs,
        suit_classes: reps.len(),
    }
}

/// Equity of class `a` against a uniformly random hand (all non-overlapping combos).
pub fn vs_random(t: &Table, a: usize) -> f64 {
    let (mut num, mut den) = (0.0, 0.0);
    for b in 0..NUM_CLASSES {
        num += t.equity[a][b] * t.pairs[a][b] as f64;
        den += t.pairs[a][b] as f64;
    }
    num / den
}

fn round6(x: f64) -> f64 {
    (x * 1e6).round() / 1e6
}

pub fn run(out: &str) -> Result<(), String> {
    let start = Instant::now();
    let t = compute(true);
    let aa = HandClass::parse("AA").expect("AA").index();
    let mirrored_max_error = (0..NUM_CLASSES)
        .flat_map(|a| (0..NUM_CLASSES).map(move |b| (a, b)))
        .map(|(a, b)| (t.equity[a][b] + t.equity[b][a] - 1.0).abs())
        .fold(0.0, f64::max);
    let names: Vec<String> = HandClass::all().map(|c| c.to_string()).collect();
    let doc = json!({
        "provenance": provenance(
            Source::SolverExact,
            "solver-cli gen-equity",
            serde_json::Value::Null,
            "Exact enumeration of all 1,712,304 boards for every non-overlapping combo pair. \
             Equity counts ties as half. Values rounded to 6 decimals.",
        ),
        "classes": names,
        "layout": "13x13 grid, row-major; row/col order A..2; above diagonal suited, below offsuit",
        "equity": t.equity.iter().map(|r| r.iter().map(|&x| round6(x)).collect::<Vec<_>>()).collect::<Vec<_>>(),
        "tie": t.tie.iter().map(|r| r.iter().map(|&x| round6(x)).collect::<Vec<_>>()).collect::<Vec<_>>(),
        "pairs": t.pairs,
        "checks": {
            "suitClassesEnumerated": t.suit_classes,
            "aaVsRandom": round6(vs_random(&t, aa)),
            "mirroredMaxError": mirrored_max_error,
        },
    });
    let text = serde_json::to_string(&doc).map_err(|e| e.to_string())?;
    std::fs::write(out, format!("{text}\n")).map_err(|e| format!("writing {out}: {e}"))?;
    eprintln!(
        "gen-equity: wrote {out} in {:.0}s (AA vs random = {:.4}, mirrored max error = {mirrored_max_error:.1e})",
        start.elapsed().as_secs_f64(),
        vs_random(&t, aa)
    );
    Ok(())
}
