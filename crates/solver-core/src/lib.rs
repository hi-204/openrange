//! OpenRange solver core.
//!
//! Pure library: no I/O, no clock, no global mutable state (the evaluator's lookup tables
//! are built once and immutable afterwards). See docs/ARCHITECTURE.md §1.

pub mod cards;
pub mod cfr;
pub mod equity;
pub mod eval;
pub mod games;
pub mod hands;
pub mod iso;
pub mod postflop;
pub mod range;
pub mod rng;

/// Crate version, surfaced in the UI and in every provenance block.
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

/// Number of distinct two-card starting hands, computed by enumeration rather than typed in.
///
/// Used by the M0 "hello world" to prove the Rust → WASM → worker → UI path end to end.
pub fn count_starting_combos() -> u32 {
    let mut n = 0;
    for c1 in 0..52u32 {
        for _c2 in (c1 + 1)..52 {
            n += 1;
        }
    }
    n
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starting_combos_is_52_choose_2() {
        // C(52, 2) = 52 * 51 / 2
        assert_eq!(count_starting_combos(), 52 * 51 / 2);
    }
}
