//! Tabular CFR for small games given as explicit trees (Kuhn, Leduc, toy games).
//!
//! This engine exists to validate the regret-update rules and the best-response code on
//! games with known answers. The poker solver (M3+) uses the same [`Algorithm`] rules,
//! vectorized over hands.
//!
//! References: Zinkevich et al. 2007 (CFR); Tammelin 2014 (CFR+);
//! Brown & Sandholm 2019, "Solving Imperfect-Information Games via Discounted Regret
//! Minimization" (DCFR).

use std::collections::HashMap;

/// Regret-update and averaging rule.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Algorithm {
    /// Plain CFR: regrets and strategies accumulate without discounting.
    Vanilla,
    /// CFR+: regrets floored at zero after every update; average strategy weighted by
    /// `max(t − delay, 0)` (linear averaging).
    CfrPlus { delay: u32 },
    /// Discounted CFR: after iteration t, positive regrets × tᵅ/(tᵅ+1), negative regrets
    /// × tᵝ/(tᵝ+1), strategy sums × (t/(t+1))ᵞ. The paper's recommended α=1.5, β=0, γ=2.
    Dcfr { alpha: f64, beta: f64, gamma: f64 },
}

impl Algorithm {
    pub const DCFR_DEFAULT: Algorithm = Algorithm::Dcfr {
        alpha: 1.5,
        beta: 0.0,
        gamma: 2.0,
    };
    pub const CFR_PLUS: Algorithm = Algorithm::CfrPlus { delay: 0 };

    pub fn name(&self) -> String {
        match self {
            Algorithm::Vanilla => "CFR".into(),
            Algorithm::CfrPlus { delay } => format!("CFR+ (delay {delay})"),
            Algorithm::Dcfr { alpha, beta, gamma } => {
                format!("DCFR (α={alpha}, β={beta}, γ={gamma})")
            }
        }
    }

    /// Weight of iteration `t`'s strategy in the running average (before discounting).
    fn strategy_weight(&self, t: u32) -> f64 {
        match self {
            Algorithm::CfrPlus { delay } => t.saturating_sub(*delay) as f64,
            _ => 1.0,
        }
    }

    /// Discount factors (positive regret, negative regret, strategy sum) applied after
    /// iteration `t` (1-based).
    fn discounts(&self, t: u32) -> (f64, f64, f64) {
        match *self {
            Algorithm::Dcfr { alpha, beta, gamma } => {
                let t = t as f64;
                let pa = t.powf(alpha);
                let pb = t.powf(beta);
                (
                    pa / (pa + 1.0),
                    pb / (pb + 1.0),
                    (t / (t + 1.0)).powf(gamma),
                )
            }
            _ => (1.0, 1.0, 1.0),
        }
    }

    fn floors_regrets(&self) -> bool {
        matches!(self, Algorithm::CfrPlus { .. })
    }
}

/// Node of an explicit two-player zero-sum game tree.
#[derive(Clone, Debug)]
pub enum Node {
    /// Payoff to player 0 (player 1 gets the negative).
    Terminal {
        payoff: f64,
    },
    Chance {
        children: Vec<(usize, f64)>,
    },
    Decision {
        player: usize,
        infoset: usize,
        children: Vec<usize>,
    },
}

#[derive(Clone, Debug)]
pub struct Infoset {
    pub key: String,
    pub player: usize,
    pub actions: Vec<String>,
}

/// Interface for describing a game; [`Tree::build`] turns it into an explicit tree.
pub trait Game {
    type State: Clone;
    fn root(&self) -> Self::State;
    fn step(&self, s: &Self::State) -> Step<Self::State>;
}

pub enum Step<S> {
    Terminal {
        payoff: f64,
    },
    Chance(Vec<(S, f64)>),
    Decision {
        player: usize,
        infoset: String,
        actions: Vec<(String, S)>,
    },
}

#[derive(Clone, Debug)]
pub struct Tree {
    pub nodes: Vec<Node>,
    pub infosets: Vec<Infoset>,
}

