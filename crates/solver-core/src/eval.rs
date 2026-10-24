//! Hand evaluator for 5, 6 and 7 cards.
//!
//! Result is a [`Strength`]: `category << 12 | ordinal`, where `ordinal` ranks the hand among
//! all distinct 5-card hands of that category. Comparing two `Strength`s compares the hands
//! exactly like poker rules do; there are 7,462 distinct values.
//!
//! How it works (docs/ARCHITECTURE.md §1.2):
//! - If one suit has ≥ 5 cards, the best hand is a flush or straight flush (with at most 7
//!   cards, five of one suit leave too few cards for quads or a full house), so we look up
//!   that suit's 13-bit rank mask in an 8,192-entry table.
//! - Otherwise suits don't matter, and we look up the multiset of ranks. The multiset is
//!   encoded as Σ 5^rank (a base-5 number with one digit per rank: counts are ≤ 4), which is
//!   unique and can be built by adding one term per card, then found in a small hash table.
//!
//! Tables are built once at startup (~200 KB, a few ms) by straightforward rank logic; the
//! independent [`reference`] evaluator (best of all 5-card subsets) is used in tests.

use crate::cards::Card;
use std::collections::BTreeMap;
use std::sync::OnceLock;

/// Hand categories in increasing order of strength.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
#[repr(u8)]
pub enum Category {
    HighCard = 0,
    Pair = 1,
    TwoPair = 2,
    Trips = 3,
    Straight = 4,
    Flush = 5,
    FullHouse = 6,
    Quads = 7,
    StraightFlush = 8,
}

impl Category {
    pub const ALL: [Category; 9] = [
        Category::HighCard,
        Category::Pair,
        Category::TwoPair,
        Category::Trips,
        Category::Straight,
        Category::Flush,
        Category::FullHouse,
        Category::Quads,
        Category::StraightFlush,
    ];

    pub fn name(self) -> &'static str {
        match self {
            Category::HighCard => "high card",
            Category::Pair => "pair",
            Category::TwoPair => "two pair",
            Category::Trips => "three of a kind",
            Category::Straight => "straight",
            Category::Flush => "flush",
            Category::FullHouse => "full house",
            Category::Quads => "four of a kind",
            Category::StraightFlush => "straight flush",
        }
    }
}

/// Hand strength; higher is better. See the module docs.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug, Default)]
pub struct Strength(pub u16);

impl Strength {
    pub fn category(self) -> Category {
        Category::ALL[(self.0 >> 12) as usize]
    }
}

/// "Raw" comparable value used while building tables and in the reference evaluator:
/// `category << 20 | r0 << 16 | r1 << 12 | r2 << 8 | r3 << 4 | r4`, ranks in order of
/// significance (e.g. full house: trips rank, then pair rank). Straights store only their
/// top card (a wheel's top card is the five).
pub type Raw = u32;

fn pack(cat: Category, ranks: &[u8]) -> Raw {
    let mut v = (cat as u32) << 20;
    for (i, &r) in ranks.iter().enumerate() {
        v |= (r as u32) << (16 - 4 * i);
    }
    v
}

fn raw_category(raw: Raw) -> Category {
    Category::ALL[(raw >> 20) as usize]
}

/// Highest straight contained in a 13-bit rank mask, by its top rank.
fn straight_high(mask: u16) -> Option<u8> {
    for high in (4..=12u8).rev() {
        let run = 0b11111u16 << (high - 4);
        if mask & run == run {
            return Some(high);
        }
    }
    // Wheel: A-2-3-4-5, the ace plays low and the five is the top card.
    const WHEEL: u16 = (1 << 12) | 0b1111;
    if mask & WHEEL == WHEEL { Some(3) } else { None }
}

/// Best flush or straight flush from a suit's rank mask (≥ 5 bits).
fn flush_raw(mask: u16) -> Raw {
    if let Some(h) = straight_high(mask) {
        return pack(Category::StraightFlush, &[h]);
    }
    let top: Vec<u8> = (0..13u8)
        .rev()
        .filter(|&r| mask & (1 << r) != 0)
        .take(5)
        .collect();
    pack(Category::Flush, &top)
}

