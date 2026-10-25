//! Independent checks for the vectorized solver.
//!
//! [`ReferenceSpot`] restates a (small, rake-free) river or turn spot as an ordinary
//! extensive-form game for the tabular engine in [`crate::cfr::tabular`]: one chance outcome
//! per pair of hands, one chance outcome per river card (turn spots), one information set per
//! (player, hand, dealt card, history), and showdown payoffs from the slow reference evaluator.
//! It shares none of the vectorized code paths (no sweeps, no card-removal accumulators, no
//! suit isomorphism), so agreement between the two is meaningful.
//!
//! [`toy_polarized`] builds the textbook polarized-bettor vs bluff-catcher river game.

use super::game::{Options, PostflopGame, SpotConfig};
use super::tree::{Action, BetSizes, NodeKind, Size, Street, StreetSizes, Tree, TreeConfig};
use crate::cards::{Card, CardSet, Combo, parse_cards};
use crate::cfr::Algorithm;
use crate::cfr::tabular::{self, Game, Solver, Step};
use crate::eval::reference;
use crate::range::Range;
use crate::rng::Rng;
use std::collections::HashMap;

pub struct ReferenceSpot {
    tree: Tree,
    board: Vec<Card>,
    pot: f64,
    /// (OOP combo, IP combo, probability)
    deals: Vec<(Combo, Combo, f64)>,
}

impl ReferenceSpot {
    pub fn new(cfg: &SpotConfig) -> Result<ReferenceSpot, String> {
        if cfg.tree.rake.fraction != 0.0 {
            return Err("the reference solver handles rake-free spots only".into());
        }
        let board = CardSet::from_cards(&cfg.board);
        let mut deals = Vec::new();
        let mut total = 0.0;
        for (a, wa) in cfg.ranges[0].without(board).iter() {
            for (b, wb) in cfg.ranges[1].without(board).iter() {
                if !a.cards().intersects(b.cards()) {
                    let w = wa as f64 * wb as f64;
                    deals.push((a, b, w));
                    total += w;
                }
            }
        }
        for d in &mut deals {
            d.2 /= total;
        }
        Ok(ReferenceSpot {
            tree: Tree::build(&cfg.tree)?,
            board: cfg.board.clone(),
            pot: cfg.tree.pot as f64,
            deals,
        })
    }

    /// Payoff to OOP minus half the starting pot, which makes the game zero-sum (the tabular
    /// engine's convention) without changing any strategic incentive.
    fn payoff0(&self, deal: usize, node: usize, dealt: &[Card]) -> f64 {
        let n = &self.tree.nodes[node];
        let (inv0, inv1) = (n.invested[0] as f64, n.invested[1] as f64);
        let u0 = match n.kind {
            NodeKind::Fold { folder: 0 } => -inv0,
            NodeKind::Fold { .. } => self.pot + inv1,
            NodeKind::Showdown => {
                let (a, b, _) = self.deals[deal];
                let board = [&self.board[..], dealt].concat();
                let sa = reference::eval(&[&board[..], &[a.hi, a.lo]].concat());
                let sb = reference::eval(&[&board[..], &[b.hi, b.lo]].concat());
                match sa.cmp(&sb) {
                    std::cmp::Ordering::Greater => self.pot + inv1,
                    std::cmp::Ordering::Less => -inv0,
                    std::cmp::Ordering::Equal => self.pot / 2.0,
                }
            }
            _ => unreachable!("not a terminal"),
        };
        u0 - self.pot / 2.0
    }
}

#[derive(Clone)]
pub struct RefState {
    deal: Option<usize>,
    node: usize,
    /// Turn and/or river cards dealt so far, in order.
    dealt: Vec<Card>,
}

impl Game for ReferenceSpot {
    type State = RefState;

    fn root(&self) -> RefState {
        RefState {
            deal: None,
            node: 0,
            dealt: Vec::new(),
        }
    }