impl Tree {
    pub fn build<G: Game>(game: &G) -> Tree {
        let mut tree = Tree {
            nodes: Vec::new(),
            infosets: Vec::new(),
        };
        let mut index: HashMap<String, usize> = HashMap::new();
        tree.add(game, game.root(), &mut index);
        tree
    }

    fn add<G: Game>(&mut self, game: &G, s: G::State, index: &mut HashMap<String, usize>) -> usize {
        let id = self.nodes.len();
        self.nodes.push(Node::Terminal { payoff: 0.0 }); // placeholder, filled below
        let node = match game.step(&s) {
            Step::Terminal { payoff } => Node::Terminal { payoff },
            Step::Chance(outcomes) => {
                let total: f64 = outcomes.iter().map(|(_, p)| p).sum();
                assert!(
                    (total - 1.0).abs() < 1e-12,
                    "chance probabilities must sum to 1"
                );
                let children = outcomes
                    .into_iter()
                    .map(|(c, p)| (self.add(game, c, index), p))
                    .collect();
                Node::Chance { children }
            }
            Step::Decision {
                player,
                infoset,
                actions,
            } => {
                let labels: Vec<String> = actions.iter().map(|(l, _)| l.clone()).collect();
                let key = format!("{player}:{infoset}");
                let is = *index.entry(key.clone()).or_insert_with(|| {
                    self.infosets.push(Infoset {
                        key: infoset.clone(),
                        player,
                        actions: labels.clone(),
                    });
                    self.infosets.len() - 1
                });
                assert_eq!(
                    self.infosets[is].actions, labels,
                    "same infoset, different actions"
                );
                let children = actions
                    .into_iter()
                    .map(|(_, c)| self.add(game, c, index))
                    .collect();
                Node::Decision {
                    player,
                    infoset: is,
                    children,
                }
            }
        };
        self.nodes[id] = node;
        id
    }
}

/// A behaviour strategy: for each infoset, a probability per action.
pub type Strategy = Vec<Vec<f64>>;

fn regret_matching(regrets: &[f64], out: &mut [f64]) {
    let pos: f64 = regrets.iter().map(|r| r.max(0.0)).sum();
    if pos > 0.0 {
        for (o, r) in out.iter_mut().zip(regrets) {
            *o = r.max(0.0) / pos;
        }
    } else {
        out.fill(1.0 / out.len() as f64);
    }
}

pub struct Solver {
    pub tree: Tree,
    pub algorithm: Algorithm,
    regrets: Vec<Vec<f64>>,
    strategy_sum: Vec<Vec<f64>>,
    /// Current strategy σᵗ, fixed for the whole pass. An infoset can sit at many tree nodes
    /// (one per chance outcome it can't see), and all of them must use the same σᵗ even
    /// though its regrets are being accumulated during the pass.
    current: Strategy,
    iteration: u32,
}

impl Solver {
    pub fn new(tree: Tree, algorithm: Algorithm) -> Solver {
        let zeros: Vec<Vec<f64>> = tree
            .infosets
            .iter()
            .map(|i| vec![0.0; i.actions.len()])
            .collect();
        Solver {
            tree,
            algorithm,
            regrets: zeros.clone(),
            strategy_sum: zeros.clone(),
            current: zeros,
            iteration: 0,
        }
    }

    pub fn iterations(&self) -> u32 {
        self.iteration
    }

    /// One iteration: a regret update for each player in turn (alternating updates).
    pub fn iterate(&mut self) {
        self.iteration += 1;
        let t = self.iteration;
        for traverser in 0..2 {
            for (is, r) in self.regrets.iter().enumerate() {
                regret_matching(r, &mut self.current[is]);
            }
            self.walk(0, traverser, 1.0, 1.0, t);
            let (dp, dn, ds) = self.algorithm.discounts(t);
            let floor = self.algorithm.floors_regrets();
            for (is, info) in self.tree.infosets.iter().enumerate() {
                if info.player != traverser {
                    continue;
                }
                for r in self.regrets[is].iter_mut() {
                    *r *= if *r > 0.0 { dp } else { dn };
                    if floor {
                        *r = r.max(0.0);
                    }
                }
                for s in self.strategy_sum[is].iter_mut() {
                    *s *= ds;
                }
            }
        }
    }

