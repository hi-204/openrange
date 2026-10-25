//! Postflop solver session behind the wasm-bindgen `Solver` class. Plain Rust (JSON in/out),
//! so it is unit-tested natively.

use serde_json::{Value, json};
use solver_core::postflop::abstraction::fit_to_budget;
use solver_core::postflop::json::{spot_from_json, spot_to_json};
use solver_core::postflop::{
    Action, Options, PostflopGame, ViewKind, estimate_memory, estimate_memory_with,
};

/// Largest memory budget the browser build will accept, whatever the user sets (D-011).
pub const MAX_BUDGET: f64 = 3.0e9;

pub fn estimate(spot_json: &str) -> Result<Value, String> {
    let v: Value = serde_json::from_str(spot_json).map_err(|e| format!("bad spot: {e}"))?;
    let cfg = spot_from_json(&v)?;
    let bytes = estimate_memory(&cfg)?;
    Ok(json!({ "bytes": bytes }))
}

pub struct Session {
    pub game: PostflopGame,
    pub estimate: usize,
    /// Simplifications applied to fit the memory budget (empty if none).
    pub abstraction: Vec<String>,
}

impl Session {
    pub fn new(
        spot_json: &str,
        budget_bytes: f64,
        allow_abstraction: bool,
    ) -> Result<Session, String> {
        let v: Value = serde_json::from_str(spot_json).map_err(|e| format!("bad spot: {e}"))?;
        let cfg = spot_from_json(&v)?;
        let budget = budget_bytes.clamp(0.0, MAX_BUDGET) as usize;
        // `"isomorphism": false` turns off suit isomorphism (tests compare both).
        let options = Options {
            isomorphism: v
                .get("isomorphism")
                .and_then(Value::as_bool)
                .unwrap_or(true),
            ..Options::default()
        };
        let (cfg, bytes, abstraction) = if allow_abstraction {
            let f = fit_to_budget(&cfg, budget, options)?;
            (f.config, f.bytes, f.steps)
        } else {
            let bytes = estimate_memory_with(&cfg, options)?;
            if bytes > budget {
                return Err(format!(
                    "this spot needs about {:.0} MB but the memory budget is {:.0} MB. Try fewer bet sizes, \
                     a lower raise cap, narrower ranges, automatic simplification, or the command-line solver.",
                    bytes as f64 / 1e6,
                    budget as f64 / 1e6
                ));
            }
            (cfg, bytes, Vec::new())
        };
        Ok(Session {
            game: PostflopGame::with_options(cfg, options)?,
            estimate: bytes,
            abstraction,
        })
    }

    pub fn info(&self) -> Value {
        let hands = |p: usize| {
            self.game
                .hands(p)
                .iter()
                .map(|c| c.to_string())
                .collect::<Vec<_>>()
        };
        json!({
            "estimateBytes": self.estimate,
            "hands": [hands(0), hands(1)],
            "actionNodes": self.game.tree.num_action_nodes(),
            "expandedNodes": self.game.expanded_nodes(),
            "storageEntries": self.game.storage_entries(),
            "symmetries": self.game.symmetries(),
            "algorithm": "DCFR (α=1.5, β=0, γ=2)",
            "abstraction": self.abstraction,
            "spot": spot_to_json(&self.game.config),
        })
    }

    pub fn step(&mut self, n: u32) -> u32 {
        for _ in 0..n {
            self.game.iterate();
        }
        self.game.iterations()
    }

    pub fn exploitability(&mut self) -> Value {
        let ex = self.game.exploitability();
        let ev = self.game.expected_values();
        json!({
            "iterations": self.game.iterations(),
            "chips": ex.chips, "bb": ex.bb, "pctPot": ex.pct_pot,
            "evBb": [ev[0] / 100.0, ev[1] / 100.0],
        })
    }

