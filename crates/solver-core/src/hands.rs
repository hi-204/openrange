//! The 169 starting-hand classes (13 pairs, 78 suited, 78 offsuit) and the 13×13 grid.
//!
//! Grid convention (the standard chart layout): rows and columns run A, K, Q, … 2. The
//! diagonal holds pairs, cells above it (column further right) are suited, cells below are
//! offsuit. Class index = row · 13 + column.

use crate::cards::{Card, Combo, RANK_CHARS, rank_from_char};
use std::fmt;

pub const NUM_CLASSES: usize = 169;

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug, PartialOrd, Ord)]
pub enum Shape {
    Pair,
    Suited,
    Offsuit,
}

#[derive(Clone, Copy, PartialEq, Eq, Hash, Debug, PartialOrd, Ord)]
pub struct HandClass(u8);

/// Grid position of a rank (ace = 0, deuce = 12).
const fn grid_pos(rank: u8) -> u8 {
    12 - rank
}

impl HandClass {
    pub fn from_index(i: usize) -> HandClass {
        assert!(i < NUM_CLASSES);
        HandClass(i as u8)
    }

    pub fn index(self) -> usize {
        self.0 as usize
    }

    pub fn row(self) -> u8 {
        self.0 / 13
    }

    pub fn col(self) -> u8 {
        self.0 % 13
    }

    pub fn from_grid(row: u8, col: u8) -> HandClass {
        assert!(row < 13 && col < 13);
        HandClass(row * 13 + col)
    }

    /// Build from two ranks (any order) and a shape. Pairs need equal ranks.
    pub fn new(r1: u8, r2: u8, shape: Shape) -> Option<HandClass> {
        let (hi, lo) = if r1 >= r2 { (r1, r2) } else { (r2, r1) };
        if hi > 12 || (shape == Shape::Pair) != (hi == lo) {
            return None;
        }
        let (h, l) = (grid_pos(hi), grid_pos(lo));
        Some(match shape {
            Shape::Pair | Shape::Suited => HandClass::from_grid(h, l),
            Shape::Offsuit => HandClass::from_grid(l, h),
        })
    }

    pub fn shape(self) -> Shape {
        use std::cmp::Ordering::*;
        match self.row().cmp(&self.col()) {
            Equal => Shape::Pair,
            Less => Shape::Suited,
            Greater => Shape::Offsuit,
        }
    }

    /// (high rank, low rank) with ace = 12.
    pub fn ranks(self) -> (u8, u8) {
        let (a, b) = (12 - self.row(), 12 - self.col());
        (a.max(b), a.min(b))
    }

    pub fn of(combo: Combo) -> HandClass {
        let (a, b) = (combo.hi, combo.lo);
        let shape = if a.rank() == b.rank() {
            Shape::Pair
        } else if a.suit() == b.suit() {
            Shape::Suited
        } else {
            Shape::Offsuit
        };
        HandClass::new(a.rank(), b.rank(), shape).expect("valid combo")
    }

    /// All combos of this class: 6 for pairs, 4 suited, 12 offsuit.
    pub fn combos(self) -> Vec<Combo> {
        let (hi, lo) = self.ranks();
        let mut out = Vec::with_capacity(12);
        for s1 in 0..4 {
            for s2 in 0..4 {
                let keep = match self.shape() {
                    Shape::Pair => s1 < s2,
                    Shape::Suited => s1 == s2,
                    Shape::Offsuit => s1 != s2,
                };
                if keep {
                    out.push(Combo::new(Card::new(hi, s1), Card::new(lo, s2)));
                }
            }
        }
        out
    }

    pub fn num_combos(self) -> usize {
        match self.shape() {
            Shape::Pair => 6,
            Shape::Suited => 4,
            Shape::Offsuit => 12,
        }
    }

    /// Parse `"AKs"`, `"T9o"`, `"77"`.
    pub fn parse(s: &str) -> Option<HandClass> {
        let b = s.as_bytes();
        let r1 = rank_from_char(*b.first()?)?;
        let r2 = rank_from_char(*b.get(1)?)?;
        let shape = match (b.get(2).map(|c| c.to_ascii_lowercase()), b.len()) {
            (None, 2) if r1 == r2 => Shape::Pair,
            (Some(b's'), 3) => Shape::Suited,
            (Some(b'o'), 3) => Shape::Offsuit,
            _ => return None,
        };
        HandClass::new(r1, r2, shape)
    }

    pub fn all() -> impl Iterator<Item = HandClass> {
        (0..NUM_CLASSES).map(HandClass::from_index)
    }
}

impl fmt::Display for HandClass {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let (hi, lo) = self.ranks();
        let (h, l) = (
            RANK_CHARS[hi as usize] as char,
            RANK_CHARS[lo as usize] as char,
        );
        match self.shape() {
            Shape::Pair => write!(f, "{h}{l}"),
            Shape::Suited => write!(f, "{h}{l}s"),
            Shape::Offsuit => write!(f, "{h}{l}o"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::{COMBOS, NUM_COMBOS};

    #[test]
    fn classes_partition_all_combos() {
        let mut seen = [false; NUM_COMBOS];
        let mut total = 0;
        for class in HandClass::all() {
            let combos = class.combos();
            assert_eq!(combos.len(), class.num_combos());
            for c in combos {
                assert!(!seen[c.index()]);
                seen[c.index()] = true;
                assert_eq!(HandClass::of(c), class);
                total += 1;
            }
        }
        assert_eq!(total, NUM_COMBOS);
        assert!(COMBOS.iter().all(|c| seen[c.index()]));
    }

    #[test]
    fn counts_by_shape() {
        let count = |s| HandClass::all().filter(|c| c.shape() == s).count();
        assert_eq!(
            (
                count(Shape::Pair),
                count(Shape::Suited),
                count(Shape::Offsuit)
            ),
            (13, 78, 78)
        );
    }

    #[test]
    fn grid_layout_and_names() {
        assert_eq!(HandClass::from_grid(0, 0).to_string(), "AA");
        assert_eq!(HandClass::from_grid(0, 1).to_string(), "AKs");
        assert_eq!(HandClass::from_grid(1, 0).to_string(), "AKo");
        assert_eq!(HandClass::from_grid(12, 12).to_string(), "22");
        assert_eq!(HandClass::from_grid(11, 12).to_string(), "32s");
        for class in HandClass::all() {
            assert_eq!(HandClass::parse(&class.to_string()), Some(class));
        }
        assert_eq!(
            HandClass::parse("KAs").map(|c| c.to_string()),
            Some("AKs".into())
        );
        assert_eq!(HandClass::parse("AA"), HandClass::parse("aa"));
        assert_eq!(HandClass::parse("AAs"), None);
        assert_eq!(HandClass::parse("AK"), None);
    }
}
