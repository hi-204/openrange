//! Heads-up postflop game solved by CFR vectorized over hands.
//!
//! One traversal handles every hand of both players at once: values and reach probabilities
//! are vectors indexed by each player's hand list. Terminal nodes are evaluated in O(n) per
//! node with the sorted-strength sweep and per-card accumulators (docs/ARCHITECTURE.md §1.8).
//!
//! Turn and river cards are chance nodes. When a suit relabelling maps the board and both
//! ranges onto themselves, cards it maps onto each other lead to identical subgames with the
//! hands relabelled, so only one representative per group is stored and solved; the others
//! reuse its values through a hand permutation (suit isomorphism).
//!
//! Units: chips are centi-bb. Payoffs are measured from the start of the spot: a player's
//! payoff is what they win from the pot minus what they put in after the spot started, so the
//! starting pot is "dead money" both players are fighting over.

use super::tree::{Action, NodeKind, Street, Tree, TreeConfig};
use crate::cards::{Card, CardSet, Combo, NUM_COMBOS};
use crate::cfr::Algorithm;
use crate::eval::{Evaluator, HandKey};
use crate::iso::{SUIT_PERMS, SuitPerm, permute_combo, permute_set};
use crate::range::Range;
use std::collections::HashMap;

const NONE: u32 = u32::MAX;

#[derive(Clone, Debug, PartialEq)]
pub struct SpotConfig {
    pub tree: TreeConfig,
    pub board: Vec<Card>,
    /// `ranges[0]` is out of position, `ranges[1]` in position.
    pub ranges: [Range; 2],
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Options {
    pub algorithm: Algorithm,
    /// Share work between suit-isomorphic turn/river cards (exact when the ranges are
    /// symmetric under the relabelling, which is checked).
    pub isomorphism: bool,
}

impl Default for Options {
    fn default() -> Self {
        Options {
            algorithm: Algorithm::DCFR_DEFAULT,
            isomorphism: true,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq)]
enum EKind {
    Action { player: u8, n_actions: u8 },
    Chance,
    Fold { folder: u8 },
    Showdown,
}

/// A node of the card-expanded game: one action-tree node under one specific board.
#[derive(Clone, Debug)]
struct ENode {
    kind: EKind,
    tree_node: u32,
    board: CardSet,
    /// River strength table index (river showdowns only).
    river: u32,
    /// Chips each player has put in since the spot started (terminal payoffs).
    invested: [i64; 2],
    children: Vec<u32>,
    /// Chance nodes: the representative card dealt to reach each child…
    cards: Vec<Card>,
    /// …and, per child, the other cards it stands for, with the suit permutation
    /// (index into the game's permutation list) mapping the representative onto each.
    mirrors: Vec<Vec<(Card, u8)>>,
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

/// Reusable f32 buffers so traversals don't allocate per node.
#[derive(Default)]
struct Pool(Vec<Vec<f32>>);

impl Pool {
    fn get(&mut self, len: usize) -> Vec<f32> {
        let mut v = self.0.pop().unwrap_or_default();
        v.clear();
        v.resize(len, 0.0);
        v
    }
    fn put(&mut self, v: Vec<f32>) {
        self.0.push(v);
    }
}

pub struct PostflopGame {
    pub config: SpotConfig,
    pub tree: Tree,
    pub options: Options,
    hands: [Vec<Combo>; 2],
    init: [Vec<f32>; 2],
    /// Index of the identical combo in the other player's list, or NONE.
    same: [Vec<u32>; 2],
    /// Suit permutations that preserve the starting board and both ranges.
    perms: Vec<SuitPerm>,
    /// `hand_perm[p][k][i]`: index of permutation k applied to player p's hand i.
    hand_perm: [Vec<Vec<u32>>; 2],
    nodes: Vec<ENode>,
    index: HashMap<(u32, u64), u32>,
    rivers: Vec<RiverTable>,
    regrets: Vec<f32>,
    strategy_sum: Vec<f32>,
    iteration: u32,
    /// Σ_h w₀(h)·(compatible opponent weight): normalizes values into per-hand-pair EVs.
    pair_weight: f64,
    pool: Pool,
    /// Node locks (D-076): expanded action node → fixed strategy `[action][hand]` of the acting
    /// player, used in every pass (training, averages, best responses) instead of regret
    /// matching. The locked player can't deviate there, so exploitability measures the
    /// restricted game and still goes to zero.
    locks: HashMap<u32, Vec<f32>>,
}

/// Estimated memory for a spot in bytes (storage + strength tables + nodes + overhead),
/// computed without allocating the solver.
pub fn estimate_memory(cfg: &SpotConfig) -> Result<usize, String> {
    estimate_memory_with(cfg, Options::default())
}

pub fn estimate_memory_with(cfg: &SpotConfig, options: Options) -> Result<usize, String> {
    Ok(Skeleton::new(cfg, options, false)?.bytes)
}

/// Builds hand lists and the expanded node list; shared by the estimator and the solver.
struct Skeleton {
    tree: Tree,
    hands: [Vec<Combo>; 2],
    init: [Vec<f32>; 2],
    perms: Vec<SuitPerm>,
    hand_perm: [Vec<Vec<u32>>; 2],
    nodes: Vec<ENode>,
    river_boards: Vec<CardSet>,
    storage: usize,
    bytes: usize,
    /// Count nodes only (memory estimate): skip per-node vectors where possible.
    count_only: bool,
    node_bytes: usize,
}

impl Skeleton {
    fn new(cfg: &SpotConfig, options: Options, build: bool) -> Result<Skeleton, String> {
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

        // Suit permutations that fix the board and leave both ranges unchanged.
        let dense: [Range; 2] = [cfg.ranges[0].without(board), cfg.ranges[1].without(board)];
        let mut perms: Vec<SuitPerm> = vec![SUIT_PERMS[0]];
        if options.isomorphism {
            for p in SUIT_PERMS.iter().skip(1) {
                let fixes_board = permute_set(board, p) == board;
                let fixes_ranges = (0..2).all(|q| {
                    dense[q]
                        .iter()
                        .all(|(c, w)| dense[q].weight(permute_combo(c, p)) == w)
                });
                if fixes_board && fixes_ranges {
                    perms.push(*p);
                }
            }
        }
        let mut pos = [[NONE; NUM_COMBOS], [NONE; NUM_COMBOS]];
        for p in 0..2 {
            for (i, c) in hands[p].iter().enumerate() {
                pos[p][c.index()] = i as u32;
            }
        }
        let hand_perm: [Vec<Vec<u32>>; 2] = [0, 1].map(|p| {
            perms
                .iter()
                .map(|perm| {
                    hands[p]
                        .iter()
                        .map(|&c| pos[p][permute_combo(c, perm).index()])
                        .collect()
                })
                .collect()
        });

        let mut sk = Skeleton {
            tree,
            hands,
            init,
            perms,
            hand_perm,
            nodes: Vec::new(),
            river_boards: Vec::new(),
            storage: 0,
            bytes: 0,
            count_only: !build,
            node_bytes: 0,
        };
        let mut rivers: HashMap<u64, u32> = HashMap::new();
        if sk.count_only {
            sk.count(0, board, &mut rivers);
        } else {
            sk.expand(0, board, &mut rivers);
        }
        let n = sk.hands[0].len() + sk.hands[1].len();
        sk.bytes = sk.storage * 8 // regrets + strategy sums, f32 each
            + sk.river_boards.len() * n * (2 + 4) // strengths (u16) + order (u32)
            + sk.node_bytes
            + 64 * n * 4 * 8 // traversal scratch buffers, generous
            + (1 << 20); // evaluator tables and fixed overhead
        Ok(sk)
    }

