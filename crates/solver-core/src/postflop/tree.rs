//! Betting-tree builder for heads-up postflop spots.
//!
//! The action tree is independent of the cards: chance nodes (turn/river deals) appear as
//! single nodes here and are expanded per card by the solver. All amounts are integers in
//! centi-big-blinds (1 bb = 100), so bet sizes are exact and trees are deterministic (D-012).
//!
//! Conventions: player 0 is out of position (acts first on every street), player 1 in
//! position. A bet of `x%` is x% of the pot at that moment. A raise of `x%` means: call,
//! then add x% of the pot after the call (the usual "pot-sized raise" definition).

use std::fmt;

pub const BB: i64 = 100;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub enum Street {
    Flop = 0,
    Turn = 1,
    River = 2,
}

impl Street {
    pub fn board_len(self) -> usize {
        3 + self as usize
    }

    pub fn next(self) -> Option<Street> {
        match self {
            Street::Flop => Some(Street::Turn),
            Street::Turn => Some(Street::River),
            Street::River => None,
        }
    }

    pub fn from_board_len(n: usize) -> Option<Street> {
        match n {
            3 => Some(Street::Flop),
            4 => Some(Street::Turn),
            5 => Some(Street::River),
            _ => None,
        }
    }
}

/// One bet or raise size option.
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Size {
    /// Fraction of the pot (0.75 = 75%).
    Pot(f64),
    AllIn,
}

impl Size {
    /// Parse a comma/space separated list like `"33, 75, 150, a"` (percent of pot; `a` = all-in).
    pub fn parse_list(s: &str) -> Result<Vec<Size>, String> {
        let mut out = Vec::new();
        for tok in s.split([',', ' ']).map(str::trim).filter(|t| !t.is_empty()) {
            let t = tok.trim_end_matches('%');
            if t.eq_ignore_ascii_case("a")
                || t.eq_ignore_ascii_case("allin")
                || t.eq_ignore_ascii_case("all-in")
            {
                out.push(Size::AllIn);
                continue;
            }
            let v: f64 = t.parse().map_err(|_| {
                format!("'{tok}' is not a size (use percent of pot, e.g. 75, or 'a' for all-in)")
            })?;
            if !(v > 0.0 && v <= 10_000.0) {
                return Err(format!(
                    "'{tok}': sizes must be between 0 and 10000% of the pot"
                ));
            }
            out.push(Size::Pot(v / 100.0));
        }
        Ok(out)
    }
}

impl fmt::Display for Size {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Size::Pot(x) => write!(f, "{}%", (x * 100.0 * 100.0).round() / 100.0),
            Size::AllIn => write!(f, "all-in"),
        }
    }
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct BetSizes {
    /// Sizes for the first bet on a street.
    pub bet: Vec<Size>,
    /// Sizes when facing a bet or raise.
    pub raise: Vec<Size>,
}

#[derive(Clone, Debug, Default, PartialEq)]
pub struct StreetSizes {
    pub oop: BetSizes,
    pub ip: BetSizes,
}

#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Rake {
    /// Fraction of the final pot (0.05 = 5%).
    pub fraction: f64,
    /// Maximum rake in chips (centi-bb); 0 = no cap.
    pub cap: i64,
}

