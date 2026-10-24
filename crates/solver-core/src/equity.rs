//! All-in equity: exact enumeration of runouts, and seeded Monte Carlo.
//!
//! Equity is the expected share of the pot at showdown with ties split, e.g. a 50/50 chop
//! counts as half a win. Exact range-vs-range uses the sorted-strength sweep with per-card
//! accumulators (docs/ARCHITECTURE.md §1.8) so each runout costs O(n log n), not O(n²).

use crate::cards::{Card, CardSet, Combo};
use crate::eval::{Evaluator, HandKey, Strength};
use crate::range::Range;
use crate::rng::Rng;
use std::fmt;

#[derive(Clone, Debug, PartialEq)]
pub enum EquityError {
    TooManyBoardCards,
    DuplicateCards,
    /// Player index whose range has no combos left after removing board and dead cards.
    EmptyRange(usize),
    /// The ranges (almost) never fit together without sharing cards.
    Conflict,
    NotEnoughPlayers,
}

impl fmt::Display for EquityError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            EquityError::TooManyBoardCards => write!(f, "a board has at most 5 cards"),
            EquityError::DuplicateCards => write!(f, "the same card appears twice"),
            EquityError::EmptyRange(p) => {
                write!(
                    f,
                    "player {}'s range has no hands left after removing the board and dead cards",
                    p + 1
                )
            }
            EquityError::Conflict => write!(
                f,
                "these ranges can't be dealt together without sharing cards"
            ),
            EquityError::NotEnoughPlayers => write!(f, "equity needs at least two players"),
        }
    }
}

impl std::error::Error for EquityError {}

fn check_board(board: &[Card], dead: CardSet) -> Result<CardSet, EquityError> {
    if board.len() > 5 {
        return Err(EquityError::TooManyBoardCards);
    }
    let b = CardSet::from_cards(board);
    if b.len() as usize != board.len() || b.intersects(dead) {
        return Err(EquityError::DuplicateCards);
    }
    Ok(b)
}

/// Calls `f(board_key, board_cards)` once for every way to complete `board` to five cards
/// using cards outside `blocked` (which must include the board itself).
pub fn for_each_runout(board: &[Card], blocked: CardSet, mut f: impl FnMut(HandKey, CardSet)) {
    let live: Vec<Card> = (0..52)
        .map(Card::from_index)
        .filter(|c| !blocked.contains(*c))
        .collect();
    let need = 5 - board.len();
    fn rec(
        live: &[Card],
        start: usize,
        need: usize,
        key: HandKey,
        set: CardSet,
        f: &mut dyn FnMut(HandKey, CardSet),
    ) {
        if need == 0 {
            f(key, set);
            return;
        }
        for i in start..=(live.len() - need) {
            let c = live[i];
            rec(
                live,
                i + 1,
                need - 1,
                key.with(c),
                CardSet(set.0 | c.bit()),
                f,
            );
        }
    }
    rec(
        &live,
        0,
        need,
        HandKey::from_cards(board),
        CardSet::from_cards(board),
        &mut f,
    );
}

/// Number of ways to complete a board with `known` cards from `live` remaining cards.
pub fn runout_count(live: u64, board_len: usize) -> u64 {
    let k = 5 - board_len as u64;
    (0..k).fold(1u64, |acc, i| acc * (live - i) / (i + 1))
}

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct HandVsHand {
    pub win: f64,
    pub tie: f64,
    pub lose: f64,
    pub runouts: u64,
}

impl HandVsHand {
    pub fn equity(&self) -> f64 {
        self.win + self.tie / 2.0
    }
}

/// Exact equity of combo `a` against combo `b`.
pub fn hand_vs_hand(
    a: Combo,
    b: Combo,
    board: &[Card],
    dead: CardSet,
) -> Result<HandVsHand, EquityError> {
    let bset = check_board(board, dead)?;
    let blocked = CardSet(bset.0 | dead.0 | a.cards().0 | b.cards().0);
    if a.cards().intersects(b.cards())
        || a.cards().intersects(CardSet(bset.0 | dead.0))
        || b.cards().intersects(CardSet(bset.0 | dead.0))
    {
        return Err(EquityError::DuplicateCards);
    }
    let e = Evaluator::get();
    let (ka, kb) = (
        HandKey::from_cards(&[a.hi, a.lo]),
        HandKey::from_cards(&[b.hi, b.lo]),
    );
    let (mut win, mut tie, mut n) = (0u64, 0u64, 0u64);
    for_each_runout(board, blocked, |key, _| {
        let (sa, sb) = (e.eval_key(key.merge(ka)), e.eval_key(key.merge(kb)));
        n += 1;
        if sa > sb {
            win += 1;
        } else if sa == sb {
            tie += 1;
        }
    });
    let nf = n as f64;
    Ok(HandVsHand {
        win: win as f64 / nf,
        tie: tie as f64 / nf,
        lose: (n - win - tie) as f64 / nf,
        runouts: n,
    })
}

