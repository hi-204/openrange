//! Heads-up postflop game solved by CFR vectorized over hands.
//!
//! One traversal handles every hand of both players at once: values and reach probabilities
//! are vectors indexed by each player's hand list. Terminal nodes are evaluated in O(n) per
//! node with the sorted-strength sweep and per-card accumulators (docs/ARCHITECTURE.md §1.8).
//!
//! Units: chips are centi-bb. Payoffs are measured from the start of the spot: a player's
//! payoff is what they win from the pot minus what they put in after the spot started, so the
//! starting pot is "dead money" both players are fighting over.

use super::tree::{Action, NodeKind, Street, Tree, TreeConfig};
use crate::cards::{Card, CardSet, Combo, NUM_COMBOS};
use crate::cfr::Algorithm;
use crate::eval::{Evaluator, HandKey};
use crate::range::Range;
use std::collections::HashMap;

const NONE: u32 = u32::MAX;

#[derive(Clone, Debug)]
pub struct SpotConfig {
    pub tree: TreeConfig,
    pub board: Vec<Card>,
    /// `ranges[0]` is out of position, `ranges[1]` in position.
    pub ranges: [Range; 2],
}

/// A node of the card-expanded game: one action-tree node under one specific board.
#[derive(Clone, Debug)]
struct ENode {
    tree_node: usize,
    board: CardSet,
    /// River strength table index (river nodes only).
    river: u32,
    children: Vec<usize>,
    /// Chance nodes: the card dealt to reach each child.
    cards: Vec<Card>,
    /// Action nodes: offset into the regret / strategy-sum storage.
    offset: usize,
}

#[derive(Clone, Debug)]
struct RiverTable {
    strength: [Vec<u16>; 2],
    /// Hand indices sorted by strength (ascending), excluding hands blocked by the board.
    order: [Vec<u32>; 2],
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Exploitability {
    /// NashConv / 2 in chips (centi-bb).
    pub chips: f64,
    pub bb: f64,
    /// As a percentage of the starting pot.
    pub pct_pot: f64,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
    /// CFR update for the traverser at iteration t.
    Train(u32),
    /// Traverser best-responds; opponent plays its average strategy.
    BestResponse,
    /// Both play average strategies.
    Average,
}

pub struct PostflopGame {
    pub config: SpotConfig,
    pub tree: Tree,
    pub algorithm: Algorithm,
    hands: [Vec<Combo>; 2],
    init: [Vec<f32>; 2],
    /// Index of the identical combo in the other player's list, or NONE.
    same: [Vec<u32>; 2],
    nodes: Vec<ENode>,
    rivers: Vec<RiverTable>,
    regrets: Vec<f32>,
    strategy_sum: Vec<f32>,
    iteration: u32,
    /// Σ_h w₀(h)·(compatible opponent weight): normalizes values into per-hand-pair EVs.
    pair_weight: f64,
}

/// Estimated memory for a spot, in bytes (storage + strength tables + overhead), computed
/// without allocating the solver.
pub fn estimate_memory(cfg: &SpotConfig) -> Result<usize, String> {
    let g = Skeleton::new(cfg)?;
    Ok(g.bytes)
}

/// Builds hand lists and the expanded node list; shared by the estimator and the solver.
struct Skeleton {
    tree: Tree,
    hands: [Vec<Combo>; 2],
    init: [Vec<f32>; 2],
    nodes: Vec<ENode>,
    river_boards: Vec<CardSet>,
    storage: usize,
    bytes: usize,
}

impl Skeleton {
    fn new(cfg: &SpotConfig) -> Result<Skeleton, String> {
        let street =
            Street::from_board_len(cfg.board.len()).ok_or("the board must have 3, 4 or 5 cards")?;
        if street != cfg.tree.street {
            return Err("the board size doesn't match the street of the tree".into());
        }
        let board = CardSet::from_cards(&cfg.board);
        if board.len() as usize != cfg.board.len() {
            return Err("the board has a repeated card".into());
        }
        let tree = Tree::build(&cfg.tree)?;
        let mut hands: [Vec<Combo>; 2] = [Vec::new(), Vec::new()];
        let mut init: [Vec<f32>; 2] = [Vec::new(), Vec::new()];
        for p in 0..2 {
            for (c, w) in cfg.ranges[p].without(board).iter() {
                hands[p].push(c);
                init[p].push(w);
            }
            if hands[p].is_empty() {
                let who = if p == 0 {
                    "out-of-position"
                } else {
                    "in-position"
                };
                return Err(format!("the {who} range has no hands left on this board"));
            }
        }
        let mut sk = Skeleton {
            tree,
            hands,
            init,
            nodes: Vec::new(),
            river_boards: Vec::new(),
            storage: 0,
            bytes: 0,
        };
        let mut river_index: HashMap<u64, u32> = HashMap::new();
        sk.expand(0, board, &mut river_index);
        let n = sk.hands[0].len() + sk.hands[1].len();
        sk.bytes = sk.storage * 8 // regrets + strategy sums, f32 each
            + sk.river_boards.len() * n * (2 + 4) // strengths (u16) + order (u32)
            + sk.nodes.len() * std::mem::size_of::<ENode>()
            + 64 * n * 4 * 8 // traversal scratch (depth × vectors), generous
            + (1 << 20); // evaluator tables and fixed overhead
        Ok(sk)
    }

