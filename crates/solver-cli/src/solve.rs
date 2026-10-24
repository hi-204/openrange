//! `solver-cli solve <spot.json>`: solve one spot and print a summary.

use solver_core::cfr::Algorithm;
use solver_core::postflop::json::spot_from_json;
use solver_core::postflop::{PostflopGame, ViewKind, estimate_memory};
use std::time::Instant;

pub fn run(path: &str, iterations: u32, target_pct: f64) -> Result<(), String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let v: serde_json::Value = serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;
    let cfg = spot_from_json(&v)?;
    println!(
        "estimated memory: {:.1} MB",
        estimate_memory(&cfg)? as f64 / 1e6
    );
    let mut g = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT)?;
    println!(
        "hands: {} OOP / {} IP, action nodes: {}",
        g.hands(0).len(),
        g.hands(1).len(),
        g.tree.num_action_nodes()
    );
    let start = Instant::now();
    let mut ex = g.exploitability();
    while g.iterations() < iterations {
        g.iterate();
        if g.iterations().is_multiple_of(100) || g.iterations() == iterations {
            ex = g.exploitability();
            println!(
                "iteration {:>6}: exploitability {:.4}% of pot ({:.4} bb), {:.1}s",
                g.iterations(),
                ex.pct_pot,
                ex.bb,
                start.elapsed().as_secs_f64()
            );
            if ex.pct_pot <= target_pct {
                break;
            }
        }
    }
    let ev = g.expected_values();
    println!(
        "done: {} iterations, exploitability {:.4}% of pot; EV OOP {:.3} bb, IP {:.3} bb",
        g.iterations(),
        ex.pct_pot,
        ev[0] / 100.0,
        ev[1] / 100.0
    );
    let root = g.node(&[])?;
    if let ViewKind::Action {
        player,
        actions,
        strategy,
        ..
    } = &root.kind
    {
        let n = g.hands(*player).len();
        let total: f64 = root.reach[*player].iter().map(|&w| w as f64).sum();
        println!("root ({}):", if *player == 0 { "OOP" } else { "IP" });
        for (a, action) in actions.iter().enumerate() {
            let f: f64 = (0..n)
                .map(|h| root.reach[*player][h] as f64 * strategy[a * n + h] as f64)
                .sum::<f64>()
                / total;
            println!("  {:<14} {:>6.2}%", action.label(), f * 100.0);
        }
    }
    Ok(())
}
