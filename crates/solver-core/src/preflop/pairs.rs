//! Exact preflop all-in results for every pair of non-overlapping combos.
//!
//! There are 1326 × 1225 / 2 = 812,175 unordered combo pairs, but only 47,008 differ in more
//! than suit labels. [`pair_classes`] numbers those classes deterministically;
//! `solver-cli gen-equity` enumerates the 1,712,304 boards of one representative per class
//! and stores integer win/tie counts in `data/equity/preflop-pairs.json`; [`PairEquity`]
//! expands them back to all ordered pairs.

use crate::cards::{COMBOS, NUM_COMBOS};
use crate::iso::canonical_combo_pair;
use std::collections::HashMap;

/// Boards per all-in preflop matchup: C(48, 5).
pub const BOARDS: u32 = 1_712_304;

pub struct PairClasses {
    /// Representative (hero combo, villain combo) per class, in a fixed order.
    pub reps: Vec<(u16, u16)>,
    /// For each ordered pair `a * 1326 + b`: its class, and whether (a, b) is the
    /// representative reversed (hero and villain swapped). `u32::MAX` for overlapping pairs.
    pub lookup: Vec<(u32, bool)>,
}

/// Deterministic numbering of the suit classes of combo pairs.
pub fn pair_classes() -> PairClasses {
    let mut keys: HashMap<(u16, u16), u32> = HashMap::new();
    let mut reps: Vec<(u16, u16)> = Vec::new();
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
                (reps.len() - 1) as u32
            });
            lookup[a * NUM_COMBOS + b] = (id, reversed);
            lookup[b * NUM_COMBOS + a] = (id, !reversed);
        }
    }
    PairClasses { reps, lookup }
}

/// Win/tie/lose probabilities for every ordered combo pair (hero `a` vs villain `b`).
pub struct PairEquity {
    /// `[a * 1326 + b]` → (win, tie) probabilities for `a`; overlapping pairs are (0, 0).
    wt: Vec<(f32, f32)>,
}

impl PairEquity {
    /// Build from per-class integer counts (wins and ties of the representative's hero, out
    /// of [`BOARDS`]), in [`pair_classes`] order.
    pub fn from_counts(
        classes: &PairClasses,
        wins: &[u32],
        ties: &[u32],
    ) -> Result<PairEquity, String> {
        if wins.len() != classes.reps.len() || ties.len() != classes.reps.len() {
            return Err(format!(
                "expected {} pair classes, got {}",
                classes.reps.len(),
                wins.len()
            ));
        }
        let n = BOARDS as f64;
        let mut wt = vec![(0f32, 0f32); NUM_COMBOS * NUM_COMBOS];
        for (i, &(id, reversed)) in classes.lookup.iter().enumerate() {
            if id == u32::MAX {
                continue;
            }
            let (w, t) = (wins[id as usize] as f64, ties[id as usize] as f64);
            let win = if reversed { n - w - t } else { w };
            wt[i] = ((win / n) as f32, (t / n) as f32);
        }
        Ok(PairEquity { wt })
    }

    /// (win, tie) probabilities of combo `a` against combo `b` (by combo index).
    #[inline]
    pub fn win_tie(&self, a: usize, b: usize) -> (f32, f32) {
        self.wt[a * NUM_COMBOS + b]
    }

    /// Equity (ties split) of `a` against `b`.
    #[inline]
    pub fn equity(&self, a: usize, b: usize) -> f32 {
        let (w, t) = self.win_tie(a, b);
        w + t / 2.0
    }
}

/// Load `data/equity/preflop-pairs.json` (parsed JSON), checking that its class numbering
/// matches this build.
#[cfg(feature = "json")]
pub fn pair_equity_from_json(v: &serde_json::Value) -> Result<PairEquity, String> {
    let classes = pair_classes();
    let reps = v["reps"].as_array().ok_or("pairs file: no reps")?;
    if reps.len() != classes.reps.len() {
        return Err("pairs file: wrong number of classes".into());
    }
    for (r, &(a, b)) in reps.iter().zip(&classes.reps) {
        if r[0].as_u64() != Some(a as u64) || r[1].as_u64() != Some(b as u64) {
            return Err(
                "pairs file: class numbering differs from this build; regenerate it".into(),
            );
        }
    }
    let nums = |k: &str| -> Result<Vec<u32>, String> {
        v[k].as_array()
            .ok_or(format!("pairs file: no {k}"))?
            .iter()
            .map(|x| {
                x.as_u64()
                    .map(|x| x as u32)
                    .ok_or_else(|| "pairs file: bad number".to_string())
            })
            .collect()
    };
    PairEquity::from_counts(&classes, &nums("wins")?, &nums("ties")?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::{CardSet, Combo};
    use crate::equity::hand_vs_hand;

    #[test]
    fn there_are_47008_suit_classes() {
        // Matches the count the generator reports (and the committed data file).
        assert_eq!(pair_classes().reps.len(), 47_008);
    }

    #[test]
    fn expansion_is_consistent_with_direct_enumeration() {
        // Build counts for a handful of classes directly and check the expanded lookup for
        // pairs that map to them (both orientations).
        let classes = pair_classes();
        let probe: Vec<usize> = vec![0, 1, 100, 20_000, 47_007];
        let mut wins = vec![0u32; classes.reps.len()];
        let mut ties = vec![0u32; classes.reps.len()];
        for &id in &probe {
            let (x, y) = classes.reps[id];
            let r = hand_vs_hand(
                Combo::from_index(x as usize),
                Combo::from_index(y as usize),
                &[],
                CardSet::EMPTY,
            )
            .unwrap();
            wins[id] = (r.win * BOARDS as f64).round() as u32;
            ties[id] = (r.tie * BOARDS as f64).round() as u32;
        }
        let pe = PairEquity::from_counts(&classes, &wins, &ties).unwrap();
        let mut checked = 0;
        for (i, &(id, _)) in classes.lookup.iter().enumerate() {
            if id == u32::MAX || !probe.contains(&(id as usize)) || checked > 40 {
                continue;
            }
            let (a, b) = (i / NUM_COMBOS, i % NUM_COMBOS);
            let direct = hand_vs_hand(
                Combo::from_index(a),
                Combo::from_index(b),
                &[],
                CardSet::EMPTY,
            )
            .unwrap();
            let (w, t) = pe.win_tie(a, b);
            assert!(
                (w as f64 - direct.win).abs() < 1e-6 && (t as f64 - direct.tie).abs() < 1e-6,
                "{a} {b}"
            );
            checked += 1;
        }
        assert!(checked > 10);
    }
}