    pub fn node(&mut self, path_json: &str) -> Result<Value, String> {
        let path: Vec<usize> =
            serde_json::from_str(path_json).map_err(|e| format!("bad path: {e}"))?;
        let v = self.game.node(&path)?;
        let board: Vec<String> = v.board.iter().map(|c| c.to_string()).collect();
        let base = json!({
            "board": board, "pot": v.pot as f64 / 100.0, "street": format!("{:?}", v.street),
            "committed": [v.committed[0] as f64 / 100.0, v.committed[1] as f64 / 100.0],
            "reach": [v.reach[0].clone(), v.reach[1].clone()],
        });
        let mut out = base;
        match v.kind {
            ViewKind::Action {
                player,
                actions,
                strategy,
                ev,
            } => {
                out["kind"] = json!("action");
                out["player"] = json!(player);
                out["actions"] = json!(actions.iter().map(Action::label).collect::<Vec<_>>());
                out["aggressive"] = json!(
                    actions
                        .iter()
                        .map(Action::is_aggressive)
                        .collect::<Vec<_>>()
                );
                out["strategy"] = json!(strategy);
                // NaN (unreachable hand) isn't valid JSON; send null instead.
                out["evBb"] = Value::Array(
                    ev.iter()
                        .map(|&x| {
                            if x.is_finite() {
                                json!(x as f64 / 100.0)
                            } else {
                                Value::Null
                            }
                        })
                        .collect(),
                );
            }
            ViewKind::Chance { cards, mirrors } => {
                out["kind"] = json!("chance");
                out["cards"] = json!(cards.iter().map(|c| c.to_string()).collect::<Vec<_>>());
                out["mirrors"] = json!(
                    mirrors
                        .iter()
                        .map(|m| m.iter().map(|c| c.to_string()).collect::<Vec<_>>())
                        .collect::<Vec<_>>()
                );
            }
            ViewKind::Fold { folder } => {
                out["kind"] = json!("fold");
                out["folder"] = json!(folder);
            }
            ViewKind::Showdown => out["kind"] = json!("showdown"),
        }
        Ok(out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const SPOT: &str = r#"{"board":"Ks Th 7d 4c 2s","pot":10,"stack":50,
        "ranges":{"oop":"TT+, AJs+, KQs","ip":"99+, ATs+, KJs+"},
        "sizes":{"default":{"oop":{"bet":"50","raise":"100"},"ip":{"bet":"50","raise":"100"}}}}"#;

    #[test]
    fn session_solves_and_reports() {
        let mut s = Session::new(SPOT, 1e9, false).unwrap();
        assert_eq!(s.step(200), 200);
        let ex = s.exploitability();
        assert!(ex["pctPot"].as_f64().unwrap() < 1.0, "{ex}");
        let root = s.node("[]").unwrap();
        assert_eq!(root["kind"], "action");
        assert_eq!(root["actions"][0], "Check");
        let after_bet = s.node("[1]").unwrap();
        assert_eq!(after_bet["player"], 1);
        assert!(s.node("[9]").is_err());
    }

    #[test]
    fn refuses_spots_over_the_memory_budget() {
        let e = Session::new(SPOT, 1000.0, false).err().unwrap();
        assert!(e.contains("memory budget"), "{e}");
    }

    #[test]
    fn simplifies_a_flop_to_fit_and_reports_it() {
        let flop = r#"{"board":"Qs Jh 4d","pot":6,"stack":97,
            "ranges":{"oop":"22+, A2s+, KTs+, QTs+, JTs, ATo+","ip":"22+, A2s+, K9s+, Q9s+, J9s+, T9s, A9o+, KJo+"},
            "sizes":{"default":{"oop":{"bet":"33, 75","raise":"100"},"ip":{"bet":"33, 75","raise":"100"}}},"maxRaises":2}"#;
        let full = estimate(flop).unwrap()["bytes"].as_f64().unwrap();
        let s = Session::new(flop, full / 4.0, true).unwrap();
        let info = s.info();
        assert!(
            !info["abstraction"].as_array().unwrap().is_empty(),
            "{info}"
        );
        assert!(info["estimateBytes"].as_f64().unwrap() <= full / 4.0);
        assert!(Session::new(flop, full / 4.0, false).is_err());
    }

    #[test]
    fn chance_nodes_list_representative_cards() {
        let turn = r#"{"board":"Ks Ts 7s 2s","pot":10,"stack":50,
            "ranges":{"oop":"QQ+, AJs+","ip":"TT+, ATs+"},
            "sizes":{"default":{"oop":{"bet":"","raise":""},"ip":{"bet":"","raise":""}}}}"#;
        let mut s = Session::new(turn, 1e9, false).unwrap();
        s.step(5);
        // No bets: check, check, then the river card.
        let n = s.node("[0, 0]").unwrap();
        assert_eq!(n["kind"], "chance");
        let cards = n["cards"].as_array().unwrap().len();
        let mirrored: usize = n["mirrors"]
            .as_array()
            .unwrap()
            .iter()
            .map(|m| m.as_array().unwrap().len())
            .sum();
        assert_eq!(
            cards + mirrored,
            48,
            "every river card is either listed or mirrored"
        );
        assert!(mirrored > 0);
    }
}