    /// Returns the traverser's expected value at `node`. `reach_self` is the traverser's
    /// own reach probability, `reach_others` the product of opponent and chance reach.
    fn walk(
        &mut self,
        node: usize,
        traverser: usize,
        reach_self: f64,
        reach_others: f64,
        t: u32,
    ) -> f64 {
        match &self.tree.nodes[node] {
            Node::Terminal { payoff } => {
                if traverser == 0 {
                    *payoff
                } else {
                    -payoff
                }
            }
            Node::Chance { children } => {
                let children = children.clone();
                children
                    .iter()
                    .map(|&(c, p)| p * self.walk(c, traverser, reach_self, reach_others * p, t))
                    .sum()
            }
            Node::Decision {
                player,
                infoset,
                children,
            } => {
                let (player, is, children) = (*player, *infoset, children.clone());
                let sigma = self.current[is].clone();
                if player == traverser {
                    let values: Vec<f64> = children
                        .iter()
                        .zip(&sigma)
                        .map(|(&c, &p)| self.walk(c, traverser, reach_self * p, reach_others, t))
                        .collect();
                    let node_value: f64 = values.iter().zip(&sigma).map(|(v, p)| v * p).sum();
                    let w = self.algorithm.strategy_weight(t);
                    for a in 0..children.len() {
                        self.regrets[is][a] += reach_others * (values[a] - node_value);
                        self.strategy_sum[is][a] += w * reach_self * sigma[a];
                    }
                    node_value
                } else {
                    children
                        .iter()
                        .zip(&sigma)
                        .map(|(&c, &p)| {
                            p * self.walk(c, traverser, reach_self, reach_others * p, t)
                        })
                        .sum()
                }
            }
        }
    }

    /// The average strategy (the one that converges to equilibrium).
    pub fn average_strategy(&self) -> Strategy {
        self.strategy_sum
            .iter()
            .map(|s| {
                let total: f64 = s.iter().sum();
                if total > 0.0 {
                    s.iter().map(|x| x / total).collect()
                } else {
                    vec![1.0 / s.len() as f64; s.len()]
                }
            })
            .collect()
    }
}

/// Expected payoff to player 0 when both players follow `sigma`.
pub fn expected_value(tree: &Tree, sigma: &Strategy) -> f64 {
    fn ev(tree: &Tree, sigma: &Strategy, node: usize) -> f64 {
        match &tree.nodes[node] {
            Node::Terminal { payoff } => *payoff,
            Node::Chance { children } => {
                children.iter().map(|&(c, p)| p * ev(tree, sigma, c)).sum()
            }
            Node::Decision {
                infoset, children, ..
            } => children
                .iter()
                .zip(&sigma[*infoset])
                .map(|(&c, &p)| p * ev(tree, sigma, c))
                .sum(),
        }
    }
    ev(tree, sigma, 0)
}

