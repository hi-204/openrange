//! `solver-cli report`: aggregated flop report (D-077). Solves the single-raised pot "BTN opens,
//! BB calls" (ranges from a cash chart file) on a seeded sample of flops with a small tree, and
//! records per flop how often the big blind leads, how often the button continuation-bets
//! when checked to, and how the big blind answers the c-bet. Frequencies are weighted by the
//! chart ranges only: the calibration's probe classes (see `calibrate_eqr`) carry no weight.

use crate::calibrate_eqr::{Matchup, flop_sample, matchups, spot};
use crate::provenance::{Source, provenance};
use rayon::prelude::*;
use serde_json::{Value, json};
use solver_core::cards::{Card, CardSet};
use solver_core::cfr::Algorithm;
use solver_core::equity::exact_range_vs_range;
use solver_core::hands::HandClass;
use solver_core::postflop::{PostflopGame, ViewKind, estimate_memory};
use solver_core::range::Range;
use std::time::Instant;

pub const OUT: &str = "data/reports/flop-srp-btn-bb.json";

/// Reach-weighted frequency of each action at `view`, counting each hand by its chart weight
/// (`chart[class]`) times the share of its starting weight still present (`reach / init`).
fn frequencies(
    view: &solver_core::postflop::NodeView,
    g: &PostflopGame,
    chart: &[f64],
) -> Result<(Vec<String>, Vec<f64>), String> {
    let ViewKind::Action {
        player,
        actions,
        strategy,
        ..
    } = &view.kind
    else {
        return Err("expected a decision node".into());
    };
    let p = *player;
    let n = g.hands(p).len();
    let init = g.initial_weights(p);
    let mut out = vec![0.0; actions.len()];
    let mut total = 0.0;
    for (h, combo) in g.hands(p).iter().enumerate() {
        if init[h] <= 0.0 {
            continue;
        }
        let w = chart[HandClass::of(*combo).index()] * (view.reach[p][h] / init[h]) as f64;
        total += w;
        for (a, f) in out.iter_mut().enumerate() {
            *f += w * strategy[a * n + h] as f64;
        }
    }
    if total <= 0.0 {
        return Err("no chart weight at this node".into());
    }
    Ok((
        actions.iter().map(|a| a.label()).collect(),
        out.iter().map(|x| x / total).collect(),
    ))
}

fn chart_range(weights: &[f64]) -> Range {
    let mut r = Range::empty();
    for c in HandClass::all() {
        r.set_class(c, weights[c.index()] as f32);
    }
    r
}

fn solve_flop(
    m: &Matchup,
    board: &[Card],
    raises: u8,
    target: f64,
    max_iterations: u32,
) -> Result<Value, String> {
    let cfg = spot(m, board, raises)?;
    let mut g = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT)?;
    let mut ex = g.exploitability();
    while g.iterations() < max_iterations && ex.pct_pot > target {
        for _ in 0..25 {
            g.iterate();
        }
        ex = g.exploitability();
    }
    let root = g.node(&[])?;
    let (root_actions, root_freq) = frequencies(&root, &g, &m.oop.weights)?;
    let check = root_actions
        .iter()
        .position(|a| a == "Check")
        .ok_or("no check at the root")?;
    let after_check = g.node(&[check])?;
    let (ip_actions, ip_freq) = frequencies(&after_check, &g, &m.ip.weights)?;
    let bet = ip_actions
        .iter()
        .position(|a| a != "Check")
        .ok_or("no c-bet option")?;
    let facing = g.node(&[check, bet])?;
    let (vs_actions, vs_freq) = frequencies(&facing, &g, &m.oop.weights)?;
    let eq = exact_range_vs_range(
        &chart_range(&m.ip.weights),
        &chart_range(&m.oop.weights),
        board,
        CardSet::EMPTY,
    )
    .map_err(|e| e.to_string())?;
    let round = |x: f64| (x * 1e4).round() / 1e4;
    let map = |labels: &[String], freq: &[f64]| -> Value {
        labels
            .iter()
            .zip(freq)
            .map(|(l, f)| (l.clone(), json!(round(*f))))
            .collect::<serde_json::Map<_, _>>()
            .into()
    };
    Ok(json!({
        "board": board.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(" "),
        "iterations": g.iterations(),
        "exploitabilityPctPot": round(ex.pct_pot),
        "bbFirst": map(&root_actions, &root_freq),
        "btnAfterCheck": map(&ip_actions, &ip_freq),
        "bbVsCbet": map(&vs_actions, &vs_freq),
        "btnEquity": round(eq.equity),
    }))
}

