//! Automatic abstraction when a spot doesn't fit the memory budget.
//!
//! The ladder removes the parts of the tree that cost the most memory and (from solver
//! experience generally) matter least, one step at a time, re-estimating after each step:
//!
//! 1. River: no raises.
//! 2. Turn: no raises.
//! 3. River: one bet size per player (the middle one).
//! 4. Turn: one bet size per player (the middle one).
//! 5. Flop: at most one raise.
//! 6. Flop: one bet size per player (the middle one), no raises.
//!
//! Every step taken is reported in plain words and shown with the result; if the spot still
//! doesn't fit, the caller refuses it.

use super::game::{Options, SpotConfig, estimate_memory_with};
use super::tree::{BetSizes, Size, Street};

#[derive(Clone, Debug, PartialEq)]
pub struct Fitted {
    pub config: SpotConfig,
    /// What was simplified, in order; empty if the spot fit as given.
    pub steps: Vec<String>,
    pub bytes: usize,
}

fn middle(sizes: &[Size]) -> Vec<Size> {
    if sizes.len() <= 1 {
        sizes.to_vec()
    } else {
        vec![sizes[sizes.len() / 2]]
    }
}

fn street_name(s: usize) -> &'static str {
    ["flop", "turn", "river"][s]
}

/// One ladder step applied to `cfg`; returns a description, or None if it changes nothing.
fn apply(cfg: &mut SpotConfig, step: usize) -> Option<String> {
    let start = cfg.tree.street as usize;
    let reduce_sizes = |b: &mut BetSizes| -> bool {
        let before = b.bet.len();
        b.bet = middle(&b.bet);
        before != b.bet.len()
    };
    let (street, what) = match step {
        0 => (Street::River as usize, "raises"),
        1 => (Street::Turn as usize, "raises"),
        2 => (Street::River as usize, "sizes"),
        3 => (Street::Turn as usize, "sizes"),
        4 => (Street::Flop as usize, "one raise"),
        5 => (Street::Flop as usize, "sizes"),
        _ => return None,
    };
    if street < start {
        return None; // that street isn't part of this spot
    }
    let t = &mut cfg.tree;
    match what {
        "raises" if t.max_raises[street] > 0 => {
            t.max_raises[street] = 0;
            Some(format!("no raises on the {}", street_name(street)))
        }
        "one raise" if t.max_raises[street] > 1 => {
            t.max_raises[street] = 1;
            Some(format!("at most one raise on the {}", street_name(street)))
        }
        "sizes" => {
            let s = &mut t.sizes[street];
            let changed = reduce_sizes(&mut s.oop) | reduce_sizes(&mut s.ip);
            if street == Street::Flop as usize && t.max_raises[street] > 0 {
                t.max_raises[street] = 0;
                return Some(format!(
                    "one bet size per player and no raises on the {}",
                    street_name(street)
                ));
            }
            changed.then(|| format!("one bet size per player on the {}", street_name(street)))
        }
        _ => None,
    }
}

/// Simplify `cfg` step by step until its memory estimate fits `budget` bytes.
pub fn fit_to_budget(cfg: &SpotConfig, budget: usize, options: Options) -> Result<Fitted, String> {
    let mut config = cfg.clone();
    let mut bytes = estimate_memory_with(&config, options)?;
    let mut steps = Vec::new();
    let mut step = 0;
    while bytes > budget && step < 6 {
        if let Some(desc) = apply(&mut config, step) {
            bytes = estimate_memory_with(&config, options)?;
            steps.push(desc);
        }
        step += 1;
    }
    if bytes > budget {
        return Err(format!(
            "even after simplifying the tree ({}) this spot needs about {:.0} MB, more than the {:.0} MB budget. \
             Try narrower ranges, fewer bet sizes, a turn or river spot, or the command-line solver.",
            if steps.is_empty() {
                "nothing left to simplify".to_string()
            } else {
                steps.join("; ")
            },
            bytes as f64 / 1e6,
            budget as f64 / 1e6
        ));
    }
    Ok(Fitted {
        config,
        steps,
        bytes,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::parse_cards;
    use crate::postflop::tree::{StreetSizes, TreeConfig};
    use crate::range::Range;

    fn flop() -> SpotConfig {
        let b = |bet: &str, raise: &str| BetSizes {
            bet: Size::parse_list(bet).unwrap(),
            raise: Size::parse_list(raise).unwrap(),
        };
        let ss = StreetSizes {
            oop: b("33, 75", "100"),
            ip: b("33, 75, 150", "100"),
        };
        SpotConfig {
            tree: TreeConfig {
                street: Street::Flop,
                pot: 600,
                stack: 9700,
                sizes: [ss.clone(), ss.clone(), ss],
                max_raises: [2; 3],
                allin_threshold: 0.67,
                rake: Default::default(),
            },
            board: parse_cards("Qs Jh 4d").unwrap(),
            ranges: [
                Range::parse("22+, A2s+, KTs+, QTs+, JTs, ATo+").unwrap(),
                Range::parse("22+, A2s+, K9s+, Q9s+, J9s+, T9s, A9o+, KJo+").unwrap(),
            ],
        }
    }

    #[test]
    fn fits_as_given_when_under_budget() {
        let cfg = flop();
        let f = fit_to_budget(&cfg, usize::MAX, Options::default()).unwrap();
        assert!(f.steps.is_empty());
        assert_eq!(f.config, cfg);
    }

    #[test]
    fn each_step_shrinks_the_tree_and_is_reported() {
        let cfg = flop();
        let full = estimate_memory_with(&cfg, Options::default()).unwrap();
        let f = fit_to_budget(&cfg, full / 10, Options::default()).unwrap();
        assert!(!f.steps.is_empty());
        assert!(f.bytes <= full / 10, "{} > {}", f.bytes, full / 10);
        assert!(f.steps[0].contains("river"), "{:?}", f.steps);
        // The ladder never touches the ranges or the board.
        assert_eq!(f.config.ranges, cfg.ranges);
        assert_eq!(f.config.board, cfg.board);
    }

    #[test]
    fn refuses_when_nothing_is_left_to_simplify() {
        let e = fit_to_budget(&flop(), 1000, Options::default()).unwrap_err();
        assert!(e.contains("budget"), "{e}");
    }
}
