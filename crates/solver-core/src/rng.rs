//! Seeded pseudo-random numbers: SplitMix64 for seeding, xoshiro256** for streams.
//!
//! Implemented here (not via the `rand` crate) so that a seed produces the same numbers
//! forever, whatever dependency versions are in use (D-013). Not cryptographic.

use crate::cards::{Card, CardSet};

/// SplitMix64 (Steele, Lea, Flood 2014). Used to expand one seed into xoshiro's state.
pub struct SplitMix64(pub u64);

impl SplitMix64 {
    pub fn next_u64(&mut self) -> u64 {
        self.0 = self.0.wrapping_add(0x9E37_79B9_7F4A_7C15);
        let mut z = self.0;
        z = (z ^ (z >> 30)).wrapping_mul(0xBF58_476D_1CE4_E5B9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94D0_49BB_1331_11EB);
        z ^ (z >> 31)
    }
}

/// xoshiro256** 1.0 (Blackman, Vigna 2018).
#[derive(Clone, Debug)]
pub struct Rng {
    s: [u64; 4],
}

impl Rng {
    pub fn seed(seed: u64) -> Rng {
        let mut sm = SplitMix64(seed);
        Rng {
            s: [sm.next_u64(), sm.next_u64(), sm.next_u64(), sm.next_u64()],
        }
    }

    pub fn next_u64(&mut self) -> u64 {
        let s = &mut self.s;
        let result = s[1].wrapping_mul(5).rotate_left(7).wrapping_mul(9);
        let t = s[1] << 17;
        s[2] ^= s[0];
        s[3] ^= s[1];
        s[1] ^= s[2];
        s[0] ^= s[3];
        s[2] ^= t;
        s[3] = s[3].rotate_left(45);
        result
    }

    /// Uniform integer in `0..n` without modulo bias (Lemire's multiply-shift with rejection).
    pub fn below(&mut self, n: u64) -> u64 {
        assert!(n > 0);
        let threshold = n.wrapping_neg() % n;
        loop {
            let m = (self.next_u64() as u128) * (n as u128);
            if (m as u64) >= threshold {
                return (m >> 64) as u64;
            }
        }
    }

    /// Uniform float in [0, 1) with 53 random bits.
    pub fn f64(&mut self) -> f64 {
        (self.next_u64() >> 11) as f64 * (1.0 / (1u64 << 53) as f64)
    }

    /// `n` distinct random cards not in `dead` (a card mask).
    pub fn sample_cards(&mut self, n: usize, dead: u64) -> Vec<Card> {
        let mut used = CardSet(dead);
        assert!(52 - used.len() as usize >= n, "not enough live cards");
        let mut out = Vec::with_capacity(n);
        while out.len() < n {
            let c = Card::from_index(self.below(52) as u8);
            if !used.contains(c) {
                used.insert(c);
                out.push(c);
            }
        }
        out
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splitmix64_known_answers() {
        // Reference outputs of SplitMix64 for seed 0.
        let mut sm = SplitMix64(0);
        assert_eq!(sm.next_u64(), 0xE220_A839_7B1D_CDAF);
        assert_eq!(sm.next_u64(), 0x6E78_9E6A_A1B9_65F4);
        assert_eq!(sm.next_u64(), 0x06C4_5D18_8009_454F);
    }

    #[test]
    fn same_seed_same_stream() {
        let a: Vec<u64> = {
            let mut r = Rng::seed(42);
            (0..100).map(|_| r.next_u64()).collect()
        };
        let mut r = Rng::seed(42);
        assert!(a.iter().all(|&x| x == r.next_u64()));
        assert_ne!(Rng::seed(43).next_u64(), a[0]);
    }

    #[test]
    fn below_is_roughly_uniform() {
        let mut r = Rng::seed(7);
        let mut hist = [0u32; 6];
        let n = 60_000;
        for _ in 0..n {
            hist[r.below(6) as usize] += 1;
        }
        // Each bucket expects 10,000 with σ ≈ 91; allow 5σ.
        assert!(
            hist.iter().all(|&h| (h as i64 - 10_000).abs() < 460),
            "{hist:?}"
        );
    }

    #[test]
    fn sample_cards_avoids_dead_cards() {
        let mut r = Rng::seed(1);
        let dead = 0x00FF_FFFF_FFFF_u64; // first 40 cards dead
        for _ in 0..100 {
            let cards = r.sample_cards(12, dead);
            assert_eq!(CardSet::from_cards(&cards).len(), 12);
            assert!(cards.iter().all(|c| c.index() >= 40));
        }
    }
}
