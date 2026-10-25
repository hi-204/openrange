//! Heads-up push/fold: everyone else has folded; the first player (the "pusher", usually the
//! small blind) moves all-in or folds, and the second (the "caller", usually the big blind)
//! calls or folds.
//!
//! The game is solved exactly over hands (all 1326 combos with exact card removal when built
//! by [`hu_spot`]) with Discounted CFR, and its exploitability is measured exactly by best
//! responses. Payoffs are general: chip EV, or tournament $EV via ICM, which makes the game
//! non-constant-sum; the exploitability (NashConv / 2) is still well defined and is what we
//! report.

// Index loops over several parallel arrays (actions × hands) read more clearly than zipped
// iterators in this numeric code (CLAUDE.md: prefer plain loops in hot code).
#![allow(clippy::needless_range_loop)]

use super::icm::icm_equity;
use super::pairs::PairEquity;
use crate::cards::{COMBOS, NUM_COMBOS};
use crate::cfr::Algorithm;

/// Payoff to (pusher, caller) at each kind of terminal.
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Payoffs {
    /// Pusher folds.
    pub fold: [f64; 2],
    /// Pusher shoves, caller folds.
    pub steal: [f64; 2],
    /// Shove, call; the pusher wins / ties / loses the showdown.
    pub win: [f64; 2],
    pub tie: [f64; 2],
    pub lose: [f64; 2],
}

/// A shove-or-fold vs call-or-fold game over arbitrary hand lists.
#[derive(Clone, Debug)]
pub struct ShoveGame {
    /// Weight (probability up to scale) of each pusher hand and each caller hand.
    pub pusher: Vec<f64>,
    pub caller: Vec<f64>,
    /// `[i * n_caller + j]`: 1 if the two hands can be dealt together, else 0.
    pub compat: Vec<f32>,
    /// `[i * n_caller + j]`: (win, tie) probability for the pusher.
    pub outcome: Vec<(f32, f32)>,
    pub payoffs: Payoffs,
}

pub struct ShoveSolver {
    pub game: ShoveGame,
    pub algorithm: Algorithm,
    /// Regrets for (shove/call, fold) per hand.
    regret: [Vec<[f64; 2]>; 2],
    /// Discounted sums of (reach × shove/call probability, reach) per hand.
    sum: [Vec<[f64; 2]>; 2],
    iteration: u32,
}

#[derive(Clone, Debug)]
pub struct ShoveValues {
    /// Per pusher hand: EV of shoving and of folding (unnormalised counterfactual values;
    /// divide by `pusher_mass[i]` for a per-hand EV).
    pub shove: Vec<f64>,
    pub fold: Vec<f64>,
    /// Per caller hand, given a shove: EV of calling and of folding (unnormalised).
    pub call: Vec<f64>,
    pub pass: Vec<f64>,
    /// Compatible opponent weight behind each pusher hand / each caller hand (given a shove).
    pub pusher_mass: Vec<f64>,
    pub caller_mass: Vec<f64>,
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ShoveReport {
    /// Expected payoff of each player under the average strategies.
    pub value: [f64; 2],
    /// Best-response payoff of each player against the other's average strategy.
    pub best_response: [f64; 2],
    /// NashConv / 2, in payoff units.
    pub exploitability: f64,
}

impl ShoveSolver {
    pub fn new(game: ShoveGame, algorithm: Algorithm) -> ShoveSolver {
        let (n0, n1) = (game.pusher.len(), game.caller.len());
        assert_eq!(game.compat.len(), n0 * n1);
        assert_eq!(game.outcome.len(), n0 * n1);
        ShoveSolver {
            game,
            algorithm,
            regret: [vec![[0.0; 2]; n0], vec![[0.0; 2]; n1]],
            sum: [vec![[0.0; 2]; n0], vec![[0.0; 2]; n1]],
            iteration: 0,
        }
    }

    pub fn iterations(&self) -> u32 {
        self.iteration
    }

    fn current(regret: &[[f64; 2]]) -> Vec<f64> {
        regret
            .iter()
            .map(|r| {
                let (a, b) = (r[0].max(0.0), r[1].max(0.0));
                if a + b > 0.0 { a / (a + b) } else { 0.5 }
            })
            .collect()
    }