#[derive(Clone, Debug)]
pub struct ComboEquity {
    pub combo: Combo,
    pub weight: f32,
    /// Equity of this combo against the villain range.
    pub equity: f64,
}

#[derive(Clone, Debug)]
pub struct RangeVsRange {
    pub equity: f64,
    pub tie: f64,
    pub per_combo: Vec<ComboEquity>,
    pub runouts: u64,
}

/// Rough work estimate for [`exact_range_vs_range`]: runouts × hands evaluated per runout.
pub fn exact_cost(hero: &Range, villain: &Range, board: &[Card], dead: CardSet) -> f64 {
    let blocked = CardSet(CardSet::from_cards(board).0 | dead.0);
    let live = 52 - blocked.len() as u64;
    let n = hero.without(blocked).iter().count() + villain.without(blocked).iter().count();
    runout_count(live, board.len().min(5)) as f64 * n as f64
}

/// Exact equity of `hero` against `villain`, overall and per hero combo.
pub fn exact_range_vs_range(
    hero: &Range,
    villain: &Range,
    board: &[Card],
    dead: CardSet,
) -> Result<RangeVsRange, EquityError> {
    let bset = check_board(board, dead)?;
    let blocked = CardSet(bset.0 | dead.0);
    let hero: Vec<(Combo, f32)> = hero.without(blocked).iter().collect();
    let villain_r = villain.without(blocked);
    let villain: Vec<(Combo, f32)> = villain_r.iter().collect();
    if hero.is_empty() {
        return Err(EquityError::EmptyRange(0));
    }
    if villain.is_empty() {
        return Err(EquityError::EmptyRange(1));
    }
    let e = Evaluator::get();
    let key_of = |c: Combo| HandKey::from_cards(&[c.hi, c.lo]);
    let hero_keys: Vec<HandKey> = hero.iter().map(|&(c, _)| key_of(c)).collect();
    let vill_keys: Vec<HandKey> = villain.iter().map(|&(c, _)| key_of(c)).collect();

    let (mut win, mut tie, mut tot) = (
        vec![0f64; hero.len()],
        vec![0f64; hero.len()],
        vec![0f64; hero.len()],
    );
    let mut hs: Vec<(Strength, usize)> = Vec::with_capacity(hero.len());
    let mut vs: Vec<(Strength, usize)> = Vec::with_capacity(villain.len());
    let mut runouts = 0u64;

    for_each_runout(board, blocked, |key, runout| {
        runouts += 1;
        hs.clear();
        vs.clear();
        for (i, &(c, _)) in hero.iter().enumerate() {
            if !c.cards().intersects(runout) {
                hs.push((e.eval_key(key.merge(hero_keys[i])), i));
            }
        }
        for (j, &(c, _)) in villain.iter().enumerate() {
            if !c.cards().intersects(runout) {
                vs.push((e.eval_key(key.merge(vill_keys[j])), j));
            }
        }
        hs.sort_unstable();
        vs.sort_unstable();

        // Villain weight in total and per card, for all live villain combos.
        let mut all_card = [0f64; 52];
        let mut all_total = 0f64;
        for &(_, j) in vs.iter() {
            let (c, w) = villain[j];
            all_total += w as f64;
            all_card[c.hi.index() as usize] += w as f64;
            all_card[c.lo.index() as usize] += w as f64;
        }
        // Sweep: villain combos strictly weaker (less) and weaker-or-equal (le) than hero.
        let (mut less_card, mut le_card) = ([0f64; 52], [0f64; 52]);
        let (mut less_total, mut le_total) = (0f64, 0f64);
        let (mut p_less, mut p_le) = (0usize, 0usize);
        for &(s_h, i) in hs.iter() {
            while p_less < vs.len() && vs[p_less].0 < s_h {
                let (c, w) = villain[vs[p_less].1];
                less_total += w as f64;
                less_card[c.hi.index() as usize] += w as f64;
                less_card[c.lo.index() as usize] += w as f64;
                p_less += 1;
            }
            while p_le < vs.len() && vs[p_le].0 <= s_h {
                let (c, w) = villain[vs[p_le].1];
                le_total += w as f64;
                le_card[c.hi.index() as usize] += w as f64;
                le_card[c.lo.index() as usize] += w as f64;
                p_le += 1;
            }
            let c = hero[i].0;
            let (a, b) = (c.hi.index() as usize, c.lo.index() as usize);
            // The villain combo identical to the hero combo touches both of the hero's cards,
            // so it is subtracted twice by the per-card terms; add it back once. It can't be
            // strictly weaker (same strength), so `less` needs no correction.
            let same = villain_r.weight(c) as f64;
            let less = less_total - less_card[a] - less_card[b];
            let le = le_total - le_card[a] - le_card[b] + same;
            let total = all_total - all_card[a] - all_card[b] + same;
            win[i] += less;
            tie[i] += le - less;
            tot[i] += total;
        }
    });

    let (mut num, mut ties, mut den) = (0f64, 0f64, 0f64);
    let mut per_combo = Vec::with_capacity(hero.len());
    for (i, &(combo, w)) in hero.iter().enumerate() {
        let w64 = w as f64;
        num += w64 * (win[i] + tie[i] / 2.0);
        ties += w64 * tie[i];
        den += w64 * tot[i];
        if tot[i] > 0.0 {
            per_combo.push(ComboEquity {
                combo,
                weight: w,
                equity: (win[i] + tie[i] / 2.0) / tot[i],
            });
        }
    }
    if den == 0.0 {
        return Err(EquityError::Conflict);
    }
    Ok(RangeVsRange {
        equity: num / den,
        tie: ties / den,
        per_combo,
        runouts,
    })
}

