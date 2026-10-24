//! Thin wasm-bindgen layer over solver-core. No poker logic lives here.

use wasm_bindgen::prelude::*;

/// solver-core version string.
#[wasm_bindgen]
pub fn version() -> String {
    solver_core::VERSION.to_string()
}

/// M0 smoke test: number of two-card combos, computed in Rust.
#[wasm_bindgen(js_name = countStartingCombos)]
pub fn count_starting_combos() -> u32 {
    solver_core::count_starting_combos()
}
