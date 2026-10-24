//! Weighted ranges over the 1326 combos, with a parser and a canonical printer.
//!
//! Syntax (comma-separated tokens, each optionally `:weight` with weight in [0, 1]):
//! - pairs: `QQ`, `22+` (22 up to AA), `99-66`
//! - suited / offsuit / both: `AKs`, `AKo`, `AK`
//! - kicker runs: `A2s+` (A2s up to AKs), `KTo+`, `A5s-A2s`
//! - connector runs: `T9s-54s` (both ranks step down together)
//! - single combos: `AhKh`
//!
//! Later tokens overwrite earlier ones, so `22+, 55:0.5` means "all pairs, 55 at half weight".

use crate::cards::{CardSet, Combo, NUM_COMBOS, RANK_CHARS, rank_from_char};
use crate::hands::{HandClass, NUM_CLASSES, Shape};
use std::fmt;

#[derive(Clone, PartialEq, Debug)]
pub struct Range {
    w: [f32; NUM_COMBOS],
}

#[derive(Clone, PartialEq, Eq, Debug)]
pub struct RangeError {
    pub token: String,
    pub reason: String,
}

impl fmt::Display for RangeError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "can't read \"{}\": {}", self.token, self.reason)
    }
}

impl std::error::Error for RangeError {}

impl Default for Range {
    fn default() -> Self {
        Range::empty()
    }
}

impl Range {
    pub fn empty() -> Range {
        Range {
            w: [0.0; NUM_COMBOS],
        }
    }

    pub fn full() -> Range {
        Range {
            w: [1.0; NUM_COMBOS],
        }
    }

    pub fn from_weights(w: [f32; NUM_COMBOS]) -> Range {
        Range { w }
    }

    pub fn weights(&self) -> &[f32; NUM_COMBOS] {
        &self.w
    }

    pub fn weight(&self, c: Combo) -> f32 {
        self.w[c.index()]
    }

    pub fn set(&mut self, c: Combo, weight: f32) {
        self.w[c.index()] = weight;
    }

    pub fn set_class(&mut self, class: HandClass, weight: f32) {
        for c in class.combos() {
            self.set(c, weight);
        }
    }

    /// Sum of weights, i.e. the number of combos the range represents.
    pub fn combo_count(&self) -> f64 {
        self.w.iter().map(|&x| x as f64).sum()
    }

    /// Copy with every combo that touches `dead` removed.
    pub fn without(&self, dead: CardSet) -> Range {
        let mut r = self.clone();
        for (i, w) in r.w.iter_mut().enumerate() {
            if Combo::from_index(i).cards().intersects(dead) {
                *w = 0.0;
            }
        }
        r
    }

    /// Non-zero combos with their weights, in index order.
    pub fn iter(&self) -> impl Iterator<Item = (Combo, f32)> + '_ {
        self.w
            .iter()
            .enumerate()
            .filter(|(_, w)| **w > 0.0)
            .map(|(i, &w)| (Combo::from_index(i), w))
    }

    pub fn parse(text: &str) -> Result<Range, RangeError> {
        let mut r = Range::empty();
        for raw in text.split(',') {
            let token = raw.trim();
            if token.is_empty() {
                continue;
            }
            let err = |reason: &str| RangeError {
                token: token.to_string(),
                reason: reason.to_string(),
            };
            let (body, weight) = match token.rsplit_once(':') {
                Some((b, w)) => {
                    let w: f32 = w
                        .trim()
                        .parse()
                        .map_err(|_| err("the weight after ':' is not a number"))?;
                    if !(0.0..=1.0).contains(&w) {
                        return Err(err("weights must be between 0 and 1"));
                    }
                    (b.trim(), w)
                }
                None => (token, 1.0),
            };
            if body.len() == 4
                && let Some(c) = Combo::parse(body)
            {
                r.set(c, weight);
                continue;
            }
            for class in expand(body).map_err(|reason| err(&reason))? {
                r.set_class(class, weight);
            }
        }
        Ok(r)
    }
}

/// A hand pattern like `AK`, `AKs`, `77`: high rank, low rank, shape (None = suited and offsuit).
#[derive(Clone, Copy)]
struct Pattern {
    hi: u8,
    lo: u8,
    shape: Option<Shape>,
}

fn pattern(s: &str) -> Result<Pattern, String> {
    let b = s.as_bytes();
    if !(2..=3).contains(&b.len()) {
        return Err("expected a hand like AKs, T9o, 77 or a combo like AhKh".into());
    }
    let bad_rank = || format!("'{s}' has a character that isn't a rank (use 2-9, T, J, Q, K, A)");
    let r1 = rank_from_char(b[0]).ok_or_else(bad_rank)?;
    let r2 = rank_from_char(b[1]).ok_or_else(bad_rank)?;
    let (hi, lo) = (r1.max(r2), r1.min(r2));
    let shape = match b.get(2).map(|c| c.to_ascii_lowercase()) {
        None if hi == lo => Some(Shape::Pair),
        None => None,
        Some(b's') if hi != lo => Some(Shape::Suited),
        Some(b'o') if hi != lo => Some(Shape::Offsuit),
        Some(b's' | b'o') => return Err("a pair can't be suited or offsuit".into()),
        Some(_) => return Err("the third character must be 's' (suited) or 'o' (offsuit)".into()),
    };
    Ok(Pattern { hi, lo, shape })
}