/// Best non-flush hand from rank counts (5–7 cards in total).
fn rank_only_raw(counts: &[u8; 13]) -> Raw {
    let with_at_least = |min: u8| (0..13u8).rev().filter(move |&r| counts[r as usize] >= min);
    let kickers = |exclude: &[u8], n: usize| -> Vec<u8> {
        with_at_least(1)
            .filter(|r| !exclude.contains(r))
            .take(n)
            .collect()
    };
    let present = (0..13)
        .filter(|&r| counts[r] > 0)
        .fold(0u16, |m, r| m | (1 << r));

    if let Some(q) = with_at_least(4).next() {
        return pack(Category::Quads, &[&[q][..], &kickers(&[q], 1)].concat());
    }
    if let Some(t) = with_at_least(3).next()
        && let Some(p) = with_at_least(2).find(|&r| r != t)
    {
        return pack(Category::FullHouse, &[t, p]);
    }
    if let Some(h) = straight_high(present) {
        return pack(Category::Straight, &[h]);
    }
    if let Some(t) = with_at_least(3).next() {
        return pack(Category::Trips, &[&[t][..], &kickers(&[t], 2)].concat());
    }
    let pairs: Vec<u8> = with_at_least(2).take(2).collect();
    match pairs.len() {
        2 => pack(
            Category::TwoPair,
            &[&pairs[..], &kickers(&pairs, 1)].concat(),
        ),
        1 => pack(Category::Pair, &[&pairs[..], &kickers(&pairs, 3)].concat()),
        _ => pack(Category::HighCard, &kickers(&[], 5)),
    }
}

/// 5^rank for rank 0..13. Σ over cards gives the rank-multiset key.
const POW5: [u32; 13] = {
    let mut p = [1u32; 13];
    let mut i = 1;
    while i < 13 {
        p[i] = p[i - 1] * 5;
        i += 1;
    }
    p
};

/// Incremental hand description: add cards one at a time, evaluate at any size 5..=7.
/// Lets the solver evaluate "board + hole cards" without recomputing the board part.
#[derive(Clone, Copy, Default, Debug)]
pub struct HandKey {
    rank_key: u32,
    suit_masks: [u16; 4],
}

impl HandKey {
    pub fn from_cards(cards: &[Card]) -> HandKey {
        let mut k = HandKey::default();
        for &c in cards {
            k = k.with(c);
        }
        k
    }

    #[inline]
    pub fn with(self, c: Card) -> HandKey {
        let mut k = self;
        k.rank_key += POW5[c.rank() as usize];
        k.suit_masks[c.suit() as usize] |= 1 << c.rank();
        k
    }

    /// Combine two keys built from *disjoint* card sets (e.g. a board and hole cards).
    #[inline]
    pub fn merge(self, other: HandKey) -> HandKey {
        let (a, b) = (self.suit_masks, other.suit_masks);
        HandKey {
            rank_key: self.rank_key + other.rank_key,
            suit_masks: [a[0] | b[0], a[1] | b[1], a[2] | b[2], a[3] | b[3]],
        }
    }
}

const TABLE_BITS: u32 = 17;
const TABLE_SIZE: usize = 1 << TABLE_BITS;

pub struct Evaluator {
    flush: Vec<u16>,
    keys: Vec<u32>,
    values: Vec<u16>,
    raw_to_strength: BTreeMap<Raw, Strength>,
}

#[inline]
fn slot(key: u32) -> usize {
    // Fibonacci hashing; linear probing below resolves the rare collisions.
    (key.wrapping_mul(0x9E37_79B1) >> (32 - TABLE_BITS)) as usize
}