    fn expand(
        &mut self,
        tree_node: usize,
        board: CardSet,
        rivers: &mut HashMap<u64, u32>,
    ) -> usize {
        let id = self.nodes.len();
        let street = self.tree.nodes[tree_node].street;
        let river = if street == Street::River {
            let next = rivers.len() as u32;
            *rivers.entry(board.0).or_insert_with(|| {
                self.river_boards.push(board);
                next
            })
        } else {
            NONE
        };
        self.nodes.push(ENode {
            tree_node,
            board,
            river,
            children: Vec::new(),
            cards: Vec::new(),
            offset: 0,
        });
        match self.tree.nodes[tree_node].kind.clone() {
            NodeKind::Action {
                player,
                actions,
                children,
            } => {
                self.nodes[id].offset = self.storage;
                self.storage += actions.len() * self.hands[player].len();
                let kids: Vec<usize> = children
                    .iter()
                    .map(|&c| self.expand(c, board, rivers))
                    .collect();
                self.nodes[id].children = kids;
            }
            NodeKind::Chance { child, .. } => {
                let mut kids = Vec::new();
                let mut cards = Vec::new();
                for i in 0..52u8 {
                    let c = Card::from_index(i);
                    if board.contains(c) {
                        continue;
                    }
                    let mut b = board;
                    b.insert(c);
                    kids.push(self.expand(child, b, rivers));
                    cards.push(c);
                }
                self.nodes[id].children = kids;
                self.nodes[id].cards = cards;
            }
            NodeKind::Fold { .. } | NodeKind::Showdown => {}
        }
        id
    }
}

fn regret_match(regrets: &[f32], n_actions: usize, n: usize, out: &mut [f32]) {
    for h in 0..n {
        let mut pos = 0.0f32;
        for a in 0..n_actions {
            pos += regrets[a * n + h].max(0.0);
        }
        for a in 0..n_actions {
            out[a * n + h] = if pos > 0.0 {
                regrets[a * n + h].max(0.0) / pos
            } else {
                1.0 / n_actions as f32
            };
        }
    }
}

impl PostflopGame {
    pub fn new(config: SpotConfig, algorithm: Algorithm) -> Result<PostflopGame, String> {
        let sk = Skeleton::new(&config)?;
        let Skeleton {
            tree,
            hands,
            init,
            nodes,
            river_boards,
            storage,
            ..
        } = sk;

        // Identical-combo lookup between the two lists.
        let mut pos = [[NONE; NUM_COMBOS], [NONE; NUM_COMBOS]];
        for p in 0..2 {
            for (i, c) in hands[p].iter().enumerate() {
                pos[p][c.index()] = i as u32;
            }
        }
        let same: [Vec<u32>; 2] =
            [0, 1].map(|p| hands[p].iter().map(|c| pos[1 - p][c.index()]).collect());

        let e = Evaluator::get();
        let rivers: Vec<RiverTable> = river_boards
            .iter()
            .map(|&b| {
                let key = HandKey::from_cards(&b.iter().collect::<Vec<_>>());
                let mk = |p: usize| -> (Vec<u16>, Vec<u32>) {
                    let strength: Vec<u16> = hands[p]
                        .iter()
                        .map(|c| {
                            if c.cards().intersects(b) {
                                0
                            } else {
                                e.eval_key(key.with(c.hi).with(c.lo)).0
                            }
                        })
                        .collect();
                    let mut order: Vec<u32> = (0..hands[p].len() as u32)
                        .filter(|&i| !hands[p][i as usize].cards().intersects(b))
                        .collect();
                    order.sort_by_key(|&i| (strength[i as usize], i));
                    (strength, order)
                };
                let (s0, o0) = mk(0);
                let (s1, o1) = mk(1);
                RiverTable {
                    strength: [s0, s1],
                    order: [o0, o1],
                }
            })
            .collect();

        let mut game = PostflopGame {
            config,
            tree,
            algorithm,
            hands,
            init,
            same,
            nodes,
            rivers,
            regrets: vec![0.0; storage],
            strategy_sum: vec![0.0; storage],
            iteration: 0,
            pair_weight: 0.0,
        };
        let compat = game.compatible(0, &game.init[1].clone());
        game.pair_weight = game.init[0]
            .iter()
            .zip(&compat)
            .map(|(&w, &c)| w as f64 * c)
            .sum();
        if game.pair_weight <= 0.0 {
            return Err("the two ranges never fit together (every pair shares a card)".into());
        }
        Ok(game)
    }

