//! External-sampling Monte Carlo CFR (Lanctot et al. 2009) for preflop trees with 2–6
//! players. Information sets are (decision node, starting-hand class): charts are read per
//! class, and 169 classes keep the sampling noise manageable.
//!
//! Each iteration deals real cards and a real board for every traversal, so card removal and
//! multiway all-in showdowns are exact for that deal; error comes from sampling. With three
//! or more players CFR has no guarantee of reaching an equilibrium, so results are labelled
//! approximate and a sampled best-response gain is reported.
//!
//! When betting stops with chips behind ([`Terminal::Flop`]) the hand is not played out:
//! each player's share of the pot comes from an equity-realization model ([`EqrModel`]),
//! which is the main approximation of the 100 bb cash charts (D-017).

// Index loops over several parallel arrays (actions × hands) read more clearly than zipped
// iterators in this numeric code (CLAUDE.md: prefer plain loops in hot code).
#![allow(clippy::needless_range_loop)]

use super::pairs::PairEquity;
use super::tree::{PNode, PreflopTree, Terminal, postflop_rank};
use crate::cards::Combo;
use crate::eval::{Evaluator, HandKey, Strength};
use crate::hands::{HandClass, NUM_CLASSES};
use crate::rng::Rng;

/// Equity realization: when a hand sees the flop, a player's share of the pot is taken to be
/// proportional to (all-in equity × R), where R depends on position, initiative and pot type.
/// The numbers are **authored model inputs**, not solver output (see `v1`).
#[derive(Clone, Debug, PartialEq)]
pub struct EqrModel {
    /// Heads-up R by [pot type: single-raised, 3-bet, 4-bet+][in position][preflop aggressor].
    pub heads_up: [[[f64; 2]; 2]; 3],
    /// Multiway: R for the player last to act postflop, for the others, and a bonus for the
    /// preflop aggressor.
    pub multi_last: f64,
    pub multi_other: f64,
    pub multi_aggressor: f64,
}

impl EqrModel {
    /// Version 1 (authored, 2026-10-24). Rough, commonly assumed shape: the player in
    /// position and the preflop aggressor realize more than their raw equity, the player out
    /// of position less; differences shrink as pots get bigger relative to stacks. These
    /// values are guesses to be replaced by factors calibrated from OpenRange's own postflop
    /// solves (EQR v2); `solver-cli gen-charts` reports how sensitive the charts are to them.
    pub fn v1() -> EqrModel {
        EqrModel {
            //            OOP: [caller, aggressor]  IP: [caller, aggressor]
            heads_up: [
                [[0.84, 0.92], [1.00, 1.06]], // single-raised pot
                [[0.90, 0.96], [0.98, 1.04]], // 3-bet pot
                [[0.97, 1.00], [1.00, 1.01]], // 4-bet pot or bigger
            ],
            multi_last: 1.0,
            multi_other: 0.88,
            multi_aggressor: 0.04,
        }
    }

    /// Every factor multiplied by `scale` for players out of position (sensitivity runs).
    pub fn scaled_oop(&self, scale: f64) -> EqrModel {
        let mut m = self.clone();
        for level in m.heads_up.iter_mut() {
            for r in level[0].iter_mut() {
                *r *= scale;
            }
        }
        m.multi_other *= scale;
        m
    }
}

pub struct Engine<'a> {
    pub tree: &'a PreflopTree,
    equity: Option<&'a PairEquity>,
    pub eqr: Option<EqrModel>,
    /// Storage offset of each action node (`usize::MAX` for terminals).
    offset: Vec<usize>,
    /// Parent action node and the action taken from it, for every node but the root.
    parent: Vec<Option<(usize, usize)>>,
    regret: Vec<f64>,
    sum: Vec<f64>,
    iteration: u64,
    rng: Rng,
}

struct Deal {
    combos: Vec<usize>,
    classes: Vec<usize>,
    strength: Vec<Strength>,
}