    fn step(&self, s: &RefState) -> Step<RefState> {
        let Some(d) = s.deal else {
            return Step::Chance(
                (0..self.deals.len())
                    .map(|i| {
                        (
                            RefState {
                                deal: Some(i),
                                node: 0,
                                dealt: Vec::new(),
                            },
                            self.deals[i].2,
                        )
                    })
                    .collect(),
            );
        };
        match &self.tree.nodes[s.node].kind {
            NodeKind::Action {
                player,
                actions,
                children,
            } => {
                let combo = if *player == 0 {
                    self.deals[d].0
                } else {
                    self.deals[d].1
                };
                let dealt: String = if s.dealt.is_empty() {
                    "-".into()
                } else {
                    s.dealt.iter().map(|c| c.to_string()).collect()
                };
                Step::Decision {
                    player: *player,
                    infoset: format!("{combo}:{}:{dealt}", s.node),
                    actions: actions
                        .iter()
                        .zip(children)
                        .map(|(a, &c)| {
                            (
                                a.label(),
                                RefState {
                                    deal: Some(d),
                                    node: c,
                                    dealt: s.dealt.clone(),
                                },
                            )
                        })
                        .collect(),
                }
            }
            NodeKind::Chance { child, .. } => {
                let (a, b, _) = self.deals[d];
                let used = CardSet(
                    CardSet::from_cards(&self.board).0
                        | CardSet::from_cards(&s.dealt).0
                        | a.cards().0
                        | b.cards().0,
                );
                let live: Vec<Card> = (0..52)
                    .map(Card::from_index)
                    .filter(|c| !used.contains(*c))
                    .collect();
                let p = 1.0 / live.len() as f64;
                Step::Chance(
                    live.into_iter()
                        .map(|c| {
                            let mut dealt = s.dealt.clone();
                            dealt.push(c);
                            (
                                RefState {
                                    deal: Some(d),
                                    node: *child,
                                    dealt,
                                },
                                p,
                            )
                        })
                        .collect(),
                )
            }
            NodeKind::Fold { .. } | NodeKind::Showdown => Step::Terminal {
                payoff: self.payoff0(d, s.node, &s.dealt),
            },
        }
    }
}

/// The polarized river toy game: OOP holds only nut hands (a set of eights) and air (7-6),
/// IP holds only bluff-catchers (QQ) on `Ah Kd 8c 5s 2h`. OOP may check or bet `bet_fraction`
/// of the pot; IP may only call or fold a bet and can't bet when checked to. The ranks of the
/// two ranges don't overlap, so card removal plays no role and textbook theory applies:
/// IP calls P/(P+B) of the time and bluffs make up B/(P+2B) of OOP's betting range.
pub fn toy_polarized(bet_fraction: f64) -> SpotConfig {
    let bet = BetSizesFor::oop_only(bet_fraction);
    let tree = TreeConfig {
        street: Street::River,
        pot: 1000,
        stack: 100_000,
        sizes: [bet.clone(), bet.clone(), bet],
        max_raises: [0; 3],
        allin_threshold: 2.0,
        rake: Default::default(),
    };
    SpotConfig {
        tree,
        board: parse_cards("Ah Kd 8c 5s 2h").expect("board"),
        ranges: [
            Range::parse("88, 76").expect("range"),
            Range::parse("QQ").expect("range"),
        ],
    }
}

struct BetSizesFor;
impl BetSizesFor {
    fn oop_only(fraction: f64) -> StreetSizes {
        StreetSizes {
            oop: BetSizes {
                bet: vec![Size::Pot(fraction)],
                raise: vec![],
            },
            ip: Default::default(),
        }
    }
}

fn solve(cfg: &SpotConfig, iters: u32) -> Result<PostflopGame, String> {
    let mut g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT)?;
    for _ in 0..iters {
        g.iterate();
    }
    Ok(g)
}

/// Measured vs theoretical quantities for [`toy_polarized`].
#[derive(Clone, Debug)]
pub struct ToyResult {
    pub pot: f64,
    pub bet: f64,
    /// IP calling frequency vs MDF = P/(P+B).
    pub call: f64,
    pub mdf: f64,
    /// Share of bluffs in the OOP betting range vs B/(P+2B).
    pub bluff_share: f64,
    pub theory_bluff_share: f64,
    /// How often OOP bets its value hands (should be 1).
    pub value_bet: f64,
    pub exploitability_pct: f64,
}

