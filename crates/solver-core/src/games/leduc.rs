//! Leduc hold'em (Southey et al. 2005): a six-card deck (J, Q, K in two suits), one private
//! card each, ante 1. Two betting rounds with bet sizes 2 then 4, at most two bets (a bet and
//! a raise) per round, player 0 first in each round. One public card is dealt between the
//! rounds. At showdown a pair with the public card wins, otherwise the higher card; equal
//! ranks split.
//!
//! Suits never matter for hand strength, so information sets use ranks only.

use crate::cfr::tabular::{Game, Step};

pub struct Leduc;

#[derive(Clone, Debug, Default)]
pub struct LeducState {
    /// Card ids 0..6; rank = id / 2.
    private: Vec<u8>,
    public: Option<u8>,
    /// Betting history per round: 'c' check/call, 'r' bet/raise, 'f' fold.
    rounds: Vec<String>,
}

const NAMES: [char; 3] = ['J', 'Q', 'K'];
const BET: [f64; 2] = [2.0, 4.0];
const MAX_BETS: usize = 2;

/// Chips each player has put in this round, and who folded (if anyone).
fn round_state(hist: &str, bet: f64) -> ([f64; 2], Option<usize>) {
    let mut cur = [0.0f64; 2];
    for (i, a) in hist.chars().enumerate() {
        let p = i % 2;
        match a {
            'r' => cur[p] = cur[0].max(cur[1]) + bet,
            'c' => cur[p] = cur[0].max(cur[1]),
            'f' => return (cur, Some(p)),
            _ => unreachable!(),
        }
    }
    (cur, None)
}

fn round_closed(hist: &str) -> bool {
    hist == "cc" || (hist.len() >= 2 && hist.ends_with('c') && hist.contains('r'))
}

fn rank(card: u8) -> u8 {
    card / 2
}

impl Game for Leduc {
    type State = LeducState;

    fn root(&self) -> LeducState {
        LeducState::default()
    }

    fn step(&self, s: &LeducState) -> Step<LeducState> {
        let used = |c: u8| s.private.contains(&c) || s.public == Some(c);
        // Deal private cards one at a time, then the public card after round 1.
        if s.private.len() < 2
            || (s.rounds.len() == 1 && round_closed(&s.rounds[0]) && s.public.is_none())
        {
            let live: Vec<u8> = (0..6).filter(|&c| !used(c)).collect();
            let p = 1.0 / live.len() as f64;
            return Step::Chance(
                live.into_iter()
                    .map(|c| {
                        let mut n = s.clone();
                        if n.private.len() < 2 {
                            n.private.push(c);
                            if n.private.len() == 2 {
                                n.rounds.push(String::new());
                            }
                        } else {
                            n.public = Some(c);
                            n.rounds.push(String::new());
                        }
                        (n, p)
                    })
                    .collect(),
            );
        }

        let mut paid = [1.0f64, 1.0]; // antes
        for (r, h) in s.rounds.iter().enumerate() {
            let (cur, folded) = round_state(h, BET[r]);
            paid[0] += cur[0];
            paid[1] += cur[1];
            if let Some(f) = folded {
                return Step::Terminal {
                    payoff: if f == 0 { -paid[0] } else { paid[1] },
                };
            }
        }
        let r = s.rounds.len() - 1;
        let hist = &s.rounds[r];
        if r == 1 && round_closed(hist) {
            let public = rank(s.public.expect("dealt"));
            let score = |c: u8| if rank(c) == public { 10 } else { rank(c) };
            let (a, b) = (score(s.private[0]), score(s.private[1]));
            let payoff = match a.cmp(&b) {
                std::cmp::Ordering::Greater => paid[1],
                std::cmp::Ordering::Less => -paid[0],
                std::cmp::Ordering::Equal => 0.0,
            };
            return Step::Terminal { payoff };
        }

        let player = hist.len() % 2;
        let facing_bet = hist.ends_with('r');
        let bets = hist.matches('r').count();
        let next = |a: char| {
            let mut n = s.clone();
            n.rounds[r].push(a);
            n
        };
        let mut actions = Vec::new();
        if facing_bet {
            actions.push(("fold".to_string(), next('f')));
            actions.push(("call".to_string(), next('c')));
        } else {
            actions.push(("check".to_string(), next('c')));
        }
        if bets < MAX_BETS {
            actions.push((
                if facing_bet { "raise" } else { "bet" }.to_string(),
                next('r'),
            ));
        }
        let public = s
            .public
            .map(|c| NAMES[rank(c) as usize].to_string())
            .unwrap_or_default();
        let infoset = format!(
            "{}{}:{}",
            NAMES[rank(s.private[player]) as usize],
            public,
            s.rounds.join("/")
        );
        Step::Decision {
            player,
            infoset,
            actions,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cfr::tabular::{Algorithm, Solver, Tree, exploitability};

    #[test]
    fn tree_shape() {
        let t = Tree::build(&Leduc);
        // Player 0's first decision: one infoset per private rank, nothing else known.
        assert_eq!(
            t.infosets
                .iter()
                .filter(|i| i.player == 0 && i.key.ends_with(':'))
                .count(),
            3
        );
        // Every infoset offers 2 or 3 actions (check/bet, or fold/call[/raise]).
        assert!(
            t.infosets
                .iter()
                .all(|i| (2..=3).contains(&i.actions.len()))
        );
    }

    #[test]
    fn dcfr_exploitability_falls() {
        let mut s = Solver::new(Tree::build(&Leduc), Algorithm::DCFR_DEFAULT);
        let mut last = f64::INFINITY;
        for checkpoint in [10, 100, 1000] {
            while s.iterations() < checkpoint {
                s.iterate();
            }
            let ex = exploitability(&s.tree, &s.average_strategy());
            assert!(
                ex < last,
                "exploitability rose at {checkpoint}: {ex} ≥ {last}"
            );
            last = ex;
        }
        // Measured 1.7e-4 when this threshold was set.
        assert!(last < 1e-3, "after 1000 DCFR iterations: {last}");
    }
}
