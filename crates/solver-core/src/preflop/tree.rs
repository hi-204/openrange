//! Preflop betting trees for 2–6 players, used by the sampled-CFR solver in
//! [`super::mccfr`].
//!
//! Seats are numbered in preflop order of action; the last two seats are the small and big
//! blind (6-max: UTG, HJ, CO, BTN, SB, BB). All amounts are big blinds. Two builders:
//! - [`push_fold`]: every bet is all-in (short-stack tournament play);
//! - [`cash`]: a 6-max cash-game tree with opens, 3-bets, squeezes, 4-bets and 5-bet jams,
//!   with the simplifications listed on [`CashConfig`].

use std::fmt;

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum PAction {
    Fold,
    Call,
    /// Raise so that this player's total contribution becomes `to`.
    Raise(f64),
    AllIn(f64),
}

impl PAction {
    pub fn is_aggressive(&self) -> bool {
        matches!(self, PAction::Raise(_) | PAction::AllIn(_))
    }
}

impl fmt::Display for PAction {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let bb = |x: &f64| (x * 100.0).round() / 100.0;
        match self {
            PAction::Fold => write!(f, "Fold"),
            PAction::Call => write!(f, "Call"),
            PAction::Raise(to) => write!(f, "Raise {}", bb(to)),
            PAction::AllIn(to) => write!(f, "All-in {}", bb(to)),
        }
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum Terminal {
    /// Everyone else folded.
    Uncontested { winner: usize },
    /// Somebody is all-in and called: cards are dealt out.
    Showdown { players: u8 },
    /// Betting closed with several players and chips behind: postflop play is modelled
    /// (equity realization). `level`: 1 single-raised pot, 2 three-bet pot, 3+ four-bet pot.
    Flop {
        players: u8,
        level: u8,
        aggressor: usize,
    },
}

#[derive(Clone, Debug, PartialEq)]
pub enum PNode {
    Action {
        player: usize,
        actions: Vec<PAction>,
        children: Vec<usize>,
    },
    Terminal {
        contrib: Vec<f64>,
        kind: Terminal,
    },
}

#[derive(Clone, Debug)]
pub struct PreflopTree {
    pub players: usize,
    pub stack: f64,
    pub nodes: Vec<PNode>,
    /// Short description of the line leading to each node ("CO raise 2.5, BTN call").
    pub lines: Vec<String>,
}

pub fn seat_name(players: usize, seat: usize) -> &'static str {
    const SIX: [&str; 6] = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
    if players == 2 {
        return ["SB", "BB"][seat];
    }
    SIX[6 - players + seat]
}

/// Postflop order: the small blind acts first, then the big blind, then the other seats in
/// preflop order. Higher = acts later (in position).
pub fn postflop_rank(players: usize, seat: usize) -> usize {
    if players == 2 {
        // Heads-up, the small blind is the button and acts last after the flop.
        return 1 - seat;
    }
    (seat + 2) % players
}

/// What the rules allow a player to do at a given point (decided by the tree flavour).
trait Rules {
    fn actions(&self, s: &State, p: usize) -> Vec<PAction>;
}

#[derive(Clone, Debug)]
struct State {
    players: usize,
    stack: f64,
    contrib: Vec<f64>,
    folded: u8,
    /// Raise level: 0 nothing yet (blinds only), 1 open, 2 three-bet, 3 four-bet, 4 five-bet.
    level: u8,
    bet: f64,
    /// Size of the opening raise (for 3-bet / squeeze sizing).
    open_to: f64,
    aggressor: Option<usize>,
    /// Player who made the raise at each level (index = level).
    raiser: [Option<usize>; 5],
    /// Players who called the open before any 3-bet.
    cold_callers: u8,
    to_act: Vec<usize>,
    line: Vec<String>,
}

impl State {
    fn new(players: usize, stack: f64, blinds: (f64, f64), ante: f64) -> State {
        let mut contrib = vec![ante; players];
        contrib[players - 2] += blinds.0;
        contrib[players - 1] += blinds.1;
        State {
            players,
            stack,
            contrib,
            folded: 0,
            level: 0,
            bet: blinds.1 + ante,
            open_to: 0.0,
            aggressor: None,
            raiser: [None; 5],
            cold_callers: 0,
            to_act: (0..players).collect(),
            line: Vec::new(),
        }
    }

    fn active(&self) -> Vec<usize> {
        (0..self.players)
            .filter(|&i| self.folded & (1 << i) == 0)
            .collect()
    }