pub fn toy_check(bet_fraction: f64, iters: u32) -> Result<ToyResult, String> {
    let cfg = toy_polarized(bet_fraction);
    let mut g = solve(&cfg, iters)?;
    let pot = cfg.tree.pot as f64;
    let NodeKind::Action {
        actions, children, ..
    } = g.tree.nodes[0].kind.clone()
    else {
        return Err("bad toy tree".into());
    };
    let bet = match actions[1] {
        Action::Bet(to) | Action::AllIn(to) => to as f64,
        _ => return Err("bad toy tree".into()),
    };
    let is_value = |c: Combo| c.hi.rank() == 6; // the eights; rank index 6 is the 8
    let root = g.river_average(0).ok_or("no root strategy")?;
    let n = g.hands(0).len();
    let (mut bluff, mut all, mut value, mut value_bet) = (0.0, 0.0, 0.0, 0.0);
    for h in 0..n {
        let w = g.initial_weights(0)[h] as f64;
        let b = w * root[n + h] as f64;
        all += b;
        if is_value(g.hands(0)[h]) {
            value += w;
            value_bet += b;
        } else {
            bluff += b;
        }
    }
    // The IP node after the bet is [Fold, Call]; IP reach there is just its initial range.
    let ip = g.river_average(children[1]).ok_or("no IP strategy")?;
    let m = g.hands(1).len();
    let (mut call, mut tot) = (0.0, 0.0);
    for h in 0..m {
        let w = g.initial_weights(1)[h] as f64;
        call += w * ip[m + h] as f64;
        tot += w;
    }
    Ok(ToyResult {
        pot,
        bet,
        call: call / tot,
        mdf: pot / (pot + bet),
        bluff_share: bluff / all,
        theory_bluff_share: bet / (pot + 2.0 * bet),
        value_bet: value_bet / value,
        exploitability_pct: g.exploitability().pct_pot,
    })
}

/// A small random river spot (few combos per side, two bet sizes, raises) for cross-checks.
pub fn random_river_spot(rng: &mut Rng) -> SpotConfig {
    let board = rng.sample_cards(5, 0);
    let bset = CardSet::from_cards(&board);
    let mut ranges = [Range::empty(), Range::empty()];
    for r in ranges.iter_mut() {
        let n = 4 + rng.below(6) as usize;
        for c in rng.sample_cards(2 * n, bset.0).chunks(2) {
            r.set(Combo::new(c[0], c[1]), 0.25 + 0.75 * rng.f64() as f32);
        }
    }
    let sizes = StreetSizes {
        oop: BetSizes {
            bet: vec![Size::Pot(0.5), Size::Pot(1.0)],
            raise: vec![Size::Pot(1.0)],
        },
        ip: BetSizes {
            bet: vec![Size::Pot(0.75)],
            raise: vec![Size::Pot(1.0)],
        },
    };
    let tree = TreeConfig {
        street: Street::River,
        pot: 1000,
        stack: 3000 + 1000 * rng.below(5) as i64,
        sizes: [sizes.clone(), sizes.clone(), sizes],
        max_raises: [1 + rng.below(2) as u8; 3],
        allin_threshold: 2.0,
        rake: Default::default(),
    };
    SpotConfig {
        tree,
        board,
        ranges,
    }
}

/// Result of comparing the vectorized solver with the tabular reference on one spot
/// (all values in chips, shifted so the game is zero-sum).
#[derive(Clone, Debug)]
pub struct ReferenceComparison {
    /// Exploitability of the vectorized solution, measured by the vectorized code ...
    pub vectorized_exploitability: f64,
    /// ... and by the tabular best-response code on the translated strategy.
    pub tabular_exploitability: f64,
    pub vectorized_value: f64,
    /// Game value found by solving the same spot with the tabular engine.
    pub tabular_value: f64,
}