impl Evaluator {
    /// Shared instance, built on first use. Immutable afterwards.
    pub fn get() -> &'static Evaluator {
        static EVAL: OnceLock<Evaluator> = OnceLock::new();
        EVAL.get_or_init(Evaluator::build)
    }

    fn build() -> Evaluator {
        // 1. Every distinct 5-card hand value, to number them within each category.
        let mut raws: Vec<Raw> = Vec::new();
        for_each_rank_multiset(5, |counts| raws.push(rank_only_raw(counts)));
        for mask in 0u16..(1 << 13) {
            if mask.count_ones() == 5 {
                raws.push(flush_raw(mask));
            }
        }
        raws.sort_unstable();
        raws.dedup();
        let mut raw_to_strength = BTreeMap::new();
        let mut ordinal = 0u16;
        let mut prev_cat = None;
        for &raw in &raws {
            let cat = raw_category(raw);
            if prev_cat != Some(cat) {
                ordinal = 0;
                prev_cat = Some(cat);
            }
            raw_to_strength.insert(raw, Strength(((cat as u16) << 12) | ordinal));
            ordinal += 1;
        }

        // 2. Flush table: best flush/straight flush for any rank mask with ≥ 5 bits.
        let mut flush = vec![0u16; 1 << 13];
        for mask in 0u16..(1 << 13) {
            if mask.count_ones() >= 5 {
                flush[mask as usize] = raw_to_strength[&flush_raw(mask)].0;
            }
        }

        // 3. Rank-multiset table for 5, 6 and 7 cards.
        let mut keys = vec![0u32; TABLE_SIZE]; // 0 = empty (real keys are ≥ 5)
        let mut values = vec![0u16; TABLE_SIZE];
        for n in 5..=7 {
            for_each_rank_multiset(n, |counts| {
                let key: u32 = (0..13).map(|r| counts[r] as u32 * POW5[r]).sum();
                let mut i = slot(key);
                while keys[i] != 0 {
                    i = (i + 1) & (TABLE_SIZE - 1);
                }
                keys[i] = key;
                values[i] = raw_to_strength[&rank_only_raw(counts)].0;
            });
        }

        Evaluator {
            flush,
            keys,
            values,
            raw_to_strength,
        }
    }

    /// Strength of a 5-, 6- or 7-card hand described by `key`.
    #[inline]
    pub fn eval_key(&self, key: HandKey) -> Strength {
        for m in key.suit_masks {
            if m.count_ones() >= 5 {
                return Strength(self.flush[m as usize]);
            }
        }
        let mut i = slot(key.rank_key);
        loop {
            let k = self.keys[i];
            if k == key.rank_key {
                return Strength(self.values[i]);
            }
            debug_assert!(k != 0, "rank multiset not in table (fewer than 5 cards?)");
            i = (i + 1) & (TABLE_SIZE - 1);
        }
    }

    /// Strength of 5 to 7 distinct cards.
    pub fn eval(&self, cards: &[Card]) -> Strength {
        assert!((5..=7).contains(&cards.len()), "evaluate 5 to 7 cards");
        self.eval_key(HandKey::from_cards(cards))
    }

    /// Map a raw value (from [`reference`]) to a `Strength`. Used by tests and tools.
    pub fn strength_of_raw(&self, raw: Raw) -> Option<Strength> {
        self.raw_to_strength.get(&raw).copied()
    }

    /// Number of distinct hand values (7,462 for standard poker).
    pub fn distinct_values(&self) -> usize {
        self.raw_to_strength.len()
    }
}

/// Calls `f` with every rank-count vector of total size `n` where each count is ≤ 4.
fn for_each_rank_multiset(n: u8, mut f: impl FnMut(&[u8; 13])) {
    fn rec(rank: usize, left: u8, counts: &mut [u8; 13], f: &mut dyn FnMut(&[u8; 13])) {
        if rank == 13 {
            if left == 0 {
                f(counts);
            }
            return;
        }
        for c in 0..=left.min(4) {
            counts[rank] = c;
            rec(rank + 1, left - c, counts, f);
        }
        counts[rank] = 0;
    }
    rec(0, n, &mut [0; 13], &mut f);
}

/// Slow, obviously-correct evaluator: score every 5-card subset directly from the rules.
/// Independent of the table logic above; used to cross-check it.
pub mod reference {
    use super::{Category, Raw, pack};
    use crate::cards::Card;