    pub fn hands(&self, player: usize) -> &[Combo] {
        &self.hands[player]
    }

    pub fn initial_weights(&self, player: usize) -> &[f32] {
        &self.init[player]
    }

    pub fn iterations(&self) -> u32 {
        self.iteration
    }

    pub fn storage_entries(&self) -> usize {
        self.regrets.len()
    }

    /// For each hand of `player`: total opponent reach over hands that share no card with it.
    fn compatible(&self, player: usize, opp_reach: &[f32]) -> Vec<f64> {
        let opp = 1 - player;
        let mut card = [0f64; 52];
        let mut total = 0f64;
        for (j, c) in self.hands[opp].iter().enumerate() {
            let w = opp_reach[j] as f64;
            total += w;
            card[c.hi.index() as usize] += w;
            card[c.lo.index() as usize] += w;
        }
        self.hands[player]
            .iter()
            .enumerate()
            .map(|(i, c)| {
                let same = self.same[player][i];
                let back = if same == NONE {
                    0.0
                } else {
                    opp_reach[same as usize] as f64
                };
                total - card[c.hi.index() as usize] - card[c.lo.index() as usize] + back
            })
            .collect()
    }

    /// One iteration of CFR: an update pass for each player.
    pub fn iterate(&mut self) {
        self.iteration += 1;
        let t = self.iteration;
        for trav in 0..2 {
            let (own, opp) = (self.init[trav].clone(), self.init[1 - trav].clone());
            let mut out = vec![0f32; self.hands[trav].len()];
            self.walk(0, trav, &own, &opp, Mode::Train(t), &mut out);
        }
    }