    fn all_in(&self, p: usize) -> bool {
        self.contrib[p] >= self.stack - 1e-9
    }
}

struct Builder<'a, R: Rules> {
    rules: &'a R,
    tree: PreflopTree,
}

impl<R: Rules> Builder<'_, R> {
    fn add(&mut self, mut s: State) -> usize {
        let id = self.tree.nodes.len();
        self.tree.lines.push(s.line.join(", "));
        self.tree.nodes.push(PNode::Terminal {
            contrib: vec![],
            kind: Terminal::Uncontested { winner: 0 },
        });
        // Skip players who can no longer act.
        while let Some(&p) = s.to_act.first() {
            if s.folded & (1 << p) != 0 || s.all_in(p) {
                s.to_act.remove(0);
            } else {
                break;
            }
        }
        let active = s.active();
        let node = if active.len() == 1 {
            PNode::Terminal {
                contrib: s.contrib.clone(),
                kind: Terminal::Uncontested { winner: active[0] },
            }
        } else if s.to_act.is_empty() || (s.level == 0 && s.to_act == [s.players - 1]) {
            // Betting is closed. (If everyone folds to the big blind it wins: handled by the
            // single-active case; with no raise and only the big blind left to act, everyone
            // else folded.)
            let mask = active.iter().fold(0u8, |m, &i| m | (1 << i));
            if s.level == 0 {
                PNode::Terminal {
                    contrib: s.contrib.clone(),
                    kind: Terminal::Uncontested {
                        winner: s.players - 1,
                    },
                }
            } else if active.iter().any(|&i| s.all_in(i)) {
                PNode::Terminal {
                    contrib: s.contrib.clone(),
                    kind: Terminal::Showdown { players: mask },
                }
            } else {
                PNode::Terminal {
                    contrib: s.contrib.clone(),
                    kind: Terminal::Flop {
                        players: mask,
                        level: s.level,
                        aggressor: s.aggressor.expect("a raise happened"),
                    },
                }
            }
        } else {
            let p = s.to_act[0];
            let actions = self.rules.actions(&s, p);
            let mut children = Vec::with_capacity(actions.len());
            for a in &actions {
                let mut n = s.clone();
                n.to_act.remove(0);
                n.line.push(format!(
                    "{} {}",
                    seat_name(s.players, p),
                    a.to_string().to_lowercase()
                ));
                match *a {
                    PAction::Fold => n.folded |= 1 << p,
                    PAction::Call => {
                        n.contrib[p] = n.bet.min(n.stack);
                        if n.level == 1 && Some(p) != n.raiser[1] {
                            n.cold_callers |= 1 << p;
                        }
                    }
                    PAction::Raise(to) | PAction::AllIn(to) => {
                        n.contrib[p] = to;
                        n.bet = to;
                        n.level += 1;
                        if n.level == 1 {
                            n.open_to = to;
                        }
                        n.raiser[n.level as usize] = Some(p);
                        n.aggressor = Some(p);
                        // Everyone else still in the hand acts again, in order after p.
                        n.to_act = (1..n.players)
                            .map(|k| (p + k) % n.players)
                            .filter(|&q| n.folded & (1 << q) == 0 && !n.all_in(q))
                            .collect();
                    }
                }
                children.push(self.add(n));
            }
            PNode::Action {
                player: p,
                actions,
                children,
            }
        };
        self.tree.nodes[id] = node;
        id
    }
}

fn build<R: Rules>(
    rules: &R,
    players: usize,
    stack: f64,
    blinds: (f64, f64),
    ante: f64,
) -> PreflopTree {
    let mut b = Builder {
        rules,
        tree: PreflopTree {
            players,
            stack,
            nodes: Vec::new(),
            lines: Vec::new(),
        },
    };
    b.add(State::new(players, stack, blinds, ante));
    b.tree
}

// ---------------------------------------------------------------------------------------

struct PushFold;

impl Rules for PushFold {
    fn actions(&self, s: &State, _p: usize) -> Vec<PAction> {
        if s.level == 0 {
            vec![PAction::Fold, PAction::AllIn(s.stack)]
        } else {
            vec![PAction::Fold, PAction::Call]
        }
    }
}

/// Push/fold tree: shove or fold while nobody has shoved; afterwards call or fold.
pub fn push_fold(players: usize, stack: f64, ante: f64) -> Result<PreflopTree, String> {
    if !(2..=6).contains(&players) {
        return Err("push/fold supports 2 to 6 players".into());
    }
    if stack < 1.0 + ante {
        return Err("the stack must cover the big blind and the ante".into());
    }
    Ok(build(&PushFold, players, stack, (0.5, 1.0), ante))
}

