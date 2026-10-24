//! Cards, card sets and two-card combos.
//!
//! A card is `rank * 4 + suit` with rank 0 = deuce … 12 = ace and suit 0..3 = c, d, h, s.
//! A combo (two-card hand) has a fixed index in 0..1326 so that ranges and strategies can be
//! plain arrays.

use std::fmt;

pub const RANK_CHARS: &[u8; 13] = b"23456789TJQKA";
pub const SUIT_CHARS: &[u8; 4] = b"cdhs";
pub const NUM_COMBOS: usize = 1326;

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
pub struct Card(u8);

impl Card {
    /// Panics if `rank > 12` or `suit > 3`; use [`Card::try_new`] for untrusted input.
    pub const fn new(rank: u8, suit: u8) -> Card {
        assert!(rank < 13 && suit < 4);
        Card(rank * 4 + suit)
    }

    pub const fn try_new(rank: u8, suit: u8) -> Option<Card> {
        if rank < 13 && suit < 4 {
            Some(Card(rank * 4 + suit))
        } else {
            None
        }
    }

    pub const fn from_index(i: u8) -> Card {
        assert!(i < 52);
        Card(i)
    }

    pub const fn index(self) -> u8 {
        self.0
    }

    pub const fn rank(self) -> u8 {
        self.0 >> 2
    }

    pub const fn suit(self) -> u8 {
        self.0 & 3
    }

    pub const fn bit(self) -> u64 {
        1u64 << self.0
    }

    /// Parse two characters like `"Ah"` or `"td"` (rank case-insensitive, suit lower/upper).
    pub fn parse(s: &str) -> Option<Card> {
        let b = s.as_bytes();
        if b.len() != 2 {
            return None;
        }
        let rank = rank_from_char(b[0])?;
        let suit = SUIT_CHARS
            .iter()
            .position(|&c| c == b[1].to_ascii_lowercase())? as u8;
        Card::try_new(rank, suit)
    }
}

pub fn rank_from_char(c: u8) -> Option<u8> {
    RANK_CHARS
        .iter()
        .position(|&r| r == c.to_ascii_uppercase())
        .map(|r| r as u8)
}

impl fmt::Display for Card {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let r = RANK_CHARS[self.rank() as usize] as char;
        let s = SUIT_CHARS[self.suit() as usize] as char;
        write!(f, "{r}{s}")
    }
}

/// Parse a run of cards with optional whitespace, e.g. `"AsKd7h"` or `"As Kd 7h"`.
/// Rejects duplicates.
pub fn parse_cards(s: &str) -> Option<Vec<Card>> {
    let compact: Vec<u8> = s.bytes().filter(|b| !b.is_ascii_whitespace()).collect();
    if !compact.len().is_multiple_of(2) {
        return None;
    }
    let mut set = CardSet::EMPTY;
    let mut out = Vec::with_capacity(compact.len() / 2);
    for pair in compact.chunks(2) {
        let card = Card::parse(std::str::from_utf8(pair).ok()?)?;
        if set.contains(card) {
            return None;
        }
        set.insert(card);
        out.push(card);
    }
    Some(out)
}

/// A set of cards as a 52-bit mask.
#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug, Default)]
pub struct CardSet(pub u64);

impl CardSet {
    pub const EMPTY: CardSet = CardSet(0);

    pub fn from_cards(cards: &[Card]) -> CardSet {
        CardSet(cards.iter().fold(0, |m, c| m | c.bit()))
    }

    pub const fn contains(self, c: Card) -> bool {
        self.0 & c.bit() != 0
    }

    pub fn insert(&mut self, c: Card) {
        self.0 |= c.bit();
    }

    pub const fn len(self) -> u32 {
        self.0.count_ones()
    }

    pub const fn is_empty(self) -> bool {
        self.0 == 0
    }

    pub const fn intersects(self, other: CardSet) -> bool {
        self.0 & other.0 != 0
    }