    /// Counterfactual values for `trav`'s hands at expanded node `e`.
    fn walk(
        &mut self,
        e: usize,
        trav: usize,
        own: &[f32],
        opp: &[f32],
        mode: Mode,
        out: &mut [f32],
    ) {
        let tn = self.nodes[e].tree_node;
        let n_t = self.hands[trav].len();
        match self.tree.nodes[tn].kind.clone() {
            NodeKind::Fold { folder } => self.fold_value(e, trav, folder, opp, out),
            NodeKind::Showdown => self.showdown_value(e, trav, opp, out),
            NodeKind::Chance { .. } => {
                out.fill(0.0);
                let children = self.nodes[e].children.clone();
                let cards = self.nodes[e].cards.clone();
                // Each card is equally likely given both hands: 1 / (cards left − 4 hole cards).
                let weight = 1.0 / (52 - self.nodes[e].board.len() as usize - 4) as f32;
                let mut own_c = own.to_vec();
                let mut opp_c = opp.to_vec();
                let mut tmp = vec![0f32; n_t];
                for (k, &child) in children.iter().enumerate() {
                    let bit = cards[k].bit();
                    for (i, c) in self.hands[trav].iter().enumerate() {
                        own_c[i] = if c.cards().0 & bit != 0 { 0.0 } else { own[i] };
                    }
                    for (j, c) in self.hands[1 - trav].iter().enumerate() {
                        opp_c[j] = if c.cards().0 & bit != 0 { 0.0 } else { opp[j] };
                    }
                    self.walk(child, trav, &own_c, &opp_c, mode, &mut tmp);
                    for (i, c) in self.hands[trav].iter().enumerate() {
                        if c.cards().0 & bit == 0 {
                            out[i] += weight * tmp[i];
                        }
                    }
                }
            }
            NodeKind::Action {
                player, actions, ..
            } => {
                let n_a = actions.len();
                let n_p = self.hands[player].len();
                let offset = self.nodes[e].offset;
                let children = self.nodes[e].children.clone();
                let mut sigma = vec![0f32; n_a * n_p];
                // Training uses the current (regret-matched) strategies; evaluation uses averages.
                if !matches!(mode, Mode::Train(_)) {
                    self.average_into(offset, n_a, n_p, &mut sigma);
                } else {
                    regret_match(
                        &self.regrets[offset..offset + n_a * n_p],
                        n_a,
                        n_p,
                        &mut sigma,
                    );
                }
                if player == trav {
                    let mut child_vals = vec![0f32; n_a * n_t];
                    let mut own_a = vec![0f32; n_t];
                    for a in 0..n_a {
                        for h in 0..n_t {
                            own_a[h] = own[h] * sigma[a * n_t + h];
                        }
                        self.walk(
                            children[a],
                            trav,
                            &own_a,
                            opp,
                            mode,
                            &mut child_vals[a * n_t..(a + 1) * n_t],
                        );
                    }
                    match mode {
                        Mode::BestResponse => {
                            for h in 0..n_t {
                                out[h] = (0..n_a)
                                    .map(|a| child_vals[a * n_t + h])
                                    .fold(f32::NEG_INFINITY, f32::max);
                            }
                        }
                        Mode::Average => {
                            for h in 0..n_t {
                                out[h] = (0..n_a)
                                    .map(|a| sigma[a * n_t + h] * child_vals[a * n_t + h])
                                    .sum();
                            }
                        }
                        Mode::Train(t) => {
                            for h in 0..n_t {
                                out[h] = (0..n_a)
                                    .map(|a| sigma[a * n_t + h] * child_vals[a * n_t + h])
                                    .sum();
                            }
                            let (dp, dn, ds) = self.algorithm.discounts(t);
                            let (dp, dn, ds) = (dp as f32, dn as f32, ds as f32);
                            let w = self.algorithm.strategy_weight(t) as f32;
                            let floor = self.algorithm.floors_regrets();
                            for a in 0..n_a {
                                for h in 0..n_t {
                                    let i = offset + a * n_t + h;
                                    let mut r = self.regrets[i] + child_vals[a * n_t + h] - out[h];
                                    if floor {
                                        r = r.max(0.0);
                                    }
                                    self.regrets[i] = r * if r > 0.0 { dp } else { dn };
                                    self.strategy_sum[i] = (self.strategy_sum[i]
                                        + w * own[h] * sigma[a * n_t + h])
                                        * ds;
                                }
                            }
                        }
                    }
                } else {
                    out.fill(0.0);
                    let mut tmp = vec![0f32; n_t];
                    let mut opp_a = vec![0f32; n_p];
                    for a in 0..n_a {
                        for j in 0..n_p {
                            opp_a[j] = opp[j] * sigma[a * n_p + j];
                        }
                        self.walk(children[a], trav, own, &opp_a, mode, &mut tmp);
                        for h in 0..n_t {
                            out[h] += tmp[h];
                        }
                    }
                }
            }
        }
    }