pub fn reference_check(cfg: &SpotConfig, iters: u32) -> Result<ReferenceComparison, String> {
    // Every dealt card needs its own node to compare against, so no isomorphism here.
    let options = Options {
        algorithm: Algorithm::DCFR_DEFAULT,
        isomorphism: false,
    };
    let mut g = PostflopGame::with_options(cfg.clone(), options)?;
    for _ in 0..iters {
        g.iterate();
    }
    let reference = ReferenceSpot::new(cfg)?;
    let tab_tree = tabular::Tree::build(&reference);
    let start = CardSet::from_cards(&cfg.board);
    let mut sigma: tabular::Strategy = tab_tree
        .infosets
        .iter()
        .map(|i| vec![0.0; i.actions.len()])
        .collect();
    let mut views: HashMap<(usize, u64), Vec<f32>> = HashMap::new();
    for (k, info) in tab_tree.infosets.iter().enumerate() {
        let mut parts = info.key.split(':');
        let (combo_s, node_s, dealt_s) = (parts.next(), parts.next(), parts.next());
        let (Some(combo_s), Some(node_s), Some(dealt_s)) = (combo_s, node_s, dealt_s) else {
            return Err("bad infoset key".into());
        };
        let node: usize = node_s.parse().map_err(|_| "bad infoset key")?;
        let mut board = start;
        if dealt_s != "-" {
            for c in crate::cards::parse_cards(dealt_s).ok_or("bad card")? {
                board.insert(c);
            }
        }
        let view = match views.entry((node, board.0)) {
            std::collections::hash_map::Entry::Occupied(e) => e.into_mut(),
            std::collections::hash_map::Entry::Vacant(e) => {
                e.insert(g.average_at(node, board).ok_or("missing node")?)
            }
        };
        let combo = Combo::parse(combo_s).ok_or("bad combo")?;
        let h = g
            .hands(info.player)
            .iter()
            .position(|&c| c == combo)
            .ok_or("missing hand")?;
        let n = g.hands(info.player).len();
        for a in 0..info.actions.len() {
            sigma[k][a] = view[a * n + h] as f64;
        }
    }
    let tabular_exploitability = tabular::exploitability(&tab_tree, &sigma);
    let vectorized_exploitability = g.exploitability().chips;
    let mut solver = Solver::new(tab_tree.clone(), Algorithm::DCFR_DEFAULT);
    for _ in 0..iters {
        solver.iterate();
    }
    let tabular_value = tabular::expected_value(&tab_tree, &solver.average_strategy());
    let vectorized_value = g.expected_values()[0] - cfg.tree.pot as f64 / 2.0;
    Ok(ReferenceComparison {
        vectorized_exploitability,
        tabular_exploitability,
        vectorized_value,
        tabular_value,
    })
}

/// A tiny random flop spot: 2–3 combos per side, one bet size on the flop and turn, no raises,
/// no river betting. Small enough for the tabular reference (every turn and river card is an
/// explicit chance outcome).
pub fn random_flop_spot(rng: &mut Rng) -> SpotConfig {
    let board = rng.sample_cards(3, 0);
    let bset = CardSet::from_cards(&board);
    let mut ranges = [Range::empty(), Range::empty()];
    for r in ranges.iter_mut() {
        let n = 2 + rng.below(2) as usize;
        for c in rng.sample_cards(2 * n, bset.0).chunks(2) {
            r.set(Combo::new(c[0], c[1]), 0.25 + 0.75 * rng.f64() as f32);
        }
    }
    let bet = |f: f64| StreetSizes {
        oop: BetSizes {
            bet: vec![Size::Pot(f)],
            raise: vec![],
        },
        ip: BetSizes {
            bet: vec![Size::Pot(f)],
            raise: vec![],
        },
    };
    let tree = TreeConfig {
        street: Street::Flop,
        pot: 1000,
        stack: 3000 + 1000 * rng.below(3) as i64,
        sizes: [bet(0.66), bet(0.75), StreetSizes::default()],
        max_raises: [0; 3],
        allin_threshold: 2.0,
        rake: Default::default(),
    };
    SpotConfig {
        tree,
        board,
        ranges,
    }
}