    /// Same walk as [`Self::expand`] but only counts (memory estimate without allocating
    /// the node list).
    fn count(&mut self, tree_node: usize, board: CardSet, rivers: &mut HashMap<u64, u32>) {
        self.node_bytes += std::mem::size_of::<ENode>() + 48;
        match self.tree.nodes[tree_node].kind.clone() {
            NodeKind::Action {
                player,
                actions,
                children,
            } => {
                self.storage += actions.len() * self.hands[player].len();
                self.node_bytes += children.len() * 4;
                for c in children {
                    self.count(c, board, rivers);
                }
            }
            NodeKind::Chance { child, .. } => {
                let usable: Vec<usize> = (1..self.perms.len())
                    .filter(|&k| permute_set(board, &self.perms[k]) == board)
                    .collect();
                let mut assigned = CardSet::EMPTY;
                for i in 0..52u8 {
                    let c = Card::from_index(i);
                    if board.contains(c) || assigned.contains(c) {
                        continue;
                    }
                    assigned.insert(c);
                    let mut group = 0;
                    for &k in &usable {
                        let m = crate::iso::permute_card(c, &self.perms[k]);
                        if !assigned.contains(m) {
                            assigned.insert(m);
                            group += 1;
                        }
                    }
                    self.node_bytes += 4 + 4 + 24 + group * 2;
                    let mut b = board;
                    b.insert(c);
                    self.count(child, b, rivers);
                }
            }
            NodeKind::Showdown if self.tree.nodes[tree_node].street == Street::River => {
                let next = rivers.len() as u32;
                if let std::collections::hash_map::Entry::Vacant(e) = rivers.entry(board.0) {
                    e.insert(next);
                    self.river_boards.push(board);
                }
            }
            NodeKind::Fold { .. } | NodeKind::Showdown => {}
        }
    }