    fn average_into(&self, offset: usize, n_a: usize, n: usize, out: &mut [f32]) {
        let s = &self.strategy_sum[offset..offset + n_a * n];
        for h in 0..n {
            let total: f32 = (0..n_a).map(|a| s[a * n + h]).sum();
            for a in 0..n_a {
                out[a * n + h] = if total > 0.0 {
                    s[a * n + h] / total
                } else {
                    1.0 / n_a as f32
                };
            }
        }
    }

    /// Final pot (excluding any uncalled bet) and the winner's/loser's payoffs, from the
    /// traverser's point of view.
    fn payoffs(&self, tn: usize) -> (f64, [i64; 2]) {
        let node = &self.tree.nodes[tn];
        let matched = node.invested[0].min(node.invested[1]);
        let pot = self.config.tree.pot + 2 * matched;
        let rake = self.config.tree.rake.of(pot);
        (pot as f64 - rake, node.invested)
    }

    fn fold_value(&self, e: usize, trav: usize, folder: usize, opp: &[f32], out: &mut [f32]) {
        let tn = self.nodes[e].tree_node;
        let (net_pot, invested) = self.payoffs(tn);
        let matched = invested[0].min(invested[1]) as f64;
        // Winner takes the contested pot; the uncalled part of a bet simply returns.
        let payoff = if folder == trav {
            -(invested[trav] as f64)
        } else {
            net_pot - matched
        };
        let board = self.nodes[e].board;
        let compat = self.compatible(trav, opp);
        for (i, c) in self.hands[trav].iter().enumerate() {
            out[i] = if c.cards().intersects(board) {
                0.0
            } else {
                (payoff * compat[i]) as f32
            };
        }
    }

    fn showdown_value(&self, e: usize, trav: usize, opp: &[f32], out: &mut [f32]) {
        let tn = self.nodes[e].tree_node;
        let (net_pot, invested) = self.payoffs(tn);
        let mine = invested[trav] as f64;
        let (win, tie, lose) = (net_pot - mine, net_pot / 2.0 - mine, -mine);
        let table = &self.rivers[self.nodes[e].river as usize];
        let o = 1 - trav;
        let (st, so) = (&table.strength[trav], &table.strength[o]);
        let (ot, oo) = (&table.order[trav], &table.order[o]);

        let mut all_card = [0f64; 52];
        let mut all_total = 0f64;
        for &j in oo {
            let c = self.hands[o][j as usize];
            let w = opp[j as usize] as f64;
            all_total += w;
            all_card[c.hi.index() as usize] += w;
            all_card[c.lo.index() as usize] += w;
        }
        let (mut less_card, mut le_card) = ([0f64; 52], [0f64; 52]);
        let (mut less_total, mut le_total) = (0f64, 0f64);
        let (mut p_less, mut p_le) = (0usize, 0usize);
        out.fill(0.0);
        for &i in ot {
            let i = i as usize;
            let s = st[i];
            while p_less < oo.len() && so[oo[p_less] as usize] < s {
                let j = oo[p_less] as usize;
                let (c, w) = (self.hands[o][j], opp[j] as f64);
                less_total += w;
                less_card[c.hi.index() as usize] += w;
                less_card[c.lo.index() as usize] += w;
                p_less += 1;
            }
            while p_le < oo.len() && so[oo[p_le] as usize] <= s {
                let j = oo[p_le] as usize;
                let (c, w) = (self.hands[o][j], opp[j] as f64);
                le_total += w;
                le_card[c.hi.index() as usize] += w;
                le_card[c.lo.index() as usize] += w;
                p_le += 1;
            }
            let c = self.hands[trav][i];
            let (a, b) = (c.hi.index() as usize, c.lo.index() as usize);
            let same = self.same[trav][i];
            let back = if same == NONE {
                0.0
            } else {
                opp[same as usize] as f64
            };
            let less = less_total - less_card[a] - less_card[b];
            let le = le_total - le_card[a] - le_card[b] + back;
            let total = all_total - all_card[a] - all_card[b] + back;
            out[i] = (less * win + (le - less) * tie + (total - le) * lose) as f32;
        }
    }