impl Rake {
    pub fn of(&self, pot: i64) -> f64 {
        let r = pot as f64 * self.fraction;
        if self.cap > 0 {
            r.min(self.cap as f64)
        } else {
            r
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub struct TreeConfig {
    pub street: Street,
    /// Pot at the start of the spot, chips (centi-bb).
    pub pot: i64,
    /// Effective stack behind at the start of the spot, chips.
    pub stack: i64,
    /// Sizes per street, indexed by `Street as usize`.
    pub sizes: [StreetSizes; 3],
    /// Maximum number of raises per street (a bet is not a raise), indexed by street.
    pub max_raises: [u8; 3],
    /// If a bet or raise would put at least this fraction of the remaining stack in, it
    /// becomes an all-in instead (e.g. 0.67). Use a value > 1 to disable.
    pub allin_threshold: f64,
    pub rake: Rake,
}

impl TreeConfig {
    /// A simple river spot: one bet size and one raise size for both players.
    pub fn simple(
        street: Street,
        pot: i64,
        stack: i64,
        bet: &[Size],
        raise: &[Size],
    ) -> TreeConfig {
        let bs = BetSizes {
            bet: bet.to_vec(),
            raise: raise.to_vec(),
        };
        let ss = StreetSizes {
            oop: bs.clone(),
            ip: bs,
        };
        TreeConfig {
            street,
            pot,
            stack,
            sizes: [ss.clone(), ss.clone(), ss],
            max_raises: [3; 3],
            allin_threshold: 2.0,
            rake: Rake::default(),
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Action {
    Fold,
    Check,
    Call,
    /// Bet so that this player's total on the street becomes `to`.
    Bet(i64),
    /// Raise to `to` (this player's street total).
    Raise(i64),
    /// All-in; `to` is the resulting street total.
    AllIn(i64),
}

impl Action {
    pub fn label(&self) -> String {
        let bb = |x: &i64| format!("{}", *x as f64 / BB as f64);
        match self {
            Action::Fold => "Fold".into(),
            Action::Check => "Check".into(),
            Action::Call => "Call".into(),
            Action::Bet(to) => format!("Bet {}", bb(to)),
            Action::Raise(to) => format!("Raise {}", bb(to)),
            Action::AllIn(to) => format!("All-in {}", bb(to)),
        }
    }

    pub fn is_aggressive(&self) -> bool {
        matches!(self, Action::Bet(_) | Action::Raise(_) | Action::AllIn(_))
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum NodeKind {
    Action {
        player: usize,
        actions: Vec<Action>,
        children: Vec<usize>,
    },
    /// Deal the next street's card, then continue at `child`.
    Chance {
        street: Street,
        child: usize,
    },
    Fold {
        folder: usize,
    },
    Showdown,
}

#[derive(Clone, Debug, PartialEq)]
pub struct Node {
    pub kind: NodeKind,
    pub street: Street,
    /// Pot before this street's bets (includes everything from earlier streets).
    pub pot_start: i64,
    /// Chips each player has put in on this street so far.
    pub committed: [i64; 2],
    /// Total chips each player has put in since the spot started (for payoffs).
    pub invested: [i64; 2],
}

impl Node {
    pub fn pot(&self) -> i64 {
        self.pot_start + self.committed[0] + self.committed[1]
    }
}

#[derive(Clone, Debug)]
pub struct Tree {
    pub config: TreeConfig,
    pub nodes: Vec<Node>,
}

#[derive(Clone, Copy)]
struct State {
    street: Street,
    pot_start: i64,
    committed: [i64; 2],
    invested: [i64; 2],
    /// Stack behind for each player.
    behind: [i64; 2],
    to_act: usize,
    raises: u8,
    /// Size of the last bet/raise increment on this street (for the minimum-raise rule).
    last_increment: i64,
    /// Number of actions taken on this street.
    actions: u8,
}

impl Tree {
    pub fn build(config: &TreeConfig) -> Result<Tree, String> {
        if config.pot <= 0 {
            return Err("the pot must be positive".into());
        }
        if config.stack < 0 {
            return Err("the stack can't be negative".into());
        }
        let mut t = Tree {
            config: config.clone(),
            nodes: Vec::new(),
        };
        let s = State {
            street: config.street,
            pot_start: config.pot,
            committed: [0, 0],
            invested: [0, 0],
            behind: [config.stack, config.stack],
            to_act: 0,
            raises: 0,
            last_increment: 0,
            actions: 0,
        };
        t.add(s);
        Ok(t)
    }

    fn push(&mut self, kind: NodeKind, s: &State) -> usize {
        self.nodes.push(Node {
            kind,
            street: s.street,
            pot_start: s.pot_start,
            committed: s.committed,
            invested: s.invested,
        });
        self.nodes.len() - 1
    }

    /// Street is over (both acted, bets equal): next street, or showdown.
    fn end_street(&mut self, s: State) -> usize {
        let Some(next) = s.street.next() else {
            return self.push(NodeKind::Showdown, &s);
        };
        let n = State {
            street: next,
            pot_start: s.pot_start + s.committed[0] + s.committed[1],
            committed: [0, 0],
            invested: s.invested,
            behind: s.behind,
            to_act: 0,
            raises: 0,
            last_increment: 0,
            actions: 0,
        };
        let id = self.push(
            NodeKind::Chance {
                street: next,
                child: usize::MAX,
            },
            &s,
        );
        // With someone all-in there is no more betting: deal out the remaining cards.
        let child = if s.behind[0] == 0 || s.behind[1] == 0 {
            self.end_street(n)
        } else {
            self.add(n)
        };
        self.nodes[id].kind = NodeKind::Chance {
            street: next,
            child,
        };
        id
    }

    fn add(&mut self, s: State) -> usize {
        let me = s.to_act;
        let opp = 1 - me;
        let cfg = &self.config;
        let sizes = &cfg.sizes[s.street as usize];
        let mine = if me == 0 { &sizes.oop } else { &sizes.ip };
        let pot_now = s.pot_start + s.committed[0] + s.committed[1];
        let facing = s.committed[opp] - s.committed[me];
        let max_to = s.committed[me] + s.behind[me];

        let mut actions: Vec<Action> = Vec::new();
        let push_aggr = |actions: &mut Vec<Action>, mut to: i64, raise: bool| {
            // Minimum raise: the increment must be at least the previous one (or 1 bb for bets).
            let min_inc = if raise { s.last_increment.max(BB) } else { BB };
            let min_to = s.committed[opp].max(s.committed[me]) + min_inc;
            to = to.max(min_to);
            let put_in = to - s.committed[me];
            if to >= max_to || put_in as f64 >= cfg.allin_threshold * s.behind[me] as f64 {
                to = max_to;
            }
            if to <= s.committed[opp] {
                return; // not actually a raise (opponent is all-in or sizes collapse)
            }
            let a = if to == max_to {
                Action::AllIn(to)
            } else if raise {
                Action::Raise(to)
            } else {
                Action::Bet(to)
            };
            if !actions.iter().any(|x| matches!((x, &a), (Action::Bet(p) | Action::Raise(p) | Action::AllIn(p), Action::Bet(q) | Action::Raise(q) | Action::AllIn(q)) if p == q)) {
                actions.push(a);
            }
        };

        if facing > 0 {
            actions.push(Action::Fold);
            actions.push(Action::Call);
            let opp_all_in = s.behind[opp] == 0;
            if s.raises < cfg.max_raises[s.street as usize] && !opp_all_in && s.behind[me] > facing
            {
                for size in &mine.raise {
                    let to = match *size {
                        Size::Pot(f) => {
                            s.committed[opp] + ((pot_now + facing) as f64 * f).round() as i64
                        }
                        Size::AllIn => max_to,
                    };
                    push_aggr(&mut actions, to, true);
                }
            }
        } else {
            actions.push(Action::Check);
            if s.behind[me] > 0 && s.behind[opp] > 0 {
                for size in &mine.bet {
                    let to = match *size {
                        Size::Pot(f) => s.committed[me] + (pot_now as f64 * f).round() as i64,
                        Size::AllIn => max_to,
                    };
                    push_aggr(&mut actions, to, false);
                }
            }
        }
        // Keep a stable, readable order: passive first, then by size.
        actions.sort_by_key(|a| match a {
            Action::Fold => (0, 0),
            Action::Check | Action::Call => (1, 0),
            Action::Bet(t) | Action::Raise(t) | Action::AllIn(t) => (2, *t),
        });

        let id = self.push(
            NodeKind::Action {
                player: me,
                actions: actions.clone(),
                children: Vec::new(),
            },
            &s,
        );
        let mut children = Vec::with_capacity(actions.len());
        for a in &actions {
            let child = match *a {
                Action::Fold => self.push(NodeKind::Fold { folder: me }, &s),
                Action::Check => {
                    if s.actions == 0 {
                        self.add(State {
                            to_act: opp,
                            actions: 1,
                            ..s
                        })
                    } else {
                        self.end_street(s)
                    }
                }
                Action::Call => {
                    let mut n = s;
                    let amount = facing.min(s.behind[me]);
                    n.committed[me] += amount;
                    n.invested[me] += amount;
                    n.behind[me] -= amount;
                    self.end_street(n)
                }
                Action::Bet(to) | Action::Raise(to) | Action::AllIn(to) => {
                    let mut n = s;
                    let put_in = to - s.committed[me];
                    n.committed[me] = to;
                    n.invested[me] += put_in;
                    n.behind[me] -= put_in;
                    n.last_increment = to - s.committed[opp].max(s.committed[me]);
                    if facing > 0 {
                        n.raises += 1;
                    }
                    n.to_act = opp;
                    n.actions += 1;
                    self.add(n)
                }
            };
            children.push(child);
        }
        if let NodeKind::Action { children: c, .. } = &mut self.nodes[id].kind {
            *c = children;
        }
        id
    }

    pub fn num_action_nodes(&self) -> usize {
        self.nodes
            .iter()
            .filter(|n| matches!(n.kind, NodeKind::Action { .. }))
            .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn river(bet: &str, raise: &str, pot: i64, stack: i64) -> Tree {
        let cfg = TreeConfig::simple(
            Street::River,
            pot,
            stack,
            &Size::parse_list(bet).unwrap(),
            &Size::parse_list(raise).unwrap(),
        );
        Tree::build(&cfg).unwrap()
    }

    fn root_actions(t: &Tree) -> Vec<Action> {
        match &t.nodes[0].kind {
            NodeKind::Action { actions, .. } => actions.clone(),
            _ => panic!(),
        }
    }

    #[test]
    fn parse_sizes() {
        assert_eq!(
            Size::parse_list("33, 75% 150 a").unwrap(),
            vec![
                Size::Pot(0.33),
                Size::Pot(0.75),
                Size::Pot(1.5),
                Size::AllIn
            ]
        );
        assert!(Size::parse_list("x").is_err());
        assert!(Size::parse_list("-5").is_err());
    }

    #[test]
    fn bet_sizes_are_fractions_of_the_pot() {
        let t = river("50, 100", "", 1000, 10_000);
        assert_eq!(
            root_actions(&t),
            vec![Action::Check, Action::Bet(500), Action::Bet(1000)]
        );
    }

    #[test]
    fn pot_sized_raise_definition() {
        // Pot 1000, OOP bets 1000; IP raises pot: call 1000 → pot 3000, raise 3000 more → to 4000.
        let t = river("100", "100", 1000, 100_000);
        let NodeKind::Action { children, .. } = &t.nodes[0].kind else {
            panic!()
        };
        let NodeKind::Action { actions, .. } = &t.nodes[children[1]].kind else {
            panic!()
        };
        assert_eq!(
            actions,
            &vec![Action::Fold, Action::Call, Action::Raise(4000)]
        );
    }

    #[test]
    fn big_bets_become_all_in_and_duplicates_merge() {
        // Stack 1200 behind; 150% of 1000 = 1500 > stack → all-in 1200; "a" also all-in → merged.
        let t = river("50, 150, a", "", 1000, 1200);
        assert_eq!(
            root_actions(&t),
            vec![Action::Check, Action::Bet(500), Action::AllIn(1200)]
        );
    }

    #[test]
    fn allin_threshold() {
        let mut cfg = TreeConfig::simple(Street::River, 1000, 1000, &[Size::Pot(0.75)], &[]);
        cfg.allin_threshold = 0.67;
        let t = Tree::build(&cfg).unwrap();
        // 750 is ≥ 67% of the 1000 stack → all-in.
        assert_eq!(root_actions(&t), vec![Action::Check, Action::AllIn(1000)]);
    }

    #[test]
    fn check_check_and_bet_call_reach_showdown_with_right_investments() {
        let t = river("50", "", 1000, 10_000);
        let showdowns: Vec<&Node> = t
            .nodes
            .iter()
            .filter(|n| n.kind == NodeKind::Showdown)
            .collect();
        let mut invested: Vec<[i64; 2]> = showdowns.iter().map(|n| n.invested).collect();
        invested.sort();
        // check-check, bet 500-call, check-bet 500-call
        assert_eq!(invested, vec![[0, 0], [500, 500], [500, 500]]);
        // Folds: bet-fold (IP folds), check-bet-fold (OOP folds).
        let folds: Vec<usize> = t
            .nodes
            .iter()
            .filter_map(|n| {
                if let NodeKind::Fold { folder } = n.kind {
                    Some(folder)
                } else {
                    None
                }
            })
            .collect();
        assert_eq!(folds.len(), 2);
    }

    #[test]
    fn raise_cap_is_respected() {
        let mut cfg = TreeConfig::simple(
            Street::River,
            1000,
            1_000_000,
            &[Size::Pot(0.5)],
            &[Size::Pot(1.0)],
        );
        cfg.max_raises = [1; 3];
        let t = Tree::build(&cfg).unwrap();
        for n in &t.nodes {
            if let NodeKind::Action { actions, .. } = &n.kind {
                let raises_here = actions
                    .iter()
                    .filter(|a| matches!(a, Action::Raise(_)))
                    .count();
                if n.committed[0] != n.committed[1] && n.committed[0].max(n.committed[1]) > 500 {
                    assert_eq!(raises_here, 0, "no re-raise after the one allowed raise");
                }
            }
        }
    }

    #[test]
    fn turn_tree_has_a_chance_node_and_all_in_runs_out() {
        let cfg = TreeConfig::simple(Street::Turn, 1000, 1000, &[Size::AllIn], &[]);
        let t = Tree::build(&cfg).unwrap();
        let chance = t
            .nodes
            .iter()
            .filter(|n| matches!(n.kind, NodeKind::Chance { .. }))
            .count();
        // check-check → river; OOP all-in, call → runout; check, IP all-in, call → runout.
        assert_eq!(chance, 3);
        // After an all-in is called on the turn, the river card leads straight to showdown.
        for n in &t.nodes {
            if let NodeKind::Chance { child, .. } = n.kind
                && n.invested == [1000, 1000]
            {
                assert_eq!(t.nodes[child].kind, NodeKind::Showdown);
            }
        }
        assert_no_betting_after_all_in(&t);
        // Positive control: a river shove after a turn check-check is legitimate and must
        // exist (an earlier, wrong version of this test forbade it, see D-039).
        let river_shove = t.nodes.iter().any(|n| {
            n.street == Street::River
                && n.invested == [1000, 0]
                && matches!(&n.kind, NodeKind::Action { player: 1, actions, .. } if actions == &vec![Action::Fold, Action::Call])
        });
        assert!(river_shove);
    }

    /// Once a player is all-in nobody may bet or raise again: a player facing an all-in can
    /// only fold or call, an all-in player never acts, and below a point where both players
    /// are all-in there are only chance cards and the showdown. A fold is only possible for
    /// the player who has put in less.
    fn assert_no_betting_after_all_in(t: &Tree) {
        let stack = t.config.stack;
        fn below(t: &Tree, id: usize, out: &mut Vec<usize>) {
            out.push(id);
            match &t.nodes[id].kind {
                NodeKind::Action { children, .. } => {
                    children.iter().for_each(|&c| below(t, c, out))
                }
                NodeKind::Chance { child, .. } => below(t, *child, out),
                _ => {}
            }
        }
        for (id, n) in t.nodes.iter().enumerate() {
            let all_in = [n.invested[0] == stack, n.invested[1] == stack];
            match &n.kind {
                NodeKind::Action {
                    player, actions, ..
                } => {
                    assert!(
                        !all_in[*player],
                        "node {id}: an all-in player is asked to act"
                    );
                    if all_in[1 - player] {
                        assert_eq!(
                            actions,
                            &vec![Action::Fold, Action::Call],
                            "node {id}: facing an all-in"
                        );
                    }
                }
                NodeKind::Fold { folder } => {
                    assert!(
                        n.invested[*folder] < n.invested[1 - folder],
                        "node {id}: fold without facing a bet"
                    );
                }
                _ => {}
            }
            if all_in[0] && all_in[1] {
                let mut sub = Vec::new();
                below(t, id, &mut sub);
                for s in sub {
                    assert!(
                        matches!(
                            t.nodes[s].kind,
                            NodeKind::Chance { .. } | NodeKind::Showdown
                        ),
                        "node {s}: decision after both players are all-in"
                    );
                }
            }
        }
    }

    #[test]
    fn no_betting_after_all_in_on_any_street() {
        let trees = [
            TreeConfig::simple(
                Street::Flop,
                1000,
                1500,
                &Size::parse_list("50, a").unwrap(),
                &Size::parse_list("a").unwrap(),
            ),
            TreeConfig::simple(
                Street::Turn,
                1000,
                2500,
                &Size::parse_list("75").unwrap(),
                &Size::parse_list("100").unwrap(),
            ),
            TreeConfig::simple(
                Street::River,
                1000,
                700,
                &Size::parse_list("33, 150").unwrap(),
                &Size::parse_list("100").unwrap(),
            ),
        ];
        for cfg in trees {
            let t = Tree::build(&cfg).unwrap();
            // Each of these stacks is small enough that some line ends all-in.
            assert!(
                t.nodes.iter().any(|n| n.invested == [cfg.stack, cfg.stack]),
                "{:?}",
                cfg.street
            );
            assert_no_betting_after_all_in(&t);
        }
    }
}