#[allow(clippy::too_many_arguments)]
pub fn run(
    charts_path: &str,
    flops: usize,
    raises: u8,
    target: f64,
    max_iterations: u32,
    memory_gb: f64,
    seed: u64,
    out: &str,
) -> Result<(), String> {
    let started = Instant::now();
    let solver =
        json!({ "algorithm": "dcfr", "targetPctPot": target, "maxIterations": max_iterations });
    let mut prov = provenance(
        Source::SolverApprox,
        &format!(
            "solver-cli report --charts {charts_path} --flops {flops} --raises {raises} --seed {seed}"
        ),
        solver,
        "Single-raised pot, BTN opens and BB calls, ranges from the input cash chart file (an \
         approximate model). Each flop is solved with a small tree: one bet size per street \
         (33% flop, 66% turn, 75% river), raises as given, solved to the stated accuracy. \
         Frequencies count each hand by its chart weight.",
    );
    prov["seed"] = json!(seed);
    let text = std::fs::read_to_string(charts_path).map_err(|e| format!("{charts_path}: {e}"))?;
    let doc: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let all = matchups(&doc)?;
    let m = all.first().ok_or("no matchups")?;
    let boards = flop_sample(flops, seed);
    let worst = boards
        .iter()
        .map(|b| spot(m, b, raises).and_then(|c| estimate_memory(&c)))
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .max()
        .unwrap_or(1);
    let threads = ((memory_gb * 1e9 / worst as f64).floor() as usize).clamp(
        1,
        std::thread::available_parallelism().map_or(4, |n| n.get()),
    );
    eprintln!(
        "report: {} flops, largest needs {:.0} MB; running {threads} at a time",
        boards.len(),
        worst as f64 / 1e6
    );
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .map_err(|e| e.to_string())?;
    let done = std::sync::atomic::AtomicUsize::new(0);
    let results: Vec<Result<Value, String>> = pool.install(|| {
        boards
            .par_iter()
            .map(|b| {
                let r = solve_flop(m, b, raises, target, max_iterations);
                let k = done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                if let Ok(v) = &r {
                    eprintln!(
                        "report: {k}/{} {}: {} iterations, {:.2}% of pot ({:.0}s)",
                        boards.len(),
                        v["board"].as_str().unwrap_or(""),
                        v["iterations"],
                        v["exploitabilityPctPot"].as_f64().unwrap_or(0.0),
                        started.elapsed().as_secs_f64()
                    );
                }
                r
            })
            .collect()
    });
    let flops_json = results.into_iter().collect::<Result<Vec<_>, _>>()?;
    let doc = json!({
        "provenance": prov,
        "spot": { "name": m.name, "oop": m.oop.seat, "ip": m.ip.seat, "pot": m.pot, "stack": m.stack, "raises": raises,
                  "sizes": { "flop": 33, "turn": 66, "river": 75 } },
        "flops": flops_json,
    });
    if let Some(dir) = std::path::Path::new(out).parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(
        out,
        serde_json::to_string_pretty(&doc).map_err(|e| e.to_string())? + "\n",
    )
    .map_err(|e| format!("{out}: {e}"))?;
    eprintln!(
        "report: wrote {out} in {:.0}s",
        started.elapsed().as_secs_f64()
    );
    Ok(())
}