/// Value of a best response for `player` against the other player's part of `sigma`
/// (payoff to `player`). The responder must choose one action per information set, so for
/// each infoset we compare actions by Σ over its histories of (opponent·chance reach ×
/// child value), resolving deeper infosets first (recursion + memoization; perfect recall
/// guarantees this terminates).
pub fn best_response_value(tree: &Tree, sigma: &Strategy, player: usize) -> f64 {
    // Histories of each of the responder's infosets, with their opponent·chance reach.
    let mut members: Vec<Vec<(usize, f64)>> = vec![Vec::new(); tree.infosets.len()];
    fn collect(
        tree: &Tree,
        sigma: &Strategy,
        player: usize,
        node: usize,
        reach: f64,
        out: &mut Vec<Vec<(usize, f64)>>,
    ) {
        match &tree.nodes[node] {
            Node::Terminal { .. } => {}
            Node::Chance { children } => {
                for &(c, p) in children {
                    collect(tree, sigma, player, c, reach * p, out);
                }
            }
            Node::Decision {
                player: p,
                infoset,
                children,
            } => {
                if *p == player {
                    out[*infoset].push((node, reach));
                    for &c in children {
                        collect(tree, sigma, player, c, reach, out);
                    }
                } else {
                    for (&c, &q) in children.iter().zip(&sigma[*infoset]) {
                        collect(tree, sigma, player, c, reach * q, out);
                    }
                }
            }
        }
    }
    collect(tree, sigma, player, 0, 1.0, &mut members);

    struct Ctx<'a> {
        tree: &'a Tree,
        sigma: &'a Strategy,
        player: usize,
        members: Vec<Vec<(usize, f64)>>,
        choice: Vec<Option<usize>>,
    }
    fn value(ctx: &mut Ctx, node: usize) -> f64 {
        match &ctx.tree.nodes[node] {
            Node::Terminal { payoff } => {
                if ctx.player == 0 {
                    *payoff
                } else {
                    -payoff
                }
            }
            Node::Chance { children } => {
                let children = children.clone();
                children.iter().map(|&(c, p)| p * value(ctx, c)).sum()
            }
            Node::Decision {
                player,
                infoset,
                children,
            } => {
                let (player, is, children) = (*player, *infoset, children.clone());
                if player == ctx.player {
                    let a = choose(ctx, is);
                    value(ctx, children[a])
                } else {
                    let probs = ctx.sigma[is].clone();
                    children
                        .iter()
                        .zip(&probs)
                        .map(|(&c, &p)| p * value(ctx, c))
                        .sum()
                }
            }
        }
    }
    fn choose(ctx: &mut Ctx, is: usize) -> usize {
        if let Some(a) = ctx.choice[is] {
            return a;
        }
        let n = ctx.tree.infosets[is].actions.len();
        let mut totals = vec![0.0; n];
        for (node, reach) in ctx.members[is].clone() {
            let Node::Decision { children, .. } = &ctx.tree.nodes[node] else {
                unreachable!()
            };
            for (a, c) in children.clone().into_iter().enumerate() {
                totals[a] += reach * value(ctx, c);
            }
        }
        // Ties broken toward the lowest action index, deterministically.
        let mut best = 0;
        for a in 1..n {
            if totals[a] > totals[best] {
                best = a;
            }
        }
        ctx.choice[is] = Some(best);
        best
    }
    let mut ctx = Ctx {
        tree,
        sigma,
        player,
        members,
        choice: vec![None; tree.infosets.len()],
    };
    value(&mut ctx, 0)
}

/// Exploitability = NashConv / 2 = (BR₀ + BR₁ − (u₀ + u₁)) / 2, in the game's payoff units.
/// Zero exactly at a Nash equilibrium (D-014).
pub fn exploitability(tree: &Tree, sigma: &Strategy) -> f64 {
    let u0 = expected_value(tree, sigma);
    let br0 = best_response_value(tree, sigma, 0);
    let br1 = best_response_value(tree, sigma, 1);
    ((br0 - u0) + (br1 + u0)) / 2.0
}

/// Best-response value found by brute force: try every pure strategy of `player` (one action
/// per infoset) against the opponent's part of `sigma`. Exponential, so only for tiny games;
/// it shares no code with [`best_response_value`] and is used to cross-check it.
pub fn brute_force_best_response_value(tree: &Tree, sigma: &Strategy, player: usize) -> f64 {
    let mine: Vec<usize> = (0..tree.infosets.len())
        .filter(|&i| tree.infosets[i].player == player)
        .collect();
    let sizes: Vec<usize> = mine
        .iter()
        .map(|&i| tree.infosets[i].actions.len())
        .collect();
    let total: usize = sizes.iter().product();
    assert!(total <= 1 << 20, "too many pure strategies for brute force");
    let mut best = f64::NEG_INFINITY;
    let mut pure = sigma.clone();
    for code in 0..total {
        let mut c = code;
        for (k, &is) in mine.iter().enumerate() {
            let a = c % sizes[k];
            c /= sizes[k];
            pure[is] = (0..sizes[k])
                .map(|x| if x == a { 1.0 } else { 0.0 })
                .collect();
        }
        let v = expected_value(tree, &pure);
        best = best.max(if player == 0 { v } else { -v });
    }
    best
}
