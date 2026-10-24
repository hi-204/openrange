//! Postflop solver session behind the wasm-bindgen `Solver` class. Plain Rust (JSON in/out),
//! so it is unit-tested natively.

use serde_json::{Value, json};
use solver_core::cfr::Algorithm;
use solver_core::postflop::json::spot_from_json;
use solver_core::postflop::{Action, PostflopGame, ViewKind, estimate_memory};

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
}

impl Session {
    pub fn new(spot_json: &str, budget_bytes: f64) -> Result<Session, String> {
        let v: Value = serde_json::from_str(spot_json).map_err(|e| format!("bad spot: {e}"))?;
        let cfg = spot_from_json(&v)?;
        let bytes = estimate_memory(&cfg)?;
        let budget = budget_bytes.min(MAX_BUDGET);
        if bytes as f64 > budget {
            return Err(format!(
                "this spot needs about {:.0} MB but the memory budget is {:.0} MB. Try fewer bet sizes, \
                 a lower raise cap, narrower ranges, or the command-line solver for big spots.",
                bytes as f64 / 1e6,
                budget / 1e6
            ));
        }
        Ok(Session {
            game: PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT)?,
            estimate: bytes,
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
            "storageEntries": self.game.storage_entries(),
            "algorithm": "DCFR (α=1.5, β=0, γ=2)",
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
            ViewKind::Chance { cards } => {
                out["kind"] = json!("chance");
                out["cards"] = json!(cards.iter().map(|c| c.to_string()).collect::<Vec<_>>());
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
        let mut s = Session::new(SPOT, 1e9).unwrap();
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
        let e = Session::new(SPOT, 1000.0).err().unwrap();
        assert!(e.contains("memory budget"), "{e}");
    }
}