    /// Counterfactual values of every action for both players against strategies `x`
    /// (pusher's shove probabilities) and `y` (caller's call probabilities).
    pub fn values(&self, x: &[f64], y: &[f64]) -> ShoveValues {
        let g = &self.game;
        let (n0, n1) = (g.pusher.len(), g.caller.len());
        let p = &g.payoffs;
        let mut v = ShoveValues {
            shove: vec![0.0; n0],
            fold: vec![0.0; n0],
            call: vec![0.0; n1],
            pass: vec![0.0; n1],
            pusher_mass: vec![0.0; n0],
            caller_mass: vec![0.0; n1],
        };
        for i in 0..n0 {
            let row = i * n1;
            let (mut shove, mut mass) = (0.0, 0.0);
            let wi = g.pusher[i] * x[i];
            for j in 0..n1 {
                let c = g.compat[row + j] as f64;
                if c == 0.0 {
                    continue;
                }
                let (win, tie) = (g.outcome[row + j].0 as f64, g.outcome[row + j].1 as f64);
                let lose = 1.0 - win - tie;
                let wj = g.caller[j];
                mass += wj;
                let showdown0 = win * p.win[0] + tie * p.tie[0] + lose * p.lose[0];
                shove += wj * ((1.0 - y[j]) * p.steal[0] + y[j] * showdown0);
                // Caller side, weighted by the pusher's reach (shoving with hand i).
                if wi > 0.0 {
                    v.call[j] += wi * (win * p.win[1] + tie * p.tie[1] + lose * p.lose[1]);
                    v.pass[j] += wi * p.steal[1];
                    v.caller_mass[j] += wi;
                }
            }
            v.shove[i] = shove;
            v.fold[i] = mass * p.fold[0];
            v.pusher_mass[i] = mass;
        }
        v
    }

    /// One iteration: update the pusher, then the caller (alternating updates).
    pub fn iterate(&mut self) {
        self.iteration += 1;
        let t = self.iteration;
        let (dp, dn, ds) = self.algorithm.discounts(t);
        let w = self.algorithm.strategy_weight(t);
        let floor = self.algorithm.floors_regrets();
        for player in 0..2 {
            let x = Self::current(&self.regret[0]);
            let y = Self::current(&self.regret[1]);
            let v = self.values(&x, &y);
            let (act, pass, sigma, own) = if player == 0 {
                (&v.shove, &v.fold, &x, &self.game.pusher)
            } else {
                (&v.call, &v.pass, &y, &self.game.caller)
            };
            for h in 0..own.len() {
                let node = sigma[h] * act[h] + (1.0 - sigma[h]) * pass[h];
                for (a, value) in [act[h], pass[h]].into_iter().enumerate() {
                    let mut r = self.regret[player][h][a] + value - node;
                    if floor {
                        r = r.max(0.0);
                    }
                    self.regret[player][h][a] = r * if r > 0.0 { dp } else { dn };
                }
                let acc = &mut self.sum[player][h];
                acc[0] = (acc[0] + w * own[h] * sigma[h]) * ds;
                acc[1] = (acc[1] + w * own[h]) * ds;
            }
        }
    }

    /// Average probability of shoving (player 0) or calling (player 1) for each hand.
    pub fn average(&self, player: usize) -> Vec<f64> {
        self.sum[player]
            .iter()
            .map(|s| {
                if s[1] > 0.0 {
                    (s[0] / s[1]).clamp(0.0, 1.0)
                } else {
                    0.5
                }
            })
            .collect()
    }

