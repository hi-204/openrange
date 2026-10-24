//! Counterfactual regret minimization.
//!
//! - [`tabular`]: explicit-tree CFR for small validation games (Kuhn, Leduc), plus the
//!   shared [`Algorithm`] update rules.
//! - The poker solver in [`crate::postflop`] applies the same rules vectorized over hands.

pub mod tabular;

pub use tabular::Algorithm;