/// Per (action node, class): sampled sums of each action's value and the number of visits.
#[derive(Clone, Debug)]
pub struct Evaluation {
    pub samples: u64,
    pub value_sum: Vec<f64>,
    pub value_sq: Vec<f64>,
    /// Like `value_sum`, but each visit weighted by the acting player's own probability of
    /// having played to this node (their earlier decisions under the average strategy).
    pub reach_sum: Vec<f64>,
    pub visits: Vec<u64>,
    /// Per player: cross-validated estimate of the gain from switching single decisions
    /// (node, class) to their best action, bb per hand (see [`Engine::evaluate`]).
    pub best_response_gain: Vec<f64>,
}

impl<'a> Engine<'a> {
    pub fn new(
        tree: &'a PreflopTree,
        equity: Option<&'a PairEquity>,
        eqr: Option<EqrModel>,
        seed: u64,
    ) -> Result<Engine<'a>, String> {
        let has_flop = tree.nodes.iter().any(|n| {
            matches!(
                n,
                PNode::Terminal {
                    kind: Terminal::Flop { .. },
                    ..
                }
            )
        });
        if has_flop && (equity.is_none() || eqr.is_none()) {
            return Err("this tree reaches flops, which need preflop equities and an equity-realization model".into());
        }
        let mut offset = vec![usize::MAX; tree.nodes.len()];
        let mut size = 0;
        for (i, n) in tree.nodes.iter().enumerate() {
            if let PNode::Action { actions, .. } = n {
                offset[i] = size;
                size += actions.len() * NUM_CLASSES;
            }
        }
        let mut parent = vec![None; tree.nodes.len()];
        for (i, n) in tree.nodes.iter().enumerate() {
            if let PNode::Action { children, .. } = n {
                for (a, &c) in children.iter().enumerate() {
                    parent[c] = Some((i, a));
                }
            }
        }
        Ok(Engine {
            tree,
            equity,
            eqr,
            offset,
            parent,
            regret: vec![0.0; size],
            sum: vec![0.0; size],
            iteration: 0,
            rng: Rng::seed(seed),
        })
    }

    /// For each class: probability that the player acting at `node` arrives there with that
    /// class by their own earlier decisions (average strategy). Charts use it to flag hands
    /// that never reach a decision, whose strategy there is meaningless.
    pub fn own_reach(&self, node: usize) -> Vec<f64> {
        let PNode::Action { player, .. } = &self.tree.nodes[node] else {
            return vec![0.0; NUM_CLASSES];
        };
        let mut reach = vec![1.0; NUM_CLASSES];
        let mut at = node;
        while let Some((up, action)) = self.parent[at] {
            if let PNode::Action {
                player: q, actions, ..
            } = &self.tree.nodes[up]
                && q == player
            {
                let mut sigma = vec![0.0; actions.len()];
                for (c, r) in reach.iter_mut().enumerate() {
                    self.strategy(up, c, true, &mut sigma);
                    *r *= sigma[action];
                }
            }
            at = up;
        }
        reach
    }

    pub fn iterations(&self) -> u64 {
        self.iteration
    }

    fn deal(rng: &mut Rng, players: usize) -> Deal {
        let cards = rng.sample_cards(2 * players + 5, 0);
        let board = HandKey::from_cards(&cards[2 * players..]);
        let e = Evaluator::get();
        let mut d = Deal {
            combos: Vec::with_capacity(players),
            classes: Vec::with_capacity(players),
            strength: Vec::with_capacity(players),
        };
        for i in 0..players {
            let c = Combo::new(cards[2 * i], cards[2 * i + 1]);
            d.combos.push(c.index());
            d.classes.push(HandClass::of(c).index());
            d.strength.push(e.eval_key(board.with(c.hi).with(c.lo)));
        }
        d
    }

    /// Current (regret-matching) or average strategy at an action node for a class.
    pub fn strategy(&self, node: usize, class: usize, average: bool, out: &mut [f64]) {
        let k = out.len();
        let base = self.offset[node] + class * k;
        let src = if average {
            &self.sum[base..base + k]
        } else {
            &self.regret[base..base + k]
        };
        let total: f64 = src.iter().map(|x| x.max(0.0)).sum();
        for a in 0..k {
            out[a] = if total > 0.0 {
                src[a].max(0.0) / total
            } else {
                1.0 / k as f64
            };
        }
    }

    /// Payoff (bb, relative to the start of the hand) of `player` at a terminal.
    fn payoff(&self, contrib: &[f64], kind: &Terminal, deal: &Deal, player: usize) -> f64 {
        let pot: f64 = contrib.iter().sum();
        let share = match *kind {
            Terminal::Uncontested { winner } => f64::from(u8::from(winner == player)),
            Terminal::Showdown { players } => {
                if players & (1 << player) == 0 {
                    0.0
                } else if let (2, Some(eq)) = (players.count_ones(), self.equity) {
                    // Heads-up all-in: use the exact all-in equity of the two combos instead of
                    // the sampled board (same expectation, much less noise).
                    let other = (0..contrib.len())
                        .find(|&i| i != player && players & (1 << i) != 0)
                        .expect("two players");
                    eq.equity(deal.combos[player], deal.combos[other]) as f64
                } else {
                    let in_hand = (0..contrib.len()).filter(|&i| players & (1 << i) != 0);
                    let best = in_hand
                        .clone()
                        .map(|i| deal.strength[i])
                        .max()
                        .expect("players");
                    let winners = in_hand.filter(|&i| deal.strength[i] == best).count();
                    if deal.strength[player] == best {
                        1.0 / winners as f64
                    } else {
                        0.0
                    }
                }
            }
            Terminal::Flop {
                players,
                level,
                aggressor,
            } => {
                if players & (1 << player) == 0 {
                    0.0
                } else {
                    self.flop_share(players, level, aggressor, deal, player)
                }
            }
        };
        share * pot - contrib[player]
    }

    /// Equity-realization share of the pot for `player` when `players` see a flop.
    fn flop_share(
        &self,
        players: u8,
        level: u8,
        aggressor: usize,
        deal: &Deal,
        player: usize,
    ) -> f64 {
        let eq = self.equity.expect("checked in new");
        let m = self.eqr.as_ref().expect("checked in new");
        let n = self.tree.players;
        let seats: Vec<usize> = (0..n).filter(|&i| players & (1 << i) != 0).collect();
        if seats.len() == 2 {
            let (a, b) = (seats[0], seats[1]);
            let e = eq.equity(deal.combos[a], deal.combos[b]) as f64;
            let lvl = (level as usize).clamp(1, 3) - 1;
            let r = |s: usize| {
                let other = if s == a { b } else { a };
                let ip = postflop_rank(n, s) > postflop_rank(n, other);
                m.heads_up[lvl][usize::from(ip)][usize::from(s == aggressor)]
            };
            let (wa, wb) = (e * r(a), (1.0 - e) * r(b));
            let wsum = wa + wb;
            return if wsum <= 0.0 {
                0.5
            } else if player == a {
                wa / wsum
            } else {
                wb / wsum
            };
        }
        // Multiway: approximate each player's equity by the product of their heads-up equities
        // against every opponent (as if the matchups were independent), normalised.
        let last = *seats
            .iter()
            .max_by_key(|&&s| postflop_rank(n, s))
            .expect("players");
        let mut weights = Vec::with_capacity(seats.len());
        for &s in &seats {
            let mut p = 1.0;
            for &o in &seats {
                if o != s {
                    p *= eq.equity(deal.combos[s], deal.combos[o]) as f64;
                }
            }
            let r = if s == last {
                m.multi_last
            } else {
                m.multi_other
            } + if s == aggressor {
                m.multi_aggressor
            } else {
                0.0
            };
            weights.push(p * r);
        }
        let total: f64 = weights.iter().sum();
        let i = seats.iter().position(|&s| s == player).expect("in hand");
        if total <= 0.0 {
            1.0 / seats.len() as f64
        } else {
            weights[i] / total
        }
    }

    fn traverse(&mut self, deal: &Deal, trav: usize, node: usize, weight: f64) -> f64 {
        let (player, children) = match &self.tree.nodes[node] {
            PNode::Terminal { contrib, kind } => return self.payoff(contrib, kind, deal, trav),
            PNode::Action {
                player, children, ..
            } => (*player, children.clone()),
        };
        let k = children.len();
        let class = deal.classes[player];
        let mut sigma = [0.0f64; 4];
        self.strategy(node, class, false, &mut sigma[..k]);
        let base = self.offset[node] + class * k;
        if player == trav {
            let mut values = [0.0f64; 4];
            let mut v = 0.0;
            for a in 0..k {
                values[a] = self.traverse(deal, trav, children[a], weight);
                v += sigma[a] * values[a];
            }
            for a in 0..k {
                self.regret[base + a] += values[a] - v;
            }
            v
        } else {
            for a in 0..k {
                self.sum[base + a] += weight * sigma[a];
            }
            let x = self.rng.f64();
            let mut acc = 0.0;
            let mut pick = k - 1;
            for a in 0..k {
                acc += sigma[a];
                if x < acc {
                    pick = a;
                    break;
                }
            }
            self.traverse(deal, trav, children[pick], weight)
        }
    }

    /// Run `iterations` iterations; each traverses once for every player on a fresh deal.
    pub fn iterate(&mut self, iterations: u64) {
        let n = self.tree.players;
        for _ in 0..iterations {
            self.iteration += 1;
            // Linear averaging: later (better) strategies weigh more.
            let weight = self.iteration as f64;
            for trav in 0..n {
                let deal = Self::deal(&mut self.rng, n);
                self.traverse(&deal, trav, 0, weight);
            }
        }
    }

    /// Estimate every action's value per (node, class) with all players on their average
    /// strategies, and each player's single-decision best-response gain, from `samples` deals
    /// per player. Deterministic for a given seed.
    ///
    /// The gain is cross-validated: the samples are split in two halves; the best action at
    /// each (node, class) is chosen on one half and its gain measured on the other (and vice
    /// versa, averaged). Choosing and measuring on the same noisy averages would be biased
    /// upwards by roughly the noise summed over every decision; this way the estimate is
    /// unbiased for the deviations chosen, so it can only understate the true single-decision
    /// gain, and it stops growing with the size of the tree.
    pub fn evaluate(&self, samples: u64, seed: u64) -> Evaluation {
        let n = self.tree.players;
        let size = self.regret.len();
        let empty = || Evaluation {
            samples: 0,
            value_sum: vec![0.0; size],
            value_sq: vec![0.0; size],
            reach_sum: vec![0.0; size],
            visits: vec![0; self.tree.nodes.len() * NUM_CLASSES],
            best_response_gain: vec![0.0; n],
        };
        let half = (samples / 2).max(1);
        let mut halves = [empty(), empty()];
        let mut rng = Rng::seed(seed);
        let mut gains = vec![0.0; n];
        for p in 0..n {
            for h in halves.iter_mut() {
                for _ in 0..half {
                    let deal = Self::deal(&mut rng, n);
                    self.eval_walk(&deal, p, 0, 1.0, &mut rng, h);
                }
            }
            let mut gain = 0.0;
            for (node, nd) in self.tree.nodes.iter().enumerate() {
                let PNode::Action {
                    player, actions, ..
                } = nd
                else {
                    continue;
                };
                if *player != p {
                    continue;
                }
                let k = actions.len();
                let mut sigma = [0.0f64; 4];
                for c in 0..NUM_CLASSES {
                    self.strategy(node, c, true, &mut sigma[..k]);
                    let base = self.offset[node] + c * k;
                    for (choose, measure) in [(0, 1), (1, 0)] {
                        // Weighted by the player's own reach: a better action at a decision the
                        // player never gets to doesn't change what they win.
                        let pick = &halves[choose].reach_sum[base..base + k];
                        let best = (0..k)
                            .max_by(|&a, &b| pick[a].total_cmp(&pick[b]))
                            .expect("actions");
                        let m = &halves[measure].reach_sum[base..base + k];
                        let avg: f64 = (0..k).map(|a| sigma[a] * m[a]).sum();
                        gain += (m[best] - avg) / 2.0;
                    }
                }
            }
            gains[p] = gain / half as f64;
        }
        let [a, b] = halves;
        Evaluation {
            samples: 2 * half,
            value_sum: a
                .value_sum
                .iter()
                .zip(&b.value_sum)
                .map(|(x, y)| x + y)
                .collect(),
            value_sq: a
                .value_sq
                .iter()
                .zip(&b.value_sq)
                .map(|(x, y)| x + y)
                .collect(),
            reach_sum: a
                .reach_sum
                .iter()
                .zip(&b.reach_sum)
                .map(|(x, y)| x + y)
                .collect(),
            visits: a.visits.iter().zip(&b.visits).map(|(x, y)| x + y).collect(),
            best_response_gain: gains,
        }
    }

    fn eval_walk(
        &self,
        deal: &Deal,
        p: usize,
        node: usize,
        own: f64,
        rng: &mut Rng,
        ev: &mut Evaluation,
    ) -> f64 {
        let (player, children) = match &self.tree.nodes[node] {
            PNode::Terminal { contrib, kind } => return self.payoff(contrib, kind, deal, p),
            PNode::Action {
                player, children, ..
            } => (*player, children),
        };
        let k = children.len();
        let class = deal.classes[player];
        let mut sigma = [0.0f64; 4];
        self.strategy(node, class, true, &mut sigma[..k]);
        if player == p {
            let base = self.offset[node] + class * k;
            ev.visits[node * NUM_CLASSES + class] += 1;
            let mut v = 0.0;
            for a in 0..k {
                let x = self.eval_walk(deal, p, children[a], own * sigma[a], rng, ev);
                ev.value_sum[base + a] += x;
                ev.value_sq[base + a] += x * x;
                ev.reach_sum[base + a] += own * x;
                v += sigma[a] * x;
            }
            v
        } else {
            let x = rng.f64();
            let mut acc = 0.0;
            let mut pick = k - 1;
            for a in 0..k {
                acc += sigma[a];
                if x < acc {
                    pick = a;
                    break;
                }
            }
            self.eval_walk(deal, p, children[pick], own, rng, ev)
        }
    }

    /// Mean value of each action (bb) and its standard error, per class, at an action node.
    pub fn action_values(&self, ev: &Evaluation, node: usize) -> Option<Vec<Vec<(f64, f64)>>> {
        let PNode::Action { actions, .. } = &self.tree.nodes[node] else {
            return None;
        };
        let k = actions.len();
        Some(
            (0..NUM_CLASSES)
                .map(|c| {
                    let visits = ev.visits[node * NUM_CLASSES + c] as f64;
                    let base = self.offset[node] + c * k;
                    (0..k)
                        .map(|a| {
                            if visits < 2.0 {
                                return (f64::NAN, f64::NAN);
                            }
                            let mean = ev.value_sum[base + a] / visits;
                            let var = (ev.value_sq[base + a] / visits - mean * mean).max(0.0);
                            (mean, (var / visits).sqrt())
                        })
                        .collect()
                })
                .collect(),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::super::tree::push_fold;
    use super::*;

    #[test]
    fn deterministic_for_a_seed() {
        let t = push_fold(3, 10.0, 0.0).unwrap();
        let run = || {
            let mut e = Engine::new(&t, None, None, 42).unwrap();
            e.iterate(2_000);
            e.sum.clone()
        };
        assert_eq!(run(), run());
    }

    #[test]
    fn short_stacks_shove_more_than_deep_ones() {
        let shove_share = |stack: f64| {
            let t = push_fold(2, stack, 0.0).unwrap();
            let mut e = Engine::new(&t, None, None, 7).unwrap();
            e.iterate(200_000);
            let mut sigma = [0.0; 2];
            HandClass::all()
                .map(|c| {
                    e.strategy(0, c.index(), true, &mut sigma);
                    sigma[1] * c.num_combos() as f64
                })
                .sum::<f64>()
                / 1326.0
        };
        assert!(shove_share(3.0) > shove_share(15.0));
    }

    #[test]
    fn cash_trees_need_equities() {
        let t = super::super::tree::cash(&super::super::tree::CashConfig::six_max(100.0));
        assert!(Engine::new(&t, None, None, 1).is_err());
    }
}