    /// Values and exploitability of the average strategies.
    pub fn report(&self) -> ShoveReport {
        let (x, y) = (self.average(0), self.average(1));
        report_for(self, &x, &y)
    }
}

/// Values and NashConv/2 of a given strategy pair (also used for strategies from elsewhere).
pub fn report_for(solver: &ShoveSolver, x: &[f64], y: &[f64]) -> ShoveReport {
    let g = &solver.game;
    let v = solver.values(x, y);
    let z: f64 = g
        .pusher
        .iter()
        .zip(&v.pusher_mass)
        .map(|(w, m)| w * m)
        .sum();
    let mut u = [0.0; 2];
    let mut br = [0.0; 2];
    for i in 0..g.pusher.len() {
        let w = g.pusher[i];
        u[0] += w * (x[i] * v.shove[i] + (1.0 - x[i]) * v.fold[i]);
        br[0] += w * v.shove[i].max(v.fold[i]);
    }
    // Caller payoff when the pusher folds doesn't depend on the caller's strategy.
    let mut folded = 0.0;
    for i in 0..g.pusher.len() {
        folded += g.pusher[i] * (1.0 - x[i]) * v.pusher_mass[i] * g.payoffs.fold[1];
    }
    u[1] = folded;
    br[1] = folded;
    for j in 0..g.caller.len() {
        let w = g.caller[j];
        u[1] += w * (y[j] * v.call[j] + (1.0 - y[j]) * v.pass[j]);
        br[1] += w * v.call[j].max(v.pass[j]);
    }
    let (u, br) = ([u[0] / z, u[1] / z], [br[0] / z, br[1] / z]);
    ShoveReport {
        value: u,
        best_response: br,
        exploitability: ((br[0] - u[0]) + (br[1] - u[1])) / 2.0,
    }
}

/// Table and tournament situation for a heads-up push/fold decision.
#[derive(Clone, Debug, PartialEq)]
pub struct PushFoldSpot {
    /// Stacks (in big blinds) of every player at the table before posting.
    pub stacks: Vec<f64>,
    pub pusher: usize,
    pub caller: usize,
    pub small_blind: f64,
    pub big_blind: f64,
    /// Ante per player (every player at the table posts it).
    pub ante: f64,
    /// Prize for each place (1st, 2nd, ...). Empty = chip EV.
    pub payouts: Vec<f64>,
}

impl PushFoldSpot {
    /// Two players, equal stacks, chip EV.
    pub fn heads_up(stack_bb: f64) -> PushFoldSpot {
        PushFoldSpot {
            stacks: vec![stack_bb, stack_bb],
            pusher: 0,
            caller: 1,
            small_blind: 0.5,
            big_blind: 1.0,
            ante: 0.0,
            payouts: Vec::new(),
        }
    }