/// A small random turn spot (few combos per side, one bet size and one raise per street).
pub fn random_turn_spot(rng: &mut Rng) -> SpotConfig {
    let board = rng.sample_cards(4, 0);
    let bset = CardSet::from_cards(&board);
    let mut ranges = [Range::empty(), Range::empty()];
    for r in ranges.iter_mut() {
        let n = 3 + rng.below(3) as usize;
        for c in rng.sample_cards(2 * n, bset.0).chunks(2) {
            r.set(Combo::new(c[0], c[1]), 0.25 + 0.75 * rng.f64() as f32);
        }
    }
    let sizes = StreetSizes {
        oop: BetSizes {
            bet: vec![Size::Pot(0.66)],
            raise: vec![Size::Pot(1.0)],
        },
        ip: BetSizes {
            bet: vec![Size::Pot(0.75)],
            raise: vec![Size::Pot(1.0)],
        },
    };
    let tree = TreeConfig {
        street: Street::Turn,
        pot: 1000,
        stack: 4000 + 1000 * rng.below(4) as i64,
        sizes: [sizes.clone(), sizes.clone(), sizes],
        max_raises: [1; 3],
        allin_threshold: 2.0,
        rake: Default::default(),
    };
    SpotConfig {
        tree,
        board,
        ranges,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::postflop::ViewKind;

    /// Shares of OOP's air that bets at the root and of IP's range that calls the bet.
    fn toy_frequencies(g: &mut PostflopGame) -> (f64, f64) {
        let root = g.river_average(0).unwrap();
        let n = g.hands(0).len();
        let (mut air, mut air_bet) = (0.0, 0.0);
        for h in 0..n {
            if g.hands(0)[h].hi.rank() != 6 {
                let w = g.initial_weights(0)[h] as f64;
                air += w;
                air_bet += w * root[n + h] as f64;
            }
        }
        let NodeKind::Action { children, .. } = g.tree.nodes[0].kind.clone() else {
            unreachable!()
        };
        let ip = g.river_average(children[1]).unwrap();
        let m = g.hands(1).len();
        let call = (0..m).map(|h| ip[m + h] as f64).sum::<f64>() / m as f64;
        (air_bet / air, call)
    }

    #[test]
    fn node_lock_on_the_caller_gives_the_textbook_best_response() {
        // IP locked at calling 30% of the time, below the MDF of a 3/4-pot bet (57%): OOP's best
        // response bluffs every air hand. Its EV per hand pair is (3·(P + cB) + 16·((1−c)P − cB)) / 19
        // with 3 value combos (88) and 16 air combos (76).
        let cfg = toy_polarized(0.75);
        let mut g = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT).unwrap();
        let m = g.hands(1).len();
        let lock: Vec<f32> = [vec![0.7f32; m], vec![0.3f32; m]].concat();
        g.lock(&[1], &lock).unwrap();
        assert!(g.is_locked(&[1]) && !g.is_locked(&[0]) && g.lock_count() == 1);
        for _ in 0..2000 {
            g.iterate();
        }
        let (air_bets, call) = toy_frequencies(&mut g);
        assert!(air_bets > 0.999, "air bets {air_bets}");
        assert!((call - 0.3).abs() < 1e-6, "the lock is respected: {call}");
        let (p, b, c) = (1000.0, 750.0, 0.3);
        let want = (3.0 * (p + c * b) + 16.0 * ((1.0 - c) * p - c * b)) / 19.0;
        let ev = g.expected_values()[0];
        assert!((ev - want).abs() < 0.5, "EV {ev} vs {want}");
        assert!(g.exploitability().pct_pot < 0.01, "restricted game solved");
        assert!(g.node(&[1]).unwrap().locked);
    }

    #[test]
    fn node_lock_on_the_bettor_makes_the_caller_call_everything() {
        // OOP locked at betting every hand: bluffs are 16/19 of bets, far above 3/7, so calling
        // beats folding with every bluff catcher.
        let cfg = toy_polarized(0.75);
        let mut g = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT).unwrap();
        let n = g.hands(0).len();
        g.lock(&[], &[vec![0f32; n], vec![1f32; n]].concat())
            .unwrap();
        for _ in 0..1000 {
            g.iterate();
        }
        let (air_bets, call) = toy_frequencies(&mut g);
        assert!((air_bets - 1.0).abs() < 1e-6);
        assert!(call > 0.999, "call {call}");
        // Unlock, reset and re-solve: back to the equilibrium (call = MDF).
        assert!(g.unlock(&[]).unwrap());
        g.reset();
        for _ in 0..3000 {
            g.iterate();
        }
        let (_, call) = toy_frequencies(&mut g);
        assert!((call - 1000.0 / 1750.0).abs() < 1e-3, "call {call}");
    }

    #[test]
    fn node_lock_rejects_bad_input() {
        let mut g = PostflopGame::new(toy_polarized(0.75), Algorithm::DCFR_DEFAULT).unwrap();
        let m = g.hands(1).len();
        assert!(g.lock(&[1], &[0.5]).is_err(), "wrong length");
        assert!(g.lock(&[1], &vec![-1.0; 2 * m]).is_err(), "negative");
        assert!(g.lock(&[1], &vec![0.0; 2 * m]).is_err(), "zero sum");
        assert!(
            g.lock(&[1, 0], &vec![0.5; 2 * m]).is_err(),
            "a terminal node"
        );
        assert!(g.lock(&[9], &vec![0.5; 2 * m]).is_err(), "no such child");
        // Probabilities are normalized.
        g.lock(&[1], &vec![2.0; 2 * m]).unwrap();
        let ip = g.node(&[1]).unwrap();
        let ViewKind::Action { strategy, .. } = ip.kind else {
            unreachable!()
        };
        assert!(strategy.iter().all(|&x| (x - 0.5).abs() < 1e-6));
    }

    #[test]
    fn polarized_toy_game_matches_mdf_and_bluff_share_theory() {
        for f in [0.33, 0.75, 1.5] {
            let r = toy_check(f, 3000).unwrap();
            // Tolerances ~5-10x measured (D-040): worst |call - MDF| 6.0e-5, worst
            // |bluff share - theory| 1.2e-4, exploitability 0.0019% of pot, value bets 100%.
            assert!(r.exploitability_pct < 0.01, "{f}: {r:?}");
            assert!(r.value_bet > 0.9999, "{f}: {r:?}");
            assert!(
                (r.bluff_share - r.theory_bluff_share).abs() < 1e-3,
                "{f}: {r:?}"
            );
            assert!((r.call - r.mdf).abs() < 5e-4, "{f}: {r:?}");
        }
    }

    #[test]
    fn vectorized_solver_agrees_with_tabular_reference_on_random_rivers() {
        let mut rng = Rng::seed(0x00C0_FFEE);
        for case in 0..8 {
            let cfg = random_river_spot(&mut rng);
            let r = reference_check(&cfg, 1500).unwrap();
            // Same strategy, two independent best-response implementations (measured worst
            // difference 1.9e-5 chips over 12 spots).
            assert!(
                (r.tabular_exploitability - r.vectorized_exploitability).abs() < 1e-4,
                "case {case}: {r:?}"
            );
            // Two independent solvers reach the same value (measured worst 1.9e-3 chips;
            // tolerance 10x that, above the 0.01-chip floor).
            assert!(
                (r.tabular_value - r.vectorized_value).abs() < 0.02,
                "case {case}: {r:?}"
            );
        }
    }

    #[test]
    fn vectorized_solver_agrees_with_tabular_reference_on_random_turns() {
        let mut rng = Rng::seed(0x7AB1E);
        for case in 0..3 {
            let cfg = random_turn_spot(&mut rng);
            let r = reference_check(&cfg, 800).unwrap();
            // Measured worst: 2.6e-5 chips (best response), 1.9e-4 chips (value; floor 0.01).
            assert!(
                (r.tabular_exploitability - r.vectorized_exploitability).abs() < 2e-4,
                "case {case}: {r:?}"
            );
            assert!(
                (r.tabular_value - r.vectorized_value).abs() < 0.01,
                "case {case}: {r:?}"
            );
        }
    }

    /// The tabular side of a flop spot is large (every turn and river card is an explicit
    /// chance outcome): ~40 s in release, far longer in debug builds. Runs in CI's release
    /// step and in `solver-cli validate`.
    #[test]
    #[ignore = "heavy: run in release with --include-ignored"]
    fn vectorized_solver_agrees_with_tabular_reference_on_a_random_flop() {
        let mut rng = Rng::seed(0xF10F);
        let cfg = random_flop_spot(&mut rng);
        let r = reference_check(&cfg, 600).unwrap();
        // Measured worst over 3 spots: 6.5e-5 chips (best response), 1.9e-4 chips (value).
        assert!(
            (r.tabular_exploitability - r.vectorized_exploitability).abs() < 5e-4,
            "{r:?}"
        );
        assert!((r.tabular_value - r.vectorized_value).abs() < 0.01, "{r:?}");
    }

    #[test]
    fn toy_tree_shape() {
        let t = Tree::build(&toy_polarized(0.75).tree).unwrap();
        let NodeKind::Action { actions, .. } = &t.nodes[0].kind else {
            panic!()
        };
        assert_eq!(actions, &vec![Action::Check, Action::Bet(750)]);
    }
}