    fn expand(
        &mut self,
        tree_node: usize,
        board: CardSet,
        rivers: &mut HashMap<u64, u32>,
    ) -> usize {
        let id = self.nodes.len();
        let tnode = &self.tree.nodes[tree_node];
        let kind = match &tnode.kind {
            NodeKind::Action {
                player, actions, ..
            } => EKind::Action {
                player: *player as u8,
                n_actions: actions.len() as u8,
            },
            NodeKind::Chance { .. } => EKind::Chance,
            NodeKind::Fold { folder } => EKind::Fold {
                folder: *folder as u8,
            },
            NodeKind::Showdown => EKind::Showdown,
        };
        let river = if kind == EKind::Showdown && tnode.street == Street::River {
            let next = rivers.len() as u32;
            *rivers.entry(board.0).or_insert_with(|| {
                self.river_boards.push(board);
                next
            })
        } else {
            NONE
        };
        self.node_bytes += std::mem::size_of::<ENode>() + 48;
        self.nodes.push(ENode {
            kind,
            tree_node: tree_node as u32,
            board,
            river,
            invested: tnode.invested,
            children: Vec::new(),
            cards: Vec::new(),
            mirrors: Vec::new(),
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
                let kids: Vec<u32> = children
                    .iter()
                    .map(|&c| self.expand(c, board, rivers) as u32)
                    .collect();
                self.node_bytes += kids.len() * 4;
                self.nodes[id].children = kids;
            }
            NodeKind::Chance { child, .. } => {
                // Permutations that also fix the cards dealt so far.
                let usable: Vec<u8> = (1..self.perms.len())
                    .filter(|&k| permute_set(board, &self.perms[k]) == board)
                    .map(|k| k as u8)
                    .collect();
                let mut assigned = CardSet::EMPTY;
                let (mut kids, mut cards, mut mirrors) = (Vec::new(), Vec::new(), Vec::new());
                for i in 0..52u8 {
                    let c = Card::from_index(i);
                    if board.contains(c) || assigned.contains(c) {
                        continue;
                    }
                    assigned.insert(c);
                    let mut group = Vec::new();
                    for &k in &usable {
                        let m = crate::iso::permute_card(c, &self.perms[k as usize]);
                        if !assigned.contains(m) {
                            assigned.insert(m);
                            group.push((m, k));
                        }
                    }
                    let mut b = board;
                    b.insert(c);
                    kids.push(self.expand(child, b, rivers) as u32);
                    cards.push(c);
                    self.node_bytes += 4 + 4 + 24 + group.len() * 2;
                    mirrors.push(group);
                }
                self.nodes[id].children = kids;
                self.nodes[id].cards = cards;
                self.nodes[id].mirrors = mirrors;
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
        PostflopGame::with_options(
            config,
            Options {
                algorithm,
                ..Options::default()
            },
        )
    }

    pub fn with_options(config: SpotConfig, options: Options) -> Result<PostflopGame, String> {
        let sk = Skeleton::new(&config, options, true)?;
        let Skeleton {
            tree,
            hands,
            init,
            perms,
            hand_perm,
            nodes,
            river_boards,
            storage,
            ..
        } = sk;

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
        let index = nodes
            .iter()
            .enumerate()
            .map(|(i, n)| ((n.tree_node, n.board.0), i as u32))
            .collect();

        let mut game = PostflopGame {
            config,
            tree,
            options,
            hands,
            init,
            same,
            perms,
            hand_perm,
            nodes,
            index,
            rivers,
            regrets: vec![0.0; storage],
            strategy_sum: vec![0.0; storage],
            iteration: 0,
            pair_weight: 0.0,
            pool: Pool::default(),
            locks: HashMap::new(),
        };
        let compat = game.compatible(0, &game.init[1], CardSet::EMPTY);
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

    /// The expanded node reached by `path` (as in [`Self::node`]).
    fn expanded_at(&self, path: &[usize]) -> Result<usize, String> {
        let mut e = 0usize;
        for (depth, &step) in path.iter().enumerate() {
            let n = self.nodes[e].children.len();
            if matches!(self.nodes[e].kind, EKind::Fold { .. } | EKind::Showdown) || step >= n {
                return Err(format!("step {depth}: no child {step}"));
            }
            e = self.nodes[e].children[step] as usize;
        }
        Ok(e)
    }

    /// Lock the acting player's strategy at the action node reached by `path`:
    /// `strategy[a * hands + h]`. Each hand's probabilities must be non-negative and are
    /// normalized to sum to 1. Takes effect from the next iteration; call [`Self::reset`] to
    /// re-solve from scratch.
    pub fn lock(&mut self, path: &[usize], strategy: &[f32]) -> Result<(), String> {
        let e = self.expanded_at(path)?;
        let EKind::Action { player, n_actions } = self.nodes[e].kind else {
            return Err("only decision nodes can be locked".into());
        };
        let (n_a, n) = (n_actions as usize, self.hands[player as usize].len());
        if strategy.len() != n_a * n {
            return Err(format!(
                "expected {} numbers ({n_a} actions × {n} hands), got {}",
                n_a * n,
                strategy.len()
            ));
        }
        let mut s = strategy.to_vec();
        for h in 0..n {
            if (0..n_a).any(|a| !s[a * n + h].is_finite() || s[a * n + h] < 0.0) {
                return Err(format!(
                    "hand {h}: probabilities must be finite and not negative"
                ));
            }
            let total: f32 = (0..n_a).map(|a| s[a * n + h]).sum();
            if total <= 0.0 {
                return Err(format!("hand {h}: probabilities sum to zero"));
            }
            for a in 0..n_a {
                s[a * n + h] /= total;
            }
        }
        self.locks.insert(e as u32, s);
        Ok(())
    }

    pub fn unlock(&mut self, path: &[usize]) -> Result<bool, String> {
        let e = self.expanded_at(path)?;
        Ok(self.locks.remove(&(e as u32)).is_some())
    }

    pub fn clear_locks(&mut self) {
        self.locks.clear();
    }

    pub fn is_locked(&self, path: &[usize]) -> bool {
        self.expanded_at(path)
            .is_ok_and(|e| self.locks.contains_key(&(e as u32)))
    }

    pub fn lock_count(&self) -> usize {
        self.locks.len()
    }

    /// Forget all regrets and averages (locks stay), so the next iterations solve from scratch.
    pub fn reset(&mut self) {
        self.regrets.fill(0.0);
        self.strategy_sum.fill(0.0);
        self.iteration = 0;
    }

    /// The strategy the acting player uses at expanded node `e`: the lock if there is one,
    /// otherwise the average.
    fn strategy_into(&self, e: usize, n_a: usize, n: usize, out: &mut [f32]) {
        match self.locks.get(&(e as u32)) {
            Some(l) => out.copy_from_slice(l),
            None => self.average_into(self.nodes[e].offset, n_a, n, out),
        }
    }

    pub fn initial_weights(&self, player: usize) -> &[f32] {
        &self.init[player]
    }

    /// For each hand of `player`: total weight of the opponent's starting range over hands
    /// that share no card with it.
    pub fn opponent_weights(&self, player: usize) -> Vec<f64> {
        self.compatible(player, &self.init[1 - player], CardSet::EMPTY)
    }

    pub fn iterations(&self) -> u32 {
        self.iteration
    }

    pub fn storage_entries(&self) -> usize {
        self.regrets.len()
    }

    /// Number of suit relabellings (including the identity) used for isomorphism.
    pub fn symmetries(&self) -> usize {
        self.perms.len()
    }

    pub fn expanded_nodes(&self) -> usize {
        self.nodes.len()
    }

    /// For each hand of `player`: total opponent reach over hands sharing no card with it,
    /// in f64. Hands blocked by `board` get 0.
    fn compatible(&self, player: usize, opp_reach: &[f32], board: CardSet) -> Vec<f64> {
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
                if c.cards().intersects(board) {
                    return 0.0;
                }
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
        let mut pool = std::mem::take(&mut self.pool);
        for trav in 0..2 {
            let (own, opp) = (self.init[trav].clone(), self.init[1 - trav].clone());
            let mut out = pool.get(self.hands[trav].len());
            self.walk(0, trav, &own, &opp, Mode::Train(t), &mut out, &mut pool);
            pool.put(out);
        }
        self.pool = pool;
    }

    /// Counterfactual values for `trav`'s hands at expanded node `e`.
    #[allow(clippy::too_many_arguments)]
    fn walk(
        &mut self,
        e: usize,
        trav: usize,
        own: &[f32],
        opp: &[f32],
        mode: Mode,
        out: &mut [f32],
        pool: &mut Pool,
    ) {
        let n_t = self.hands[trav].len();
        let n_o = self.hands[1 - trav].len();
        match self.nodes[e].kind {
            EKind::Fold { folder } => self.fold_value(e, trav, folder as usize, opp, out),
            EKind::Showdown => self.showdown_value(e, trav, opp, out),
            EKind::Chance => {
                out.fill(0.0);
                // Each card is equally likely given both hands: 1 / (cards left − 4 hole cards).
                let weight = 1.0 / (52 - self.nodes[e].board.len() as usize - 4) as f32;
                let mut own_c = pool.get(n_t);
                let mut opp_c = pool.get(n_o);
                let mut tmp = pool.get(n_t);
                for k in 0..self.nodes[e].children.len() {
                    let child = self.nodes[e].children[k] as usize;
                    let bit = self.nodes[e].cards[k].bit();
                    for (i, c) in self.hands[trav].iter().enumerate() {
                        own_c[i] = if c.cards().0 & bit != 0 { 0.0 } else { own[i] };
                    }
                    for (j, c) in self.hands[1 - trav].iter().enumerate() {
                        opp_c[j] = if c.cards().0 & bit != 0 { 0.0 } else { opp[j] };
                    }
                    self.walk(child, trav, &own_c, &opp_c, mode, &mut tmp, pool);
                    for i in 0..n_t {
                        out[i] += weight * tmp[i];
                    }
                    // Isomorphic cards: same values with the hands relabelled.
                    for &(_, k_perm) in &self.nodes[e].mirrors[k] {
                        let map = &self.hand_perm[trav][k_perm as usize];
                        for i in 0..n_t {
                            out[map[i] as usize] += weight * tmp[i];
                        }
                    }
                }
                pool.put(own_c);
                pool.put(opp_c);
                pool.put(tmp);
            }
            EKind::Action { player, n_actions } => {
                let (player, n_a) = (player as usize, n_actions as usize);
                let n_p = self.hands[player].len();
                let offset = self.nodes[e].offset;
                let mut sigma = pool.get(n_a * n_p);
                // A locked node always plays its lock. Otherwise training uses the current
                // (regret-matched) strategies and evaluation uses averages.
                let locked = self.locks.contains_key(&(e as u32));
                if locked {
                    sigma.copy_from_slice(&self.locks[&(e as u32)]);
                } else if matches!(mode, Mode::Train(_)) {
                    regret_match(
                        &self.regrets[offset..offset + n_a * n_p],
                        n_a,
                        n_p,
                        &mut sigma,
                    );
                } else {
                    self.average_into(offset, n_a, n_p, &mut sigma);
                }
                if player == trav {
                    let mut child_vals = pool.get(n_a * n_t);
                    let mut own_a = pool.get(n_t);
                    for a in 0..n_a {
                        for h in 0..n_t {
                            own_a[h] = own[h] * sigma[a * n_t + h];
                        }
                        let child = self.nodes[e].children[a] as usize;
                        self.walk(
                            child,
                            trav,
                            &own_a,
                            opp,
                            mode,
                            &mut child_vals[a * n_t..(a + 1) * n_t],
                            pool,
                        );
                    }
                    match mode {
                        // The locked player can't deviate at a locked node, and its regrets
                        // and averages there aren't used, so they aren't updated.
                        Mode::BestResponse | Mode::Train(_) if locked => {
                            for h in 0..n_t {
                                out[h] = (0..n_a)
                                    .map(|a| sigma[a * n_t + h] * child_vals[a * n_t + h])
                                    .sum();
                            }
                        }
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
                            let (dp, dn, ds) = self.options.algorithm.discounts(t);
                            let (dp, dn, ds) = (dp as f32, dn as f32, ds as f32);
                            let w = self.options.algorithm.strategy_weight(t) as f32;
                            let floor = self.options.algorithm.floors_regrets();
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
                    pool.put(child_vals);
                    pool.put(own_a);
                } else {
                    out.fill(0.0);
                    let mut tmp = pool.get(n_t);
                    let mut opp_a = pool.get(n_p);
                    for a in 0..n_a {
                        for j in 0..n_p {
                            opp_a[j] = opp[j] * sigma[a * n_p + j];
                        }
                        let child = self.nodes[e].children[a] as usize;
                        self.walk(child, trav, own, &opp_a, mode, &mut tmp, pool);
                        for h in 0..n_t {
                            out[h] += tmp[h];
                        }
                    }
                    pool.put(tmp);
                    pool.put(opp_a);
                }
                pool.put(sigma);
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

    /// The contested pot after rake (starting pot + matched bets; an uncalled bet just
    /// returns to its owner) and each player's investment.
    fn payoffs(&self, e: usize) -> (f64, [i64; 2]) {
        let invested = self.nodes[e].invested;
        let matched = invested[0].min(invested[1]);
        let pot = self.config.tree.pot + 2 * matched;
        (pot as f64 - self.config.tree.rake.of(pot), invested)
    }

    fn fold_value(&self, e: usize, trav: usize, folder: usize, opp: &[f32], out: &mut [f32]) {
        let (net_pot, invested) = self.payoffs(e);
        let matched = invested[0].min(invested[1]) as f64;
        let payoff = if folder == trav {
            -(invested[trav] as f64)
        } else {
            net_pot - matched
        };
        // Same per-card inclusion–exclusion as `compatible`, kept in f64 until the end.
        let o = 1 - trav;
        let mut card = [0f64; 52];
        let mut total = 0f64;
        for (j, c) in self.hands[o].iter().enumerate() {
            let w = opp[j] as f64;
            total += w;
            card[c.hi.index() as usize] += w;
            card[c.lo.index() as usize] += w;
        }
        let board = self.nodes[e].board;
        for (i, c) in self.hands[trav].iter().enumerate() {
            out[i] = if c.cards().intersects(board) {
                0.0
            } else {
                let same = self.same[trav][i];
                let back = if same == NONE {
                    0.0
                } else {
                    opp[same as usize] as f64
                };
                (payoff
                    * (total - card[c.hi.index() as usize] - card[c.lo.index() as usize] + back))
                    as f32
            };
        }
    }

    fn showdown_value(&self, e: usize, trav: usize, opp: &[f32], out: &mut [f32]) {
        let (net_pot, invested) = self.payoffs(e);
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
            // The identical opponent combo is subtracted twice by the per-card terms (it holds
            // both of our cards); add it back once. It can't be strictly weaker.
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
        let mut pool = std::mem::take(&mut self.pool);
        let mut out = pool.get(self.hands[p].len());
        self.walk(0, p, &own, &opp, mode, &mut out, &mut pool);
        let v = own
            .iter()
            .zip(&out)
            .map(|(&w, &v)| w as f64 * v as f64)
            .sum::<f64>()
            / self.pair_weight;
        pool.put(out);
        self.pool = pool;
        v
    }

    /// Expected payoff (chips, from the start of the spot) of every hand of `player` when both
    /// play their average strategies: the hand's counterfactual value divided by the weight of
    /// opponent hands it can face. NaN for hands that can face nothing.
    pub fn hand_values(&mut self, player: usize) -> Vec<f64> {
        let (own, opp) = (self.init[player].clone(), self.init[1 - player].clone());
        let mut pool = std::mem::take(&mut self.pool);
        let mut out = pool.get(self.hands[player].len());
        self.walk(0, player, &own, &opp, Mode::Average, &mut out, &mut pool);
        let compat = self.compatible(player, &opp, CardSet::EMPTY);
        let values = out
            .iter()
            .zip(&compat)
            .map(|(&v, &c)| if c > 0.0 { v as f64 / c } else { f64::NAN })
            .collect();
        pool.put(out);
        self.pool = pool;
        values
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

    /// The node reached by following `path` (action indices; at chance nodes the index into
    /// the representative-card list), with the acting player's average strategy and per-action
    /// EVs.
    pub fn node(&mut self, path: &[usize]) -> Result<NodeView, String> {
        let mut e = 0usize;
        let mut reach = [self.init[0].clone(), self.init[1].clone()];
        // The board in the order the user gave it, then cards dealt along the path.
        let mut board = self.config.board.clone();
        for (depth, &step) in path.iter().enumerate() {
            match self.nodes[e].kind {
                EKind::Action { player, n_actions } => {
                    let (player, n_a) = (player as usize, n_actions as usize);
                    if step >= n_a {
                        return Err(format!("step {depth}: no action {step}"));
                    }
                    let n = self.hands[player].len();
                    let mut sigma = vec![0f32; n_a * n];
                    self.strategy_into(e, n_a, n, &mut sigma);
                    for h in 0..n {
                        reach[player][h] *= sigma[step * n + h];
                    }
                }
                EKind::Chance => {
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
            e = self.nodes[e].children[step] as usize;
        }
        let tnode = self.tree.nodes[self.nodes[e].tree_node as usize].clone();
        let (pot, committed) = (tnode.pot(), tnode.committed);
        // A chance node reports the street whose card it deals.
        let street = match tnode.kind {
            NodeKind::Chance { street, .. } => street,
            _ => tnode.street,
        };
        let kind = match (self.nodes[e].kind, tnode.kind) {
            (EKind::Action { player, n_actions }, NodeKind::Action { actions, .. }) => {
                let (player, n_a) = (player as usize, n_actions as usize);
                let n = self.hands[player].len();
                let mut strategy = vec![0f32; n_a * n];
                self.strategy_into(e, n_a, n, &mut strategy);
                // Per-action EV for each hand: child value with both on average strategies,
                // divided by the compatible opponent weight that reaches this node.
                let opp = reach[1 - player].clone();
                let compat = self.compatible(player, &opp, self.nodes[e].board);
                let own = reach[player].clone();
                let mut ev = vec![0f32; n_a * n];
                let mut tmp = vec![0f32; n];
                let mut pool = std::mem::take(&mut self.pool);
                for a in 0..n_a {
                    let child = self.nodes[e].children[a] as usize;
                    self.walk(
                        child,
                        player,
                        &own,
                        &opp,
                        Mode::Average,
                        &mut tmp,
                        &mut pool,
                    );
                    for h in 0..n {
                        ev[a * n + h] = if compat[h] > 0.0 {
                            (tmp[h] as f64 / compat[h]) as f32
                        } else {
                            f32::NAN
                        };
                    }
                }
                self.pool = pool;
                ViewKind::Action {
                    player,
                    actions,
                    strategy,
                    ev,
                }
            }
            (EKind::Chance, _) => ViewKind::Chance {
                cards: self.nodes[e].cards.clone(),
                mirrors: self.nodes[e]
                    .mirrors
                    .iter()
                    .map(|g| g.iter().map(|&(c, _)| c).collect())
                    .collect(),
            },
            (EKind::Fold { folder }, _) => ViewKind::Fold {
                folder: folder as usize,
            },
            _ => ViewKind::Showdown,
        };
        Ok(NodeView {
            kind,
            street,
            board,
            pot,
            committed,
            reach,
            locked: self.locks.contains_key(&(e as u32)),
        })
    }

    /// Average strategy `[action][hand]` at the expanded node for (action-tree node, board).
    /// Only representative boards exist when isomorphism merged cards.
    pub fn average_at(&self, tree_node: usize, board: CardSet) -> Option<Vec<f32>> {
        let e = *self.index.get(&(tree_node as u32, board.0))? as usize;
        let EKind::Action { player, n_actions } = self.nodes[e].kind else {
            return None;
        };
        let n = self.hands[player as usize].len();
        let mut out = vec![0f32; n_actions as usize * n];
        self.strategy_into(e, n_actions as usize, n, &mut out);
        Some(out)
    }

    /// [`Self::average_at`] on the starting board (all nodes of a river spot).
    pub fn river_average(&self, tree_node: usize) -> Option<Vec<f32>> {
        self.average_at(tree_node, CardSet::from_cards(&self.config.board))
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
    /// Representative cards, and for each the other cards it stands for (suit isomorphism).
    Chance {
        cards: Vec<Card>,
        mirrors: Vec<Vec<Card>>,
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
    /// The acting player's strategy here is locked.
    pub locked: bool,
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
                max_raises: [2; 3],
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
        // Measured 0.0047% of pot (D-040).
        assert!(last < 0.03, "{last}% of pot after 1000 iterations");
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
            // Measured exactly 0; 1e-6 is a floor (D-040).
            (ea[0] - eb[0]).abs() < 1e-6 && (ea[1] - eb[1]).abs() < 1e-6,
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
                assert!((sa[act * n + h] - sb[act * n + hb]).abs() < 1e-6, "{c}");
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
            (ev[0] - 500.0).abs() < 1e-6 && (ev[1] - 500.0).abs() < 1e-6,
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
        assert!((ev[0] + ev[1] - 950.0).abs() < 1e-6, "{ev:?}");
    }

    #[test]
    fn memory_estimate_covers_the_storage() {
        let cfg = spot("Ks Th 7d 4c 2s", OOP, IP, "50, 100", "100");
        let g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT).unwrap();
        assert!(estimate_memory(&cfg).unwrap() >= g.storage_entries() * 8);
    }

    fn turn_spot(board: &str, oop: &str, ip: &str) -> SpotConfig {
        let mut cfg = spot("Ks Th 7d 4c 2s", oop, ip, "66", "100");
        cfg.tree.street = Street::Turn;
        cfg.tree.max_raises = [1; 3];
        cfg.board = parse_cards(board).unwrap();
        cfg
    }

    fn solve_with(cfg: &SpotConfig, iso: bool, iters: u32) -> PostflopGame {
        let options = Options {
            algorithm: Algorithm::DCFR_DEFAULT,
            isomorphism: iso,
        };
        let mut g = PostflopGame::with_options(cfg.clone(), options).unwrap();
        for _ in 0..iters {
            g.iterate();
        }
        g
    }

    #[test]
    fn isomorphism_shares_work_without_changing_results() {
        // Monotone turn board: the three other suits are interchangeable, so most river cards
        // come in groups of three.
        let cfg = turn_spot(
            "Ks Ts 7s 2s",
            "QQ+, AJs+, KQs, T9s, 87s, AQo+",
            "TT+, ATs+, KJs+, QJs, 98s, AJo+",
        );
        let (mut with, mut without) = (solve_with(&cfg, true, 300), solve_with(&cfg, false, 300));
        assert_eq!(with.symmetries(), 6);
        assert!(
            with.storage_entries() * 2 < without.storage_entries(),
            "{} vs {}",
            with.storage_entries(),
            without.storage_entries()
        );
        let (a, b) = (with.expected_values(), without.expected_values());
        assert!(
            // Measured 2.3e-4 chips (EV) and 2.6e-3 chips (exploitability), D-040.
            (a[0] - b[0]).abs() < 2e-3 && (a[1] - b[1]).abs() < 2e-3,
            "{a:?} vs {b:?}"
        );
        let (ea, eb) = (with.exploitability(), without.exploitability());
        assert!((ea.chips - eb.chips).abs() < 0.02, "{ea:?} vs {eb:?}");
        // Same root strategy.
        let (sa, sb) = (
            with.river_average(0).unwrap(),
            without.river_average(0).unwrap(),
        );
        let worst = sa
            .iter()
            .zip(&sb)
            .map(|(x, y)| (x - y).abs())
            .fold(0.0f32, f32::max);
        assert!(worst < 1e-3, "{worst}");
    }

    #[test]
    fn isomorphism_is_off_when_ranges_are_not_symmetric() {
        // Only the heart flush draw is in range, so hearts are not interchangeable with clubs
        // or diamonds.
        let cfg = turn_spot("Ks Ts 7s 2s", "QQ+, AhQh", "TT+");
        let g = PostflopGame::with_options(cfg, Options::default()).unwrap();
        // Remaining symmetry: clubs ↔ diamonds only.
        assert_eq!(g.symmetries(), 2);
    }

    #[test]
    fn turn_exploitability_falls() {
        let cfg = turn_spot(
            "Kd Th 7c 2s",
            "QQ+, AJs+, KQs, T9s, AQo+",
            "TT+, ATs+, KJs+, QJs, AJo+",
        );
        let mut g = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT).unwrap();
        let mut last = f64::INFINITY;
        for checkpoint in [10, 50, 200] {
            while g.iterations() < checkpoint {
                g.iterate();
            }
            let ex = g.exploitability().pct_pot;
            assert!(ex < last, "{checkpoint}: {ex} >= {last}");
            last = ex;
        }
        // Measured 0.049% of pot (D-040).
        assert!(last < 0.25, "{last}% of pot after 200 iterations");
    }

    #[test]
    fn count_only_estimate_matches_the_built_game() {
        let cfg = turn_spot(
            "Ks Ts 7s 2s",
            "QQ+, AJs+, KQs, T9s, AQo+",
            "TT+, ATs+, KJs+, QJs, AJo+",
        );
        for iso in [true, false] {
            let options = Options {
                algorithm: Algorithm::DCFR_DEFAULT,
                isomorphism: iso,
            };
            let counted = Skeleton::new(&cfg, options, false).unwrap();
            let built = Skeleton::new(&cfg, options, true).unwrap();
            assert_eq!(counted.storage, built.storage);
            assert_eq!(counted.river_boards.len(), built.river_boards.len());
            assert_eq!(counted.bytes, built.bytes);
        }
    }

    #[test]
    fn hand_values_average_to_the_game_value() {
        let cfg = turn_spot(
            "Kd Th 7c 2s",
            "QQ+, AJs+, KQs, T9s, AQo+",
            "TT+, ATs+, KJs+, QJs, AJo+",
        );
        let mut g = solve_with(&cfg, true, 100);
        let ev = g.expected_values();
        for (p, &game_value) in ev.iter().enumerate() {
            let v = g.hand_values(p);
            let compat = g.compatible(p, &g.init[1 - p].clone(), CardSet::EMPTY);
            let (mut num, mut den) = (0.0, 0.0);
            for h in 0..v.len() {
                if v[h].is_finite() {
                    let w = g.init[p][h] as f64 * compat[h];
                    num += w * v[h];
                    den += w;
                }
            }
            assert!(
                (num / den - game_value).abs() < 1e-3,
                "player {p}: {} vs {game_value}",
                num / den
            );
        }
    }
}