    /// Payoffs for every terminal: chip changes, or ICM $EV of the stacks after the hand.
    pub fn payoffs(&self) -> Result<Payoffs, String> {
        let n = self.stacks.len();
        let (p, c) = (self.pusher, self.caller);
        if n < 2 || p >= n || c >= n || p == c {
            return Err("pusher and caller must be two different players at the table".into());
        }
        let need = |i: usize, blind: f64| self.stacks[i] >= blind + self.ante;
        if !need(p, self.small_blind) || !need(c, self.big_blind) {
            return Err("each player needs at least the blind plus the ante".into());
        }
        let dead = self.ante * (n - 2) as f64;
        let outcome = |change_p: f64, change_c: f64| -> [f64; 2] {
            let mut after: Vec<f64> = self.stacks.iter().map(|s| s - self.ante).collect();
            // Pusher and caller: their antes are part of the changes passed in.
            after[p] = self.stacks[p] + change_p;
            after[c] = self.stacks[c] + change_c;
            if self.payouts.is_empty() {
                [change_p, change_c]
            } else {
                let ev = icm_equity(&after, &self.payouts);
                [ev[p], ev[c]]
            }
        };
        let matched = self.stacks[p].min(self.stacks[c]);
        Ok(Payoffs {
            fold: outcome(
                -(self.small_blind + self.ante),
                self.small_blind + self.ante + dead,
            ),
            steal: outcome(
                self.big_blind + self.ante + dead,
                -(self.big_blind + self.ante),
            ),
            win: outcome(matched + dead, -matched),
            tie: outcome(dead / 2.0, dead / 2.0),
            lose: outcome(-matched, matched + dead),
        })
    }
}

/// The push/fold game over all 1326 combos for each player, with exact card removal and
/// exact all-in equities.
pub fn hu_spot(spot: &PushFoldSpot, equity: &PairEquity) -> Result<ShoveGame, String> {
    let payoffs = spot.payoffs()?;
    let n = NUM_COMBOS;
    let mut compat = vec![0f32; n * n];
    let mut outcome = vec![(0f32, 0f32); n * n];
    for i in 0..n {
        for j in 0..n {
            if !COMBOS[i].cards().intersects(COMBOS[j].cards()) {
                compat[i * n + j] = 1.0;
                outcome[i * n + j] = equity.win_tie(i, j);
            }
        }
    }
    Ok(ShoveGame {
        pusher: vec![1.0; n],
        caller: vec![1.0; n],
        compat,
        outcome,
        payoffs,
    })
}

/// Solve until NashConv/2 is below `target` (payoff units) or `max_iterations` is reached,
/// checking every `check_every` iterations.
pub fn solve(
    game: ShoveGame,
    target: f64,
    max_iterations: u32,
    check_every: u32,
) -> (ShoveSolver, ShoveReport) {
    let mut s = ShoveSolver::new(game, Algorithm::DCFR_DEFAULT);
    loop {
        for _ in 0..check_every {
            s.iterate();
        }
        let r = s.report();
        if r.exploitability <= target || s.iterations() >= max_iterations {
            return (s, r);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Pusher holds a hand that always wins (weight p) or always loses (1 − p); the caller has
    /// one hand. Indifference gives the equilibrium in closed form:
    /// - caller indifferent ⇒ share of bluffs among shoves q = (S − 1) / (2S), so the losing
    ///   hand shoves x = p·q / ((1 − p)(1 − q));
    /// - losing hand indifferent ⇒ 1 − y − yS = −0.5 ⇒ y = 1.5 / (1 + S).
    #[test]
    fn matches_the_closed_form_toy_game() {
        let (s, p) = (10.0, 0.3);
        let game = ShoveGame {
            pusher: vec![p, 1.0 - p],
            caller: vec![1.0],
            compat: vec![1.0, 1.0],
            outcome: vec![(1.0, 0.0), (0.0, 0.0)],
            payoffs: Payoffs {
                fold: [-0.5, 0.5],
                steal: [1.0, -1.0],
                win: [s, -s],
                tie: [0.0, 0.0],
                lose: [-s, s],
            },
        };
        let (solver, report) = solve(game, 1e-9, 20_000, 100);
        let q = (s - 1.0) / (2.0 * s);
        let x_theory = p * q / ((1.0 - p) * (1.0 - q));
        let y_theory = 1.5 / (1.0 + s);
        let (x, y) = (solver.average(0), solver.average(1));
        assert!(x[0] > 0.999, "the winning hand always shoves: {x:?}");
        assert!(
            (x[1] - x_theory).abs() < 1e-3,
            "bluff frequency {} vs {x_theory}",
            x[1]
        );
        assert!(
            (y[0] - y_theory).abs() < 1e-3,
            "call frequency {} vs {y_theory}",
            y[0]
        );
        assert!(report.exploitability < 1e-4, "{report:?}");
    }

    #[test]
    fn chip_ev_payoffs() {
        let p = PushFoldSpot::heads_up(10.0).payoffs().unwrap();
        assert_eq!(p.fold, [-0.5, 0.5]);
        assert_eq!(p.steal, [1.0, -1.0]);
        assert_eq!(p.win, [10.0, -10.0]);
        assert_eq!(p.lose, [-10.0, 10.0]);
        assert_eq!(p.tie, [0.0, 0.0]);
        // Antes from three folded players are dead money for the two in the hand.
        let mut spot = PushFoldSpot::heads_up(10.0);
        spot.stacks = vec![10.0; 5];
        spot.ante = 0.1;
        let p = spot.payoffs().unwrap();
        assert!((p.steal[0] - (1.0 + 0.1 + 0.3)).abs() < 1e-12);
        assert!((p.win[0] - (10.0 + 0.3)).abs() < 1e-12);
        assert!((p.tie[0] - 0.15).abs() < 1e-12);
    }

    #[test]
    fn icm_payoffs_conserve_the_prize_pool_with_the_rest_of_the_table() {
        let spot = PushFoldSpot {
            stacks: vec![20.0, 15.0, 10.0],
            pusher: 1,
            caller: 2,
            small_blind: 0.5,
            big_blind: 1.0,
            ante: 0.0,
            payouts: vec![50.0, 30.0, 20.0],
        };
        let p = spot.payoffs().unwrap();
        // Busting the caller's 10 bb stack is worth less to the pusher than the chips suggest:
        // risk premium means winning gains less $EV than losing costs.
        let before = icm_equity(&spot.stacks, &spot.payouts);
        assert!(p.win[0] - before[1] < before[1] - p.lose[0]);
        // When the pusher (15 bb) wins, the caller (10 bb) busts and is paid exactly 3rd place.
        assert!((p.win[1] - 20.0).abs() < 1e-12, "{p:?}");
    }
}
