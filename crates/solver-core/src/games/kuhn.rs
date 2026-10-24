//! Kuhn poker (Kuhn 1950): three cards J < Q < K, one card each, ante 1, one betting round
//! with a single bet size of 1. Player 0 acts first. Its equilibrium value for player 0 is
//! −1/18 (a closed-form result), which makes it the standard first test for CFR code.

use crate::cfr::tabular::{Game, Step};

pub struct Kuhn;

#[derive(Clone, Debug)]
pub struct KuhnState {
    cards: Option<[u8; 2]>,
    history: String,
}

const NAMES: [char; 3] = ['J', 'Q', 'K'];

impl Game for Kuhn {
    type State = KuhnState;

    fn root(&self) -> KuhnState {
        KuhnState {
            cards: None,
            history: String::new(),
        }
    }

    fn step(&self, s: &KuhnState) -> Step<KuhnState> {
        let Some(cards) = s.cards else {
            let mut deals = Vec::new();
            for a in 0..3u8 {
                for b in 0..3u8 {
                    if a != b {
                        deals.push((
                            KuhnState {
                                cards: Some([a, b]),
                                history: String::new(),
                            },
                            1.0 / 6.0,
                        ));
                    }
                }
            }
            return Step::Chance(deals);
        };
        let showdown = |stake: f64| if cards[0] > cards[1] { stake } else { -stake };
        match s.history.as_str() {
            "pp" => {
                return Step::Terminal {
                    payoff: showdown(1.0),
                };
            }
            "bb" | "pbb" => {
                return Step::Terminal {
                    payoff: showdown(2.0),
                };
            }
            "bp" => return Step::Terminal { payoff: 1.0 }, // player 1 folds to the bet
            "pbp" => return Step::Terminal { payoff: -1.0 }, // player 0 folds to the bet
            _ => {}
        }
        let player = s.history.len() % 2;
        let next = |a: char| KuhnState {
            cards: s.cards,
            history: format!("{}{a}", s.history),
        };
        Step::Decision {
            player,
            infoset: format!("{}{}", NAMES[cards[player] as usize], s.history),
            actions: vec![("p".into(), next('p')), ("b".into(), next('b'))],
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cfr::tabular::{Algorithm, Solver, Strategy, Tree, expected_value, exploitability};

    fn solve(algo: Algorithm, iters: u32) -> (Tree, Strategy) {
        let mut s = Solver::new(Tree::build(&Kuhn), algo);
        for _ in 0..iters {
            s.iterate();
        }
        let sigma = s.average_strategy();
        (s.tree, sigma)
    }

    fn prob(tree: &Tree, sigma: &Strategy, key: &str, action: &str) -> f64 {
        let is = tree.infosets.iter().position(|i| i.key == key).expect(key);
        let a = tree.infosets[is]
            .actions
            .iter()
            .position(|x| x == action)
            .unwrap();
        sigma[is][a]
    }

    #[test]
    fn tree_shape() {
        let t = Tree::build(&Kuhn);
        // 3 cards × 4 decision histories ("", "p", "b", "pb") = 12 infosets.
        assert_eq!(t.infosets.len(), 12);
    }

    #[test]
    fn converges_to_the_known_equilibrium() {
        for algo in [
            Algorithm::DCFR_DEFAULT,
            Algorithm::CFR_PLUS,
            Algorithm::Vanilla,
        ] {
            let (tree, sigma) = solve(algo, 20_000);
            let ex = exploitability(&tree, &sigma);
            assert!(ex < 2e-3, "{}: exploitability {ex}", algo.name());
            // Game value for player 0 is −1/18.
            assert!(
                (expected_value(&tree, &sigma) + 1.0 / 18.0).abs() < 3e-3,
                "{}",
                algo.name()
            );
            // Equilibrium family (Kuhn 1950): player 0 bets J with some α ∈ [0, 1/3],
            // bets K with 3α, never opens Q; player 1 calls a bet with Q 1/3 of the time.
            let alpha = prob(&tree, &sigma, "J", "b");
            assert!(alpha <= 1.0 / 3.0 + 0.01);
            assert!(
                (prob(&tree, &sigma, "K", "b") - 3.0 * alpha).abs() < 0.03,
                "{}",
                algo.name()
            );
            assert!(prob(&tree, &sigma, "Q", "b") < 0.02);
            assert!((prob(&tree, &sigma, "Qb", "b") - 1.0 / 3.0).abs() < 0.03);
        }
    }

    #[test]
    fn uniform_random_strategy_is_exploitable() {
        let tree = Tree::build(&Kuhn);
        let uniform: Strategy = tree
            .infosets
            .iter()
            .map(|i| vec![1.0 / i.actions.len() as f64; i.actions.len()])
            .collect();
        assert!(exploitability(&tree, &uniform) > 0.1);
    }
}
