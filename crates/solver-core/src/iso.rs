//! Suit isomorphism: relabelling suits never changes the value of a poker situation, so
//! situations that differ only by a suit permutation can share one computation.

use crate::cards::{Card, CardSet, Combo};

/// `perm[s]` is the new suit for suit `s`.
pub type SuitPerm = [u8; 4];

/// All 24 permutations of the four suits, identity first.
pub const SUIT_PERMS: [SuitPerm; 24] = build_perms();

const fn build_perms() -> [SuitPerm; 24] {
    let mut out = [[0u8; 4]; 24];
    let mut n = 0;
    let mut a = 0;
    while a < 4 {
        let mut b = 0;
        while b < 4 {
            let mut c = 0;
            while c < 4 {
                let d = 6 - a - b - c;
                if a != b && a != c && b != c && d < 4 && d != a && d != b && d != c {
                    out[n] = [a as u8, b as u8, c as u8, d as u8];
                    n += 1;
                }
                c += 1;
            }
            b += 1;
        }
        a += 1;
    }
    out
}

pub fn permute_card(c: Card, p: &SuitPerm) -> Card {
    Card::new(c.rank(), p[c.suit() as usize])
}

pub fn permute_combo(c: Combo, p: &SuitPerm) -> Combo {
    Combo::new(permute_card(c.hi, p), permute_card(c.lo, p))
}

pub fn permute_set(s: CardSet, p: &SuitPerm) -> CardSet {
    CardSet(s.iter().fold(0, |m, c| m | permute_card(c, p).bit()))
}

/// Canonical representative of a card set under suit relabelling (the permuted set with the
/// smallest mask), plus one permutation that maps the input onto it.
pub fn canonical_set(s: CardSet) -> (CardSet, SuitPerm) {
    SUIT_PERMS
        .iter()
        .map(|p| (permute_set(s, p), *p))
        .min_by_key(|(set, _)| set.0)
        .expect("24 permutations")
}

/// Suit permutations that map the set onto itself. For a monotone flop this has 6 elements
/// (the three unused suits can be shuffled freely), for a rainbow flop of distinct ranks only
/// the identity.
pub fn stabilizer(s: CardSet) -> Vec<SuitPerm> {
    SUIT_PERMS
        .iter()
        .filter(|p| permute_set(s, p) == s)
        .copied()
        .collect()
}

/// Canonical key for an ordered pair of disjoint combos (hero, villain) under suit
/// relabelling. Two pairs with the same key have identical all-in equity.
pub fn canonical_combo_pair(a: Combo, b: Combo) -> (u16, u16) {
    SUIT_PERMS
        .iter()
        .map(|p| {
            (
                permute_combo(a, p).index() as u16,
                permute_combo(b, p).index() as u16,
            )
        })
        .min()
        .expect("24 permutations")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::cards::parse_cards;

    fn set(s: &str) -> CardSet {
        CardSet::from_cards(&parse_cards(s).unwrap())
    }

    #[test]
    fn perms_are_distinct_permutations() {
        let mut seen = std::collections::HashSet::new();
        for p in SUIT_PERMS {
            let mut q = p;
            q.sort();
            assert_eq!(q, [0, 1, 2, 3]);
            assert!(seen.insert(p));
        }
        assert_eq!(SUIT_PERMS[0], [0, 1, 2, 3]);
    }

    #[test]
    fn canonical_form_ignores_suit_labels() {
        let a = set("AsKs7h");
        let (ca, _) = canonical_set(a);
        for p in SUIT_PERMS {
            assert_eq!(canonical_set(permute_set(a, &p)).0, ca);
        }
        let (c, perm) = canonical_set(a);
        assert_eq!(permute_set(a, &perm), c);
        assert_ne!(canonical_set(set("AsKs7s")).0, ca); // monotone ≠ two-tone
    }

    #[test]
    fn stabilizer_sizes() {
        // Monotone: the 3 unused suits permute freely → 3! = 6.
        assert_eq!(stabilizer(set("AsKs7s")).len(), 6);
        // Two-tone: the 2 unused suits can swap → 2.
        assert_eq!(stabilizer(set("AsKs7h")).len(), 2);
        // Rainbow, distinct ranks: every suit is pinned → only the identity.
        assert_eq!(stabilizer(set("AsKh7d")).len(), 1);
        // Paired rainbow: As↔Ah can swap (with the unused suit staying put) → 2.
        assert_eq!(stabilizer(set("AsAh7d")).len(), 2);
        // Empty board: all 24.
        assert_eq!(stabilizer(CardSet::EMPTY).len(), 24);
    }

    #[test]
    fn combo_pair_key_is_invariant() {
        let a = Combo::parse("AhKh").unwrap();
        let b = Combo::parse("QsQd").unwrap();
        let k = canonical_combo_pair(a, b);
        for p in SUIT_PERMS {
            assert_eq!(
                canonical_combo_pair(permute_combo(a, &p), permute_combo(b, &p)),
                k
            );
        }
        // Orientation matters: hero/villain swapped is a different situation.
        assert_ne!(canonical_combo_pair(b, a), k);
    }
}