fn classes_of(hi: u8, lo: u8, shape: Option<Shape>) -> Vec<HandClass> {
    let shapes: &[Shape] = match shape {
        Some(Shape::Pair) => &[Shape::Pair],
        Some(Shape::Suited) => &[Shape::Suited],
        Some(Shape::Offsuit) => &[Shape::Offsuit],
        None => &[Shape::Suited, Shape::Offsuit],
    };
    shapes
        .iter()
        .filter_map(|&s| HandClass::new(hi, lo, s))
        .collect()
}

fn expand(body: &str) -> Result<Vec<HandClass>, String> {
    let mut out = Vec::new();
    if let Some((a, b)) = body.split_once('-') {
        let (p, q) = (pattern(a.trim())?, pattern(b.trim())?);
        if p.shape != q.shape {
            return Err("both ends of a dash range need the same type (pair, s, o)".into());
        }
        if p.shape == Some(Shape::Pair) {
            for r in p.hi.min(q.hi)..=p.hi.max(q.hi) {
                out.extend(classes_of(r, r, p.shape));
            }
        } else if p.hi == q.hi {
            for k in p.lo.min(q.lo)..=p.lo.max(q.lo) {
                out.extend(classes_of(p.hi, k, p.shape));
            }
        } else if p.hi - p.lo == q.hi - q.lo {
            let gap = p.hi - p.lo;
            for h in p.hi.min(q.hi)..=p.hi.max(q.hi) {
                out.extend(classes_of(h, h - gap, p.shape));
            }
        } else {
            return Err(
                "a dash range needs the same high card (A5s-A2s) or the same gap (T9s-54s)".into(),
            );
        }
    } else if let Some(base) = body.strip_suffix('+') {
        let p = pattern(base)?;
        if p.shape == Some(Shape::Pair) {
            for r in p.hi..=12 {
                out.extend(classes_of(r, r, p.shape));
            }
        } else {
            for k in p.lo..p.hi {
                out.extend(classes_of(p.hi, k, p.shape));
            }
        }
    } else {
        let p = pattern(body)?;
        out.extend(classes_of(p.hi, p.lo, p.shape));
    }
    Ok(out)
}

fn fmt_weight(w: f32) -> String {
    // Rust's float Display is the shortest string that parses back to the same f32,
    // which is what makes print → parse an exact round trip.
    if w == 1.0 {
        String::new()
    } else {
        format!(":{w}")
    }
}

fn rank_char(r: u8) -> char {
    RANK_CHARS[r as usize] as char
}

impl fmt::Display for Range {
    /// Canonical, compact form: pair runs, then per high card suited and offsuit kicker runs,
    /// then any classes whose combos have different weights, listed combo by combo.
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let mut class_w: [Option<f32>; NUM_CLASSES] = [None; NUM_CLASSES];
        let mut mixed: Vec<(Combo, f32)> = Vec::new();
        for class in HandClass::all() {
            let combos = class.combos();
            let w0 = self.weight(combos[0]);
            if combos.iter().all(|&c| self.weight(c) == w0) {
                class_w[class.index()] = Some(w0);
            } else {
                mixed.extend(
                    combos
                        .iter()
                        .map(|&c| (c, self.weight(c)))
                        .filter(|&(_, w)| w > 0.0),
                );
            }
        }
        let weight_of = |hi: u8, lo: u8, shape: Shape| {
            HandClass::new(hi, lo, shape)
                .and_then(|c| class_w[c.index()])
                .filter(|&w| w > 0.0)
        };

        let mut tokens: Vec<String> = Vec::new();
        // Runs over a descending sequence of items with equal weight.
        let mut runs = |items: Vec<(u8, Option<f32>)>, name: &dyn Fn(u8) -> String, top: u8| {
            let mut i = 0;
            while i < items.len() {
                let Some(w) = items[i].1 else {
                    i += 1;
                    continue;
                };
                let mut j = i;
                while j + 1 < items.len() && items[j + 1].1 == Some(w) {
                    j += 1;
                }
                let (first, last) = (items[i].0, items[j].0);
                let tok = if i == j {
                    name(first)
                } else if first == top {
                    format!("{}+", name(last))
                } else {
                    format!("{}-{}", name(first), name(last))
                };
                tokens.push(format!("{tok}{}", fmt_weight(w)));
                i = j + 1;
            }
        };