// ---------------------------------------------------------------------------------------

/// 6-max cash tree settings (tree inputs, not strategy). Simplifications, all documented in
/// KNOWN_LIMITS: no limping; at most `max_cold_callers` cold calls of an open; facing a
/// 3-bet, players who haven't put money in may only fold (no cold 4-bets or cold calls);
/// facing a 4-bet or a 5-bet only the player who made the previous raise continues.
#[derive(Clone, Debug, PartialEq)]
pub struct CashConfig {
    pub stack: f64,
    /// Open-raise size (raise to) for UTG, HJ, CO, BTN and SB.
    pub open: [f64; 5],
    /// 3-bet to = open × this, in position / out of position.
    pub three_bet_ip: f64,
    pub three_bet_oop: f64,
    /// Squeeze: 3-bet size plus this many opens per cold caller.
    pub squeeze_per_caller: f64,
    /// 4-bet to = 3-bet × this.
    pub four_bet: f64,
    /// A raise to at least this fraction of the stack becomes all-in.
    pub all_in_fraction: f64,
    pub max_cold_callers: u8,
}

impl CashConfig {
    pub fn six_max(stack: f64) -> CashConfig {
        CashConfig {
            stack,
            open: [2.5, 2.5, 2.5, 2.5, 3.0],
            three_bet_ip: 3.0,
            three_bet_oop: 4.0,
            squeeze_per_caller: 1.0,
            four_bet: 2.3,
            all_in_fraction: 0.4,
            max_cold_callers: 1,
        }
    }
}

struct Cash<'a>(&'a CashConfig);

impl Rules for Cash<'_> {
    fn actions(&self, s: &State, p: usize) -> Vec<PAction> {
        let c = self.0;
        let n = s.players;
        let raise = |to: f64| -> PAction {
            if to >= c.all_in_fraction * s.stack || to >= s.stack {
                PAction::AllIn(s.stack)
            } else {
                PAction::Raise(to)
            }
        };
        let opp_all_in = s.raiser[s.level as usize].is_some_and(|r| s.all_in(r));
        match s.level {
            0 => vec![PAction::Fold, raise(c.open[p.min(4)])],
            1 => {
                let opener = s.raiser[1].expect("open");
                let callers = s.cold_callers.count_ones() as u8;
                let ip = postflop_rank(n, p) > postflop_rank(n, opener);
                let base = s.open_to * if ip { c.three_bet_ip } else { c.three_bet_oop };
                let to = base + c.squeeze_per_caller * s.open_to * callers as f64;
                let mut a = vec![PAction::Fold];
                // The big blind may always defend; others only while the caller cap allows.
                if callers < c.max_cold_callers || p == n - 1 || p == n - 2 {
                    a.push(PAction::Call);
                }
                if !opp_all_in {
                    a.push(raise(to));
                }
                a
            }
            2 => {
                let in_play = s.raiser[1] == Some(p) || s.cold_callers & (1 << p) != 0;
                if !in_play {
                    return vec![PAction::Fold];
                }
                let mut a = vec![PAction::Fold, PAction::Call];
                if s.raiser[1] == Some(p) && !opp_all_in {
                    a.push(raise(s.bet * c.four_bet));
                }
                a
            }
            3 => {
                if s.raiser[2] != Some(p) {
                    return vec![PAction::Fold];
                }
                let mut a = vec![PAction::Fold, PAction::Call];
                if !opp_all_in {
                    a.push(PAction::AllIn(s.stack));
                }
                a
            }
            _ => {
                if s.raiser[3] != Some(p) {
                    return vec![PAction::Fold];
                }
                vec![PAction::Fold, PAction::Call]
            }
        }
    }
}