    /// Expected payoff (chips) of each player when both play their average strategies.
    pub fn expected_values(&mut self) -> [f64; 2] {
        [0, 1].map(|p| self.root_value(p, Mode::Average))
    }

    fn root_value(&mut self, p: usize, mode: Mode) -> f64 {
        let (own, opp) = (self.init[p].clone(), self.init[1 - p].clone());
        let mut out = vec![0f32; self.hands[p].len()];
        self.walk(0, p, &own, &opp, mode, &mut out);
        own.iter()
            .zip(&out)
            .map(|(&w, &v)| w as f64 * v as f64)
            .sum::<f64>()
            / self.pair_weight
    }

    /// Best-response value (chips) for `player` against the other's average strategy.
    pub fn best_response_value(&mut self, player: usize) -> f64 {
        self.root_value(player, Mode::BestResponse)
    }

    pub fn exploitability(&mut self) -> Exploitability {
        let ev = self.expected_values();
        let br = [self.best_response_value(0), self.best_response_value(1)];
        let chips = ((br[0] - ev[0]) + (br[1] - ev[1])) / 2.0;
        Exploitability {
            chips,
            bb: chips / super::tree::BB as f64,
            pct_pot: 100.0 * chips / self.config.tree.pot as f64,
        }
    }

    /// Average strategy at an action node reached by following `path` (action indices; at
    /// chance nodes the index is into the dealt-card list). Returns per-hand probabilities
    /// laid out `[action][hand]` for the acting player.
    pub fn node(&mut self, path: &[usize]) -> Result<NodeView, String> {
        let mut e = 0usize;
        let mut reach = [self.init[0].clone(), self.init[1].clone()];
        // The board in the order the user gave it, then cards dealt along the path.
        let mut board = self.config.board.clone();
        for (depth, &step) in path.iter().enumerate() {
            let tn = self.nodes[e].tree_node;
            match self.tree.nodes[tn].kind.clone() {
                NodeKind::Action {
                    player, actions, ..
                } => {
                    if step >= actions.len() {
                        return Err(format!("step {depth}: no action {step}"));
                    }
                    let n_a = actions.len();
                    let n = self.hands[player].len();
                    let mut sigma = vec![0f32; n_a * n];
                    self.average_into(self.nodes[e].offset, n_a, n, &mut sigma);
                    for h in 0..n {
                        reach[player][h] *= sigma[step * n + h];
                    }
                }
                NodeKind::Chance { .. } => {
                    let card = *self.nodes[e]
                        .cards
                        .get(step)
                        .ok_or(format!("step {depth}: no card {step}"))?;
                    board.push(card);
                    for (r, hands) in reach.iter_mut().zip(&self.hands) {
                        for (w, c) in r.iter_mut().zip(hands) {
                            if c.cards().contains(card) {
                                *w = 0.0;
                            }
                        }
                    }
                }
                _ => return Err(format!("step {depth}: the hand is already over")),
            }
            e = self.nodes[e].children[step];
        }
        let tn = self.nodes[e].tree_node;
        let node = self.tree.nodes[tn].clone();
        let (street, pot, committed) = (node.street, node.pot(), node.committed);
        match node.kind {
            NodeKind::Action {
                player, actions, ..
            } => {
                let n_a = actions.len();
                let n = self.hands[player].len();
                let mut strategy = vec![0f32; n_a * n];
                self.average_into(self.nodes[e].offset, n_a, n, &mut strategy);
                // Per-action EV for each hand: child value with both on average strategies,
                // divided by the compatible opponent weight that reaches this node.
                let opp = reach[1 - player].clone();
                let compat = self.compatible(player, &opp);
                let children = self.nodes[e].children.clone();
                let mut ev = vec![0f32; n_a * n];
                let mut tmp = vec![0f32; n];
                let own = reach[player].clone();
                for a in 0..n_a {
                    self.walk(children[a], player, &own, &opp, Mode::Average, &mut tmp);
                    for h in 0..n {
                        ev[a * n + h] = if compat[h] > 0.0 {
                            (tmp[h] as f64 / compat[h]) as f32
                        } else {
                            f32::NAN
                        };
                    }
                }
                Ok(NodeView {
                    kind: ViewKind::Action {
                        player,
                        actions,
                        strategy,
                        ev,
                    },
                    street,
                    board,
                    pot,
                    committed,
                    reach,
                })
            }
            NodeKind::Chance { .. } => {
                let cards = self.nodes[e].cards.clone();
                Ok(NodeView {
                    kind: ViewKind::Chance { cards },
                    street,
                    board,
                    pot,
                    committed,
                    reach,
                })
            }
            NodeKind::Fold { folder } => Ok(NodeView {
                kind: ViewKind::Fold { folder },
                street,
                board,
                pot,
                committed,
                reach,
            }),
            NodeKind::Showdown => Ok(NodeView {
                kind: ViewKind::Showdown,
                street,
                board,
                pot,
                committed,
                reach,
            }),
        }
    }

