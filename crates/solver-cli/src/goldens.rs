//! `solver-cli gen-goldens`: solve a fixed set of river spots and store their results, so any
//! change in solver output is noticed (tests re-solve and compare, bit for bit).

use crate::provenance::{Source, provenance};
use serde_json::{Value, json};
use solver_core::cfr::Algorithm;
use solver_core::postflop::json::{spot_from_json, spot_to_json};
use solver_core::postflop::{PostflopGame, SpotConfig, reference::toy_polarized};

pub const PATH: &str = "data/goldens/river.json";

/// The golden spots: name, spot JSON, iterations.
pub fn spots() -> Vec<(&'static str, Value, u32)> {
    vec![
        ("toy-polarized-75", spot_to_json(&toy_polarized(0.75)), 1000),
        (
            "single-raised-pot-river",
            json!({
                "board": "Qs Jh 7d 4c 2s", "pot": 10, "stack": 90,
                "ranges": {
                    "oop": "22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, ATo+, KTo+, QTo+, JTo",
                    "ip": "22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A5o+, K9o+, Q9o+, J9o+, T9o"
                },
                "sizes": { "default": { "oop": { "bet": "33, 75, 150", "raise": "100" }, "ip": { "bet": "33, 75, 150", "raise": "100" } } },
                "maxRaises": 2, "allInThreshold": 0.67
            }),
            500,
        ),
        (
            "raked-river",
            json!({
                "board": "Ah 9d 6c 6s 2h", "pot": 6, "stack": 47,
                "ranges": { "oop": "TT-77, A9s+, KTs+, 87s, 65s, AJo+", "ip": "QQ+, 99-55, A8s+, 76s, 54s, AQo+" },
                "sizes": { "default": { "oop": { "bet": "50, a", "raise": "a" }, "ip": { "bet": "75", "raise": "a" } } },
                "maxRaises": 1, "allInThreshold": 0.67,
                "rake": { "percent": 5, "capBb": 3 }
            }),
            500,
        ),
    ]
}

pub struct Solved {
    pub fingerprint: u64,
    pub ev: [f64; 2],
    pub exploitability_pct: f64,
}

pub fn solve(cfg: &SpotConfig, iterations: u32) -> Result<Solved, String> {
    let mut g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT)?;
    for _ in 0..iterations {
        g.iterate();
    }
    Ok(Solved {
        fingerprint: g.fingerprint(),
        ev: g.expected_values(),
        exploitability_pct: g.exploitability().pct_pot,
    })
}

pub fn run(out: &str) -> Result<(), String> {
    let mut entries = Vec::new();
    for (name, spot, iterations) in spots() {
        let cfg = spot_from_json(&spot)?;
        let r = solve(&cfg, iterations)?;
        eprintln!(
            "gen-goldens: {name}: exploitability {:.4}% of pot, fingerprint {:016x}",
            r.exploitability_pct, r.fingerprint
        );
        entries.push(json!({
            "name": name,
            "spot": spot,
            "iterations": iterations,
            "algorithm": "dcfr(1.5,0,2)",
            "fingerprint": format!("{:016x}", r.fingerprint),
            "evBb": [r.ev[0] / 100.0, r.ev[1] / 100.0],
            "exploitabilityPctPot": r.exploitability_pct,
        }));
    }
    let doc = json!({
        "provenance": provenance(
            Source::SolverExact,
            "solver-cli gen-goldens",
            json!({ "algorithm": "dcfr", "alpha": 1.5, "beta": 0, "gamma": 2 }),
            "Regression goldens: fixed river spots solved for a fixed number of iterations. \
             Not converged strategies for study; they exist to detect changes in solver output.",
        ),
        "spots": entries,
    });
    if let Some(dir) = std::path::Path::new(out).parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())?;
    std::fs::write(out, format!("{text}\n")).map_err(|e| format!("writing {out}: {e}"))?;
    eprintln!("gen-goldens: wrote {out}");
    Ok(())
}