/// 6-max cash-game preflop tree (blinds 0.5/1, no ante).
pub fn cash(config: &CashConfig) -> PreflopTree {
    build(&Cash(config), 6, config.stack, (0.5, 1.0), 0.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn terminals(t: &PreflopTree) -> impl Iterator<Item = (&Vec<f64>, &Terminal)> {
        t.nodes.iter().filter_map(|n| match n {
            PNode::Terminal { contrib, kind } => Some((contrib, kind)),
            _ => None,
        })
    }

    #[test]
    fn heads_up_push_fold_tree() {
        let t = push_fold(2, 10.0, 0.0).unwrap();
        // SB: fold | shove; BB vs shove: fold | call.
        assert_eq!(
            t.nodes
                .iter()
                .filter(|n| matches!(n, PNode::Action { .. }))
                .count(),
            2
        );
        let kinds: Vec<&Terminal> = terminals(&t).map(|(_, k)| k).collect();
        assert!(kinds.contains(&&Terminal::Uncontested { winner: 1 }));
        assert!(kinds.contains(&&Terminal::Uncontested { winner: 0 }));
        assert!(kinds.contains(&&Terminal::Showdown { players: 0b11 }));
    }

    #[test]
    fn six_player_push_fold_has_every_decision() {
        let t = push_fold(6, 10.0, 0.1).unwrap();
        for (contrib, kind) in terminals(&t) {
            if let Terminal::Showdown { players } = kind {
                for (i, &c) in contrib.iter().enumerate() {
                    if players & (1 << i) != 0 {
                        assert_eq!(c, 10.0);
                    }
                }
            }
        }
        // Every way the shove can be called or folded by later players is in the tree.
        let showdowns = terminals(&t)
            .filter(|(_, k)| matches!(k, Terminal::Showdown { .. }))
            .count();
        // Shover s ∈ 0..5, each of the 5 − s later players calls or folds, minus the all-fold case.
        let expected: usize = (0..5).map(|s| (1usize << (5 - s)) - 1).sum();
        assert_eq!(showdowns, expected);
    }

    #[test]
    fn cash_tree_shapes_and_sizes() {
        let t = cash(&CashConfig::six_max(100.0));
        let action_nodes = t
            .nodes
            .iter()
            .filter(|n| matches!(n, PNode::Action { .. }))
            .count();
        assert!(action_nodes > 50, "{action_nodes}");
        // UTG opens 2.5.
        let PNode::Action { actions, .. } = &t.nodes[0] else {
            panic!()
        };
        assert_eq!(actions, &vec![PAction::Fold, PAction::Raise(2.5)]);
        for (contrib, kind) in terminals(&t) {
            // Nobody puts in more than the stack; a flop has at least two players with equal bets.
            assert!(contrib.iter().all(|&c| c <= 100.0 + 1e-9));
            if let Terminal::Flop { players, .. } = kind {
                let bets: Vec<f64> = (0..6)
                    .filter(|i| players & (1 << i) != 0)
                    .map(|i| contrib[i])
                    .collect();
                assert!(
                    bets.len() >= 2 && bets.iter().all(|&b| (b - bets[0]).abs() < 1e-9),
                    "{bets:?}"
                );
            }
        }
        // A 3-bet in position is 3× the open; out of position 4×.
        let line = |l: &str| t.lines.iter().position(|x| x == l).unwrap();
        let co_open = line("UTG fold, HJ fold, CO raise 2.5");
        let PNode::Action { actions, .. } = &t.nodes[co_open] else {
            panic!()
        };
        assert_eq!(actions[2], PAction::Raise(7.5)); // BTN, in position
        let bb_vs_btn = line("UTG fold, HJ fold, CO fold, BTN raise 2.5, SB fold");
        let PNode::Action { actions, .. } = &t.nodes[bb_vs_btn] else {
            panic!()
        };
        assert_eq!(actions[2], PAction::Raise(10.0)); // BB, out of position
    }

    #[test]
    fn short_cash_stacks_turn_raises_into_all_ins() {
        let t = cash(&CashConfig::six_max(20.0));
        // A 4-bet would be 2.3 × 7.5 = 17.25 ≥ 40% of 20 bb → all-in.
        assert!(t.nodes.iter().any(|n| matches!(n, PNode::Action { actions, .. } if actions.contains(&PAction::AllIn(20.0)))));
        for (contrib, _) in terminals(&t) {
            assert!(contrib.iter().all(|&c| c <= 20.0 + 1e-9));
        }
    }

    #[test]
    fn positions() {
        assert_eq!(seat_name(6, 0), "UTG");
        assert_eq!(seat_name(6, 5), "BB");
        assert_eq!(seat_name(3, 0), "BTN");
        assert!(postflop_rank(6, 3) > postflop_rank(6, 0)); // BTN acts after UTG
        assert!(postflop_rank(6, 5) > postflop_rank(6, 4)); // BB after SB
        assert!(postflop_rank(2, 0) > postflop_rank(2, 1)); // heads-up SB is the button
    }
}