    /// Average strategy `[action][hand]` at an action node of a river-only game, addressed by
    /// action-tree node id (for river spots expanded and tree node ids coincide).
    pub fn river_average(&self, tree_node: usize) -> Option<Vec<f32>> {
        let e = self
            .nodes
            .get(tree_node)
            .filter(|e| e.tree_node == tree_node)?;
        let NodeKind::Action {
            player, actions, ..
        } = &self.tree.nodes[tree_node].kind
        else {
            return None;
        };
        let n = self.hands[*player].len();
        let mut out = vec![0f32; actions.len() * n];
        self.average_into(e.offset, actions.len(), n, &mut out);
        Some(out)
    }

    /// Bitwise fingerprint of the solver state (for determinism tests and goldens).
    pub fn fingerprint(&self) -> u64 {
        // FNV-1a over the raw bits of the strategy sums.
        let mut h: u64 = 0xcbf2_9ce4_8422_2325;
        for x in &self.strategy_sum {
            for b in x.to_bits().to_le_bytes() {
                h ^= b as u64;
                h = h.wrapping_mul(0x0100_0000_01b3);
            }
        }
        h
    }
}

#[derive(Clone, Debug)]
pub enum ViewKind {
    Action {
        player: usize,
        actions: Vec<Action>,
        strategy: Vec<f32>,
        ev: Vec<f32>,
    },
    Chance {
        cards: Vec<Card>,
    },
    Fold {
        folder: usize,
    },
    Showdown,
}

#[derive(Clone, Debug)]
pub struct NodeView {
    pub kind: ViewKind,
    pub street: Street,
    pub board: Vec<Card>,
    pub pot: i64,
    pub committed: [i64; 2],
    /// Each player's reach (range weight) for every hand at this node.
    pub reach: [Vec<f32>; 2],
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::parse_cards;
    use crate::iso::{permute_card, permute_combo};
    use crate::postflop::tree::{BetSizes, Size, StreetSizes};

    fn spot(board: &str, oop: &str, ip: &str, bet: &str, raise: &str) -> SpotConfig {
        let s = BetSizes {
            bet: Size::parse_list(bet).unwrap(),
            raise: Size::parse_list(raise).unwrap(),
        };
        let ss = StreetSizes {
            oop: s.clone(),
            ip: s,
        };
        SpotConfig {
            tree: TreeConfig {
                street: Street::River,
                pot: 1000,
                stack: 5000,
                sizes: [ss.clone(), ss.clone(), ss],
                max_raises: 2,
                allin_threshold: 0.67,
                rake: Default::default(),
            },
            board: parse_cards(board).unwrap(),
            ranges: [Range::parse(oop).unwrap(), Range::parse(ip).unwrap()],
        }
    }

    fn solved(cfg: &SpotConfig, iters: u32) -> PostflopGame {
        let mut g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT).unwrap();
        for _ in 0..iters {
            g.iterate();
        }
        g
    }