        let pairs: Vec<(u8, Option<f32>)> = (0..13u8)
            .rev()
            .map(|r| (r, weight_of(r, r, Shape::Pair)))
            .collect();
        runs(pairs, &|r| format!("{0}{0}", rank_char(r)), 12);
        for hi in (1..13u8).rev() {
            for (shape, suffix) in [(Shape::Suited, 's'), (Shape::Offsuit, 'o')] {
                let kickers: Vec<(u8, Option<f32>)> = (0..hi)
                    .rev()
                    .map(|k| (k, weight_of(hi, k, shape)))
                    .collect();
                runs(
                    kickers,
                    &|k| format!("{}{}{suffix}", rank_char(hi), rank_char(k)),
                    hi - 1,
                );
            }
        }
        for (c, w) in mixed {
            tokens.push(format!("{c}{}", fmt_weight(w)));
        }
        write!(f, "{}", tokens.join(", "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::rng::Rng;

    fn classes(s: &str) -> Vec<String> {
        let r = Range::parse(s).unwrap();
        HandClass::all()
            .filter(|c| c.combos().iter().all(|&x| r.weight(x) == 1.0))
            .map(|c| c.to_string())
            .collect()
    }

    #[test]
    fn parses_the_standard_forms() {
        assert_eq!(classes("QQ+"), ["AA", "KK", "QQ"]);
        assert_eq!(classes("99-77"), ["99", "88", "77"]);
        assert_eq!(classes("77-99"), ["99", "88", "77"]);
        assert_eq!(classes("AQs+"), ["AKs", "AQs"]);
        assert_eq!(classes("KTo+"), ["KQo", "KJo", "KTo"]);
        assert_eq!(classes("A4s-A2s"), ["A4s", "A3s", "A2s"]);
        assert_eq!(classes("T9s-87s"), ["T9s", "98s", "87s"]);
        assert_eq!(classes("AK"), ["AKs", "AKo"]);
        assert_eq!(classes("KAs"), ["AKs"]);
        assert_eq!(Range::parse("22+").unwrap().combo_count(), 13.0 * 6.0);
        assert_eq!(Range::parse("A2s+").unwrap().combo_count(), 12.0 * 4.0);
        assert_eq!(Range::parse("AhKh, AsKs:0.5").unwrap().combo_count(), 1.5);
    }

    #[test]
    fn later_tokens_overwrite_earlier_ones() {
        let r = Range::parse("22+, 55:0.5").unwrap();
        assert_eq!(r.combo_count(), 12.0 * 6.0 + 3.0);
    }

    #[test]
    fn rejects_bad_input_with_a_reason() {
        for bad in [
            "AAs", "AX", "AKx", "AK:2", "AK:-1", "AK:abc", "A5s-K2s", "AKs-AKo", "Q", "AhAh",
        ] {
            let e = Range::parse(bad).unwrap_err();
            assert!(!e.reason.is_empty(), "{bad}");
        }
    }

    #[test]
    fn prints_canonically() {
        let cases = [
            ("22+", "22+"),
            ("AA, KK, QQ", "QQ+"),
            ("TT-77", "TT-77"),
            ("AKs, AQs, AJs", "AJs+"),
            ("A5s, A4s, A3s, A2s", "A5s-A2s"),
            ("AK", "AKs, AKo"),
            ("AKs:0.5, KK", "KK, AKs:0.5"),
            ("AhKh", "AhKh"),
            ("", ""),
        ];
        for (input, want) in cases {
            assert_eq!(Range::parse(input).unwrap().to_string(), want, "{input}");
        }
    }

    #[test]
    fn print_then_parse_is_exact_for_random_ranges() {
        let mut rng = Rng::seed(0xA11CE);
        let weights = [0.0f32, 0.0, 1.0, 1.0, 0.5, 0.25, 0.123_456_7];
        for _ in 0..500 {
            let mut r = Range::empty();
            for class in HandClass::all() {
                let w = weights[rng.below(weights.len() as u64) as usize];
                r.set_class(class, w);
            }
            // Some classes get per-combo weights.
            for _ in 0..rng.below(4) {
                let c = Combo::from_index(rng.below(NUM_COMBOS as u64) as usize);
                r.set(c, rng.f64() as f32);
            }
            let text = r.to_string();
            let back = Range::parse(&text).unwrap();
            assert_eq!(back, r, "{text}");
            // And printing is stable.
            assert_eq!(back.to_string(), text);
        }
    }

    #[test]
    fn without_removes_blocked_combos() {
        let board = CardSet::from_cards(&crate::cards::parse_cards("AhKd2c").unwrap());
        let r = Range::parse("AA, KK").unwrap().without(board);
        // AA loses the 3 combos with Ah, KK loses the 3 with Kd.
        assert_eq!(r.combo_count(), 6.0);
    }
}