    pub fn eval5(cards: [Card; 5]) -> Raw {
        let flush = cards.iter().all(|c| c.suit() == cards[0].suit());
        let mut sorted: Vec<u8> = cards.iter().map(|c| c.rank()).collect();
        sorted.sort_unstable_by(|a, b| b.cmp(a));
        let mut counts = [0u8; 13];
        for &r in &sorted {
            counts[r as usize] += 1;
        }
        // Groups of equal rank, biggest group first, then higher rank first.
        let mut groups: Vec<(u8, u8)> = (0..13u8)
            .filter(|&r| counts[r as usize] > 0)
            .map(|r| (counts[r as usize], r))
            .collect();
        groups.sort_unstable_by(|a, b| b.cmp(a));
        let order: Vec<u8> = groups.iter().map(|g| g.1).collect();

        let straight = if groups.len() == 5 {
            if sorted[0] - sorted[4] == 4 {
                Some(sorted[0])
            } else if sorted == [12, 3, 2, 1, 0] {
                Some(3)
            } else {
                None
            }
        } else {
            None
        };

        let top = groups[0].0;
        let second = groups.get(1).map_or(0, |g| g.0);
        match (flush, straight) {
            (true, Some(h)) => pack(Category::StraightFlush, &[h]),
            _ if top == 4 => pack(Category::Quads, &order),
            _ if top == 3 && second == 2 => pack(Category::FullHouse, &order),
            (true, None) => pack(Category::Flush, &sorted),
            (false, Some(h)) => pack(Category::Straight, &[h]),
            _ if top == 3 => pack(Category::Trips, &order),
            _ if top == 2 && second == 2 => pack(Category::TwoPair, &order),
            _ if top == 2 => pack(Category::Pair, &order),
            _ => pack(Category::HighCard, &sorted),
        }
    }

    /// Best 5-card value among all subsets of 5–7 cards.
    pub fn eval(cards: &[Card]) -> Raw {
        let n = cards.len();
        assert!((5..=7).contains(&n));
        let mut best = 0;
        for skip_mask in 0u32..(1 << n) {
            if skip_mask.count_ones() as usize != n - 5 {
                continue;
            }
            let pick: Vec<Card> = (0..n)
                .filter(|i| skip_mask & (1 << i) == 0)
                .map(|i| cards[i])
                .collect();
            best = best.max(eval5([pick[0], pick[1], pick[2], pick[3], pick[4]]));
        }
        best
    }
}