    const OOP: &str = "TT+, AJs+, KQs, 98s, 76s, AQo+";
    const IP: &str = "99+, ATs+, KJs+, QJs, JTs, T9s, AJo+, KQo";

    #[test]
    fn same_inputs_give_bit_identical_results() {
        let cfg = spot("Ks Th 7d 4c 2s", OOP, IP, "50, 100", "100");
        let (a, b) = (solved(&cfg, 300), solved(&cfg, 300));
        assert_eq!(a.fingerprint(), b.fingerprint());
    }

    #[test]
    fn exploitability_falls_and_ends_small() {
        let cfg = spot("Ks Th 7d 4c 2s", OOP, IP, "50, 100", "100");
        let mut g = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT).unwrap();
        let mut last = f64::INFINITY;
        for checkpoint in [10, 100, 1000] {
            while g.iterations() < checkpoint {
                g.iterate();
            }
            let ex = g.exploitability().pct_pot;
            assert!(ex < last, "{checkpoint}: {ex} ≥ {last}");
            last = ex;
        }
        assert!(last < 0.1, "{last}% of pot after 1000 iterations");
    }

    #[test]
    fn relabelling_suits_changes_nothing() {
        // Swap spades and hearts everywhere (board and ranges); values and the strategy of
        // each relabelled combo must match.
        let perm = [0u8, 1, 3, 2];
        let cfg = spot("Ks Th 7d 4c 2s", OOP, IP, "50, 100", "100");
        let mut permuted = cfg.clone();
        permuted.board = cfg.board.iter().map(|&c| permute_card(c, &perm)).collect();
        for p in 0..2 {
            let mut r = Range::empty();
            for (c, w) in cfg.ranges[p].iter() {
                r.set(permute_combo(c, &perm), w);
            }
            permuted.ranges[p] = r;
        }
        let (mut a, mut b) = (solved(&cfg, 500), solved(&permuted, 500));
        let (ea, eb) = (a.expected_values(), b.expected_values());
        assert!(
            (ea[0] - eb[0]).abs() < 1e-3 && (ea[1] - eb[1]).abs() < 1e-3,
            "{ea:?} vs {eb:?}"
        );
        let (sa, sb) = (a.river_average(0).unwrap(), b.river_average(0).unwrap());
        let n = a.hands(0).len();
        for (h, &c) in a.hands(0).iter().enumerate() {
            let hb = b
                .hands(0)
                .iter()
                .position(|&x| x == permute_combo(c, &perm))
                .unwrap();
            for act in 0..sa.len() / n {
                assert!((sa[act * n + h] - sb[act * n + hb]).abs() < 1e-3, "{c}");
            }
        }
    }

    #[test]
    fn identical_ranges_with_no_betting_split_the_pot() {
        // No bet sizes: check-check to showdown. Same range on both sides → each expects P/2.
        let cfg = spot("Ks Th 7d 4c 2s", OOP, OOP, "", "");
        let mut g = solved(&cfg, 1);
        let ev = g.expected_values();
        assert!(
            (ev[0] - 500.0).abs() < 1e-3 && (ev[1] - 500.0).abs() < 1e-3,
            "{ev:?}"
        );
    }

    #[test]
    fn rake_is_taken_from_the_pot() {
        // Check-check only: total EV of both players = pot − rake. 5% of 1000 = 50 < cap.
        let mut cfg = spot("Ks Th 7d 4c 2s", OOP, IP, "", "");
        cfg.tree.rake = super::super::tree::Rake {
            fraction: 0.05,
            cap: 300,
        };
        let mut g = solved(&cfg, 1);
        let ev = g.expected_values();
        assert!((ev[0] + ev[1] - 950.0).abs() < 1e-2, "{ev:?}");
    }

    #[test]
    fn memory_estimate_covers_the_storage() {
        let cfg = spot("Ks Th 7d 4c 2s", OOP, IP, "50, 100", "100");
        let g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT).unwrap();
        assert!(estimate_memory(&cfg).unwrap() >= g.storage_entries() * 8);
    }
}
