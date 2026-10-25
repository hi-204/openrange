//! Thin wasm-bindgen layer over solver-core. Requests and responses are JSON strings so the
//! boundary stays small and easy to test natively (`cargo test -p solver-wasm`).
//! Poker logic lives in solver-core; this crate only translates and picks methods.

mod api;
mod pushfold;
mod solver;

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

/// Memory a spot would need, without allocating it: `{bytes}`. Throws on a bad spot.
#[wasm_bindgen(js_name = estimateMemory)]
pub fn estimate_memory(spot_json: &str) -> Result<String, JsError> {
    solver::estimate(spot_json)
        .map(|v| v.to_string())
        .map_err(|e| JsError::new(&e))
}

/// A postflop solving session. Created only if the memory estimate fits the budget.
#[wasm_bindgen]
pub struct Solver(solver::Session);

#[wasm_bindgen]
impl Solver {
    /// `allowAbstraction`: if the spot doesn't fit the budget, simplify the tree (and report
    /// how in `info().abstraction`) instead of refusing.
    #[wasm_bindgen(constructor)]
    pub fn new(
        spot_json: &str,
        budget_bytes: f64,
        allow_abstraction: bool,
    ) -> Result<Solver, JsError> {
        solver::Session::new(spot_json, budget_bytes, allow_abstraction)
            .map(Solver)
            .map_err(|e| JsError::new(&e))
    }

    /// `{estimateBytes, hands: [[combo]...], actionNodes, storageEntries, algorithm}`
    pub fn info(&self) -> String {
        self.0.info().to_string()
    }

    /// Run `n` more iterations; returns the total.
    pub fn step(&mut self, n: u32) -> u32 {
        self.0.step(n)
    }

    /// `{iterations, chips, bb, pctPot, evBb: [oop, ip]}`
    pub fn exploitability(&mut self) -> String {
        self.0.exploitability().to_string()
    }

    /// Hex fingerprint of the solver state; equal across native and WASM builds for the same
    /// inputs (checked against the regression goldens).
    pub fn fingerprint(&self) -> String {
        format!("{:016x}", self.0.game.fingerprint())
    }

    /// Node reached by `pathJson` (array of action/card indices).
    pub fn node(&mut self, path_json: &str) -> Result<String, JsError> {
        self.0
            .node(path_json)
            .map(|v| v.to_string())
            .map_err(|e| JsError::new(&e))
    }
}

/// Load the exact combo-pair equities (`data/equity/preflop-pairs.json` text) once.
#[wasm_bindgen(js_name = loadPairs)]
pub fn load_pairs(json: &str) -> Result<String, JsError> {
    pushfold::load_pairs(json)
        .map(|v| v.to_string())
        .map_err(|e| JsError::new(&e))
}

#[wasm_bindgen(js_name = pairsLoaded)]
pub fn pairs_loaded() -> bool {
    pushfold::pairs_loaded()
}

/// Exact heads-up push/fold: `{stacks, pusher, caller, ante, payouts}` (empty payouts = chip
/// EV). Needs `loadPairs` first.
#[wasm_bindgen(js_name = pushFold)]
pub fn push_fold(spot_json: &str) -> Result<String, JsError> {
    pushfold::solve_spot(spot_json)
        .map(|v| v.to_string())
        .map_err(|e| JsError::new(&e))
}

/// Hero hand (combo or class) against a per-class continuing range, with exact card removal:
/// the villain's continue probability and the hero's equity against the continuing hands.
/// Needs `loadPairs` first.
#[wasm_bindgen(js_name = preflopMatchup)]
pub fn preflop_matchup(json: &str) -> Result<String, JsError> {
    pushfold::matchup(json)
        .map(|v| v.to_string())
        .map_err(|e| JsError::new(&e))
}

/// Evaluate 5 to 7 cards: category, comparable strength and the best five cards.
#[wasm_bindgen(js_name = evaluateHand)]
pub fn evaluate_hand(cards: &str) -> String {
    api::evaluate(cards).to_string()
}

/// ICM prize equity of each stack for a payout list (Malmuth–Harville).
#[wasm_bindgen]
pub fn icm(request_json: &str) -> String {
    api::icm(request_json).to_string()
}

/// Outs against a known hand on a flop or turn: which next cards put the hero ahead or tie.
#[wasm_bindgen(js_name = countOuts)]
pub fn count_outs(request_json: &str) -> String {
    api::outs(request_json).to_string()
}