/// Counts all 7-card hands by category using the incremental [`HandKey`] path. Exposed so the
/// validation runner can report it, and used by the enumeration test.
pub fn count_seven_card_categories() -> [u64; 9] {
    let e = Evaluator::get();
    let card = Card::from_index;
    let mut counts = [0u64; 9];
    for a in 0..52u8 {
        let ka = HandKey::default().with(card(a));
        for b in (a + 1)..52 {
            let kb = ka.with(card(b));
            for c in (b + 1)..52 {
                let kc = kb.with(card(c));
                for d in (c + 1)..52 {
                    let kd = kc.with(card(d));
                    for f in (d + 1)..52 {
                        let kf = kd.with(card(f));
                        for g in (f + 1)..52 {
                            let kg = kf.with(card(g));
                            for h in (g + 1)..52 {
                                let st = e.eval_key(kg.with(card(h)));
                                counts[(st.0 >> 12) as usize] += 1;
                            }
                        }
                    }
                }
            }
        }
    }
    counts
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::parse_cards;
    use crate::rng::Rng;

    fn s(cards: &str) -> Strength {
        Evaluator::get().eval(&parse_cards(cards).unwrap())
    }

    #[test]
    fn there_are_7462_distinct_hand_values() {
        // Standard count of distinct 5-card poker hand values; per category:
        // 1277 + 2860 + 858 + 858 + 10 + 1277 + 156 + 156 + 10.
        let e = Evaluator::get();
        assert_eq!(e.distinct_values(), 7462);
        let mut per_cat = [0usize; 9];
        for st in e.raw_to_strength.values() {
            per_cat[st.category() as usize] += 1;
        }
        assert_eq!(per_cat, [1277, 2860, 858, 858, 10, 1277, 156, 156, 10]);
    }

    #[test]
    fn categories_of_known_hands() {
        use Category::*;
        assert_eq!(s("AsKsQsJsTs").category(), StraightFlush);
        assert_eq!(s("5h4h3h2hAh").category(), StraightFlush);
        assert_eq!(s("9c9d9h9sKd").category(), Quads);
        assert_eq!(s("9c9d9hKsKd").category(), FullHouse);
        assert_eq!(s("2h7h9hJhKh").category(), Flush);
        assert_eq!(s("Ac2d3h4s5c").category(), Straight);
        assert_eq!(s("7c7d7h2sKd").category(), Trips);
        assert_eq!(s("7c7d2h2sKd").category(), TwoPair);
        assert_eq!(s("7c7d3h2sKd").category(), Pair);
        assert_eq!(s("Ac9d3h2sKd").category(), HighCard);
    }

    #[test]
    fn ordering_edge_cases() {
        // Wheel is the lowest straight; ace-high flush beats king-high flush.
        assert!(s("Ac2d3h4s5c") < s("2c3d4h5s6c"));
        assert!(s("Ah9h7h4h2h") > s("KhQhJh9h7h"));
        // Kickers count; the sixth and seventh cards don't.
        assert!(s("AcAd9h8s2c") > s("AhAs9c7s6d"));
        assert_eq!(s("AcAdKhQsJc3d2h"), s("AhAsKcQdJs4c3s"));
        // Board plays: both players have the same broadway straight.
        assert_eq!(s("AsKdQhJcTd2c3c"), s("AsKdQhJcTd4h5h"));
        // Two pair: the best two of three pairs, best remaining kicker.
        assert_eq!(s("KcKdQhQs2c2dAh"), s("KhKsQcQdAs3c4d"));
        // Full house: higher trips wins regardless of the pair.
        assert!(s("3c3d3hAsAd") < s("4c4d4h2s2d"));
        // Two trips make a full house with the higher one as trips.
        assert_eq!(s("9c9d9h5c5d5hKs").category(), Category::FullHouse);
        assert_eq!(s("9c9d9h5c5d5hKs"), s("9c9d9h5c5dQsKs"));
    }

    #[test]
    fn matches_reference_on_random_hands() {
        let e = Evaluator::get();
        let mut rng = Rng::seed(0x5EED_0001);
        for _ in 0..200_000 {
            let n = 5 + rng.below(3) as usize;
            let cards = rng.sample_cards(n, 0);
            let fast = e.eval(&cards);
            let slow = e.strength_of_raw(reference::eval(&cards)).unwrap();
            assert_eq!(fast, slow, "{cards:?}");
        }
    }

    /// Full enumeration of all C(52,7) = 133,784,560 seven-card hands. Expected counts are
    /// the standard combinatorial totals per category (straight flush includes royal).
    /// Slow in debug builds; run with `cargo test --release -- --include-ignored`.
    #[test]
    #[ignore = "heavy: run in release with --include-ignored"]
    fn seven_card_category_counts() {
        let start = std::time::Instant::now();
        let counts = count_seven_card_categories();
        // Visible with --nocapture, so the run can be inspected, not just its pass/fail.
        for (cat, n) in Category::ALL.iter().zip(&counts) {
            println!("{:>16}: {n:>11}", cat.name());
        }
        println!(
            "{:>16}: {:>11} in {:.2} s",
            "total",
            counts.iter().sum::<u64>(),
            start.elapsed().as_secs_f64()
        );
        assert_eq!(
            counts,
            [
                23_294_460, 58_627_800, 31_433_400, 6_461_620, 6_180_020, 4_047_644, 3_473_184,
                224_848, 41_584
            ]
        );
        assert_eq!(counts.iter().sum::<u64>(), 133_784_560);
    }
}