#[derive(Clone, Debug)]
pub struct MonteCarlo {
    pub equity: Vec<f64>,
    pub win: Vec<f64>,
    pub tie: Vec<f64>,
    /// Standard error of each equity estimate.
    pub std_error: Vec<f64>,
    pub samples: u64,
}

struct Sampler {
    combos: Vec<Combo>,
    cumulative: Vec<f64>,
}

impl Sampler {
    fn new(r: &Range) -> Sampler {
        let mut combos = Vec::new();
        let mut cumulative = Vec::new();
        let mut acc = 0.0;
        for (c, w) in r.iter() {
            acc += w as f64;
            combos.push(c);
            cumulative.push(acc);
        }
        Sampler { combos, cumulative }
    }

    fn draw(&self, rng: &mut Rng) -> Combo {
        let total = *self.cumulative.last().expect("non-empty");
        let x = rng.f64() * total;
        let i = self
            .cumulative
            .partition_point(|&c| c <= x)
            .min(self.combos.len() - 1);
        self.combos[i]
    }
}

/// Monte Carlo equity for 2+ players. Deterministic for a given seed.
///
/// Hands are drawn with probability proportional to the product of their weights among
/// deals where no two players share a card (whole deals are redrawn on any conflict, which
/// keeps the joint distribution exact).
pub fn monte_carlo(
    ranges: &[Range],
    board: &[Card],
    dead: CardSet,
    samples: u64,
    seed: u64,
) -> Result<MonteCarlo, EquityError> {
    if ranges.len() < 2 {
        return Err(EquityError::NotEnoughPlayers);
    }
    let bset = check_board(board, dead)?;
    let blocked = CardSet(bset.0 | dead.0);
    let samplers: Vec<Sampler> = ranges
        .iter()
        .map(|r| Sampler::new(&r.without(blocked)))
        .collect();
    if let Some(p) = samplers.iter().position(|s| s.combos.is_empty()) {
        return Err(EquityError::EmptyRange(p));
    }
    let e = Evaluator::get();
    let n = ranges.len();
    let board_key = HandKey::from_cards(board);
    let need = 5 - board.len();
    let mut rng = Rng::seed(seed);
    let (mut sum, mut sum_sq, mut wins, mut ties) =
        (vec![0f64; n], vec![0f64; n], vec![0u64; n], vec![0u64; n]);
    let mut hands = vec![Combo::from_index(0); n];
    let mut strengths = vec![Strength(0); n];

    for _ in 0..samples {
        let mut used;
        let mut attempts = 0;
        'deal: loop {
            attempts += 1;
            if attempts > 10_000 {
                return Err(EquityError::Conflict);
            }
            used = blocked;
            for p in 0..n {
                let c = samplers[p].draw(&mut rng);
                if c.cards().intersects(used) {
                    continue 'deal;
                }
                used = CardSet(used.0 | c.cards().0);
                hands[p] = c;
            }
            break;
        }
        let runout = rng.sample_cards(need, used.0);
        let key = runout.iter().fold(board_key, |k, &c| k.with(c));
        for p in 0..n {
            strengths[p] = e.eval_key(key.with(hands[p].hi).with(hands[p].lo));
        }
        let best = *strengths.iter().max().expect("n ≥ 2");
        let winners = strengths.iter().filter(|&&s| s == best).count();
        let share = 1.0 / winners as f64;
        for p in 0..n {
            if strengths[p] == best {
                sum[p] += share;
                sum_sq[p] += share * share;
                if winners == 1 {
                    wins[p] += 1;
                } else {
                    ties[p] += 1;
                }
            }
        }
    }
    let s = samples as f64;
    let equity: Vec<f64> = sum.iter().map(|x| x / s).collect();
    let std_error = (0..n)
        .map(|p| {
            let var = (sum_sq[p] / s - equity[p] * equity[p]).max(0.0);
            (var / s).sqrt()
        })
        .collect();
    Ok(MonteCarlo {
        equity,
        win: wins.iter().map(|&w| w as f64 / s).collect(),
        tie: ties.iter().map(|&t| t as f64 / s).collect(),
        std_error,
        samples,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::parse_cards;
    use crate::eval::reference;

    fn combo(s: &str) -> Combo {
        Combo::parse(s).unwrap()
    }
    fn cards(s: &str) -> Vec<Card> {
        parse_cards(s).unwrap()
    }
    fn range(s: &str) -> Range {
        Range::parse(s).unwrap()
    }

    #[test]
    fn river_results_are_exact() {
        // Board: As Kd 7h 4c 2s. AhQc has top pair; KsKc has a set and wins outright.
        let r = hand_vs_hand(
            combo("AhQc"),
            combo("KsKc"),
            &cards("AsKd7h4c2s"),
            CardSet::EMPTY,
        )
        .unwrap();
        assert_eq!((r.win, r.tie, r.lose, r.runouts), (0.0, 0.0, 1.0, 1));
        // Board plays a broadway straight for both: a chop.
        let r = hand_vs_hand(
            combo("2c3d"),
            combo("4h5s"),
            &cards("AsKdQhJcTd"),
            CardSet::EMPTY,
        )
        .unwrap();
        assert_eq!(r.tie, 1.0);
        assert_eq!(r.equity(), 0.5);
    }

    #[test]
    fn turn_matches_brute_force_with_reference_evaluator() {
        let (a, b) = (combo("Ah9h"), combo("QcQd"));
        let board = cards("Kh7h2c3s");
        let r = hand_vs_hand(a, b, &board, CardSet::EMPTY).unwrap();
        let used = CardSet(CardSet::from_cards(&board).0 | a.cards().0 | b.cards().0);
        let (mut w, mut t, mut n) = (0, 0, 0);
        for i in 0..52 {
            let river = Card::from_index(i);
            if used.contains(river) {
                continue;
            }
            let mut full = board.clone();
            full.push(river);
            let sa = reference::eval(&[&full[..], &[a.hi, a.lo]].concat());
            let sb = reference::eval(&[&full[..], &[b.hi, b.lo]].concat());
            n += 1;
            if sa > sb {
                w += 1;
            } else if sa == sb {
                t += 1;
            }
        }
        assert_eq!(r.runouts, n);
        assert_eq!(r.win, w as f64 / n as f64);
        assert_eq!(r.tie, t as f64 / n as f64);
    }

    #[test]
    fn mirrored_matchups_sum_to_one() {
        let pairs = [("AsKs", "QhQd"), ("7c2d", "8h8s"), ("AhKd", "AcKh")];
        for board in ["", "Ts9s3d"] {
            for (x, y) in pairs {
                let b = cards(board);
                let ab = hand_vs_hand(combo(x), combo(y), &b, CardSet::EMPTY).unwrap();
                let ba = hand_vs_hand(combo(y), combo(x), &b, CardSet::EMPTY).unwrap();
                assert!((ab.equity() + ba.equity() - 1.0).abs() < 1e-12);
                assert_eq!(ab.win, ba.lose);
            }
        }
    }

    #[test]
    fn range_sweep_matches_pairwise_enumeration() {
        // Weighted ranges with card overlap, on a flop: the O(n log n) sweep must equal the
        // weight-averaged pairwise hand-vs-hand results.
        let hero = range("AA, KQs:0.5, 76s, AhTh:0.3");
        let villain = range("KK-TT, AK:0.7, Ts9s");
        let board = cards("Th7h6c");
        let fast = exact_range_vs_range(&hero, &villain, &board, CardSet::EMPTY).unwrap();
        let blocked = CardSet::from_cards(&board);
        let (mut num, mut den) = (0.0, 0.0);
        for (h, wh) in hero.without(blocked).iter() {
            for (v, wv) in villain.without(blocked).iter() {
                if h.cards().intersects(v.cards()) {
                    continue;
                }
                let r = hand_vs_hand(h, v, &board, CardSet::EMPTY).unwrap();
                let w = wh as f64 * wv as f64;
                num += w * r.equity();
                den += w;
            }
        }
        assert!(
            (fast.equity - num / den).abs() < 1e-12,
            "{} vs {}",
            fast.equity,
            num / den
        );
    }

    #[test]
    fn monte_carlo_agrees_with_exact_within_4_sigma() {
        let hero = range("88+, AJs+, KQs");
        let villain = range("22+, A2s+, KTo+");
        let board = cards("Qs8d3c");
        let exact = exact_range_vs_range(&hero, &villain, &board, CardSet::EMPTY).unwrap();
        let mc = monte_carlo(&[hero, villain], &board, CardSet::EMPTY, 200_000, 99).unwrap();
        let z = (mc.equity[0] - exact.equity) / mc.std_error[0];
        assert!(
            z.abs() < 4.0,
            "exact {} mc {} se {}",
            exact.equity,
            mc.equity[0],
            mc.std_error[0]
        );
    }

    #[test]
    fn multiway_shares_sum_to_one_and_symmetric_ranges_split_evenly() {
        let r = range("22+, A2s+, K9s+, ATo+");
        let mc = monte_carlo(&[r.clone(), r.clone(), r], &[], CardSet::EMPTY, 60_000, 5).unwrap();
        let total: f64 = mc.equity.iter().sum();
        assert!((total - 1.0).abs() < 1e-9);
        for p in 0..3 {
            let z = (mc.equity[p] - 1.0 / 3.0) / mc.std_error[p];
            assert!(
                z.abs() < 4.0,
                "player {p}: {} ± {}",
                mc.equity[p],
                mc.std_error[p]
            );
        }
    }

    #[test]
    fn monte_carlo_is_deterministic() {
        let a = monte_carlo(&[range("AA"), range("KK")], &[], CardSet::EMPTY, 5_000, 1).unwrap();
        let b = monte_carlo(&[range("AA"), range("KK")], &[], CardSet::EMPTY, 5_000, 1).unwrap();
        assert_eq!(a.equity, b.equity);
    }

    #[test]
    fn aces_vs_a_random_hand_is_about_85_2_percent() {
        // Sanity figure from the project spec (AA vs a random hand ≈ 85.2%); checked by Monte
        // Carlo here and exactly by the generated preflop table.
        let mc = monte_carlo(
            &[range("AA"), Range::full()],
            &[],
            CardSet::EMPTY,
            400_000,
            2026,
        )
        .unwrap();
        let (eq, se) = (mc.equity[0], mc.std_error[0]);
        assert!((eq - 0.852).abs() < 4.0 * se + 0.0005, "{eq} ± {se}");
    }

    #[test]
    fn errors_are_reported() {
        assert_eq!(
            hand_vs_hand(combo("AsKs"), combo("AsQs"), &[], CardSet::EMPTY).unwrap_err(),
            EquityError::DuplicateCards
        );
        assert_eq!(
            exact_range_vs_range(
                &range("AA"),
                &range("KK"),
                &cards("AsAhAd"),
                CardSet(combo("AcKs").cards().0)
            )
            .unwrap_err(),
            EquityError::EmptyRange(0)
        );
        assert_eq!(
            monte_carlo(&[range("AsAh")], &[], CardSet::EMPTY, 10, 0).unwrap_err(),
            EquityError::NotEnoughPlayers
        );
        assert_eq!(
            monte_carlo(&[range("AsAh"), range("AsKh")], &[], CardSet::EMPTY, 10, 0).unwrap_err(),
            EquityError::Conflict
        );
    }
}
