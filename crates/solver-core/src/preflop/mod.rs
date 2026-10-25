//! Preflop: exact all-in equities between combos, ICM, push/fold solvers and the 100 bb
//! cash-game model (docs/ARCHITECTURE.md §1.9–1.10).

pub mod icm;
pub mod mccfr;
pub mod pairs;
pub mod pushfold;
pub mod tree;
