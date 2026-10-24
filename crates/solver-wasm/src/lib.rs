//! Thin wasm-bindgen layer over solver-core. Requests and responses are JSON strings so the
//! boundary stays small and easy to test natively (`cargo test -p solver-wasm`).
//! Poker logic lives in solver-core; this crate only translates and picks methods.

mod api;

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

/// Parse a range string. Returns JSON: `{ok, canonical, combos, weights[1326]}` or
/// `{ok: false, error}`.
#[wasm_bindgen(js_name = parseRange)]
pub fn parse_range(text: &str) -> String {
    api::parse_range(text).to_string()
}

/// All-in equity. Request JSON: `{ranges: [string], board, dead, mode, samples, seed}`;
/// see `api::equity` for the response shape.
#[wasm_bindgen]
pub fn equity(request_json: &str) -> String {
    api::equity(request_json).to_string()
}