    pub fn iter(self) -> impl Iterator<Item = Card> {
        let mut m = self.0;
        std::iter::from_fn(move || {
            if m == 0 {
                return None;
            }
            let i = m.trailing_zeros() as u8;
            m &= m - 1;
            Some(Card(i))
        })
    }
}

/// A two-card hand, always stored with `hi > lo` by card index.
#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash, Debug)]
pub struct Combo {
    pub hi: Card,
    pub lo: Card,
}

impl Combo {
    pub fn new(a: Card, b: Card) -> Combo {
        assert_ne!(a, b, "a combo needs two different cards");
        if a > b {
            Combo { hi: a, lo: b }
        } else {
            Combo { hi: b, lo: a }
        }
    }

    /// Triangular index: combos are ordered by (hi, lo), so index = hi·(hi−1)/2 + lo.
    pub const fn index(self) -> usize {
        let h = self.hi.0 as usize;
        h * (h - 1) / 2 + self.lo.0 as usize
    }

    pub fn from_index(i: usize) -> Combo {
        COMBOS[i]
    }

    pub fn cards(self) -> CardSet {
        CardSet(self.hi.bit() | self.lo.bit())
    }

    pub fn parse(s: &str) -> Option<Combo> {
        match parse_cards(s)?.as_slice() {
            [a, b] => Some(Combo::new(*a, *b)),
            _ => None,
        }
    }
}

impl fmt::Display for Combo {
    /// Higher rank first (`AhKd`), suits ordered by index on pairs (`AsAh`).
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}{}", self.hi, self.lo)
    }
}

/// All 1326 combos in index order.
pub static COMBOS: [Combo; NUM_COMBOS] = build_combos();

const fn build_combos() -> [Combo; NUM_COMBOS] {
    let mut out = [Combo {
        hi: Card(1),
        lo: Card(0),
    }; NUM_COMBOS];
    let mut hi = 1u8;
    let mut i = 0;
    while hi < 52 {
        let mut lo = 0u8;
        while lo < hi {
            out[i] = Combo {
                hi: Card(hi),
                lo: Card(lo),
            };
            i += 1;
            lo += 1;
        }
        hi += 1;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn card_round_trip() {
        for i in 0..52 {
            let c = Card::from_index(i);
            assert_eq!(Card::parse(&c.to_string()), Some(c));
        }
        assert_eq!(Card::parse("Ah"), Some(Card::new(12, 2)));
        assert_eq!(Card::parse("2c"), Some(Card::new(0, 0)));
        assert_eq!(Card::parse("tD"), Some(Card::new(8, 1)));
        assert_eq!(Card::parse("1h"), None);
        assert_eq!(Card::parse("Ax"), None);
        assert_eq!(Card::parse("A"), None);
    }

    #[test]
    fn combo_indices_are_a_bijection() {
        let mut seen = [false; NUM_COMBOS];
        for a in 0..52u8 {
            for b in 0..a {
                let c = Combo::new(Card::from_index(a), Card::from_index(b));
                assert!(!seen[c.index()]);
                seen[c.index()] = true;
                assert_eq!(Combo::from_index(c.index()), c);
            }
        }
        assert!(seen.iter().all(|&s| s));
        // C(52,2) combos in total.
        assert_eq!(COMBOS.len(), 52 * 51 / 2);
    }

    #[test]
    fn parse_cards_rejects_duplicates() {
        assert_eq!(parse_cards("AsKs 7h").map(|v| v.len()), Some(3));
        assert_eq!(parse_cards("AsAs"), None);
        assert_eq!(parse_cards("AsK"), None);
        assert_eq!(
            Combo::parse("KdAh").map(|c| c.to_string()),
            Some("AhKd".into())
        );
    }

    #[test]
    fn card_set_iterates_in_order() {
        let s = CardSet::from_cards(&parse_cards("2c Ah 7d").unwrap());
        let v: Vec<String> = s.iter().map(|c| c.to_string()).collect();
        assert_eq!(v, ["2c", "7d", "Ah"]);
        assert_eq!(s.len(), 3);
    }
}
