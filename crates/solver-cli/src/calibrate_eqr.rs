//! `solver-cli calibrate-eqr`: measure equity realization from OpenRange's own postflop
//! solves (EQR v2, D-048).
//!
//! For four representative lines taken from a cash chart file (single-raised: BTN vs BB and
//! CO vs BTN; 3-bet: BB vs BTN and BTN vs CO), a seeded sample of flops is solved with the
//! postflop solver on a small tree. For every hand, realization = (EV at the flop ÷ pot) ÷
//! (all-in equity against the opponent's range on that flop). Per hand class and role
//! (pot type × in position × preflop aggressor) the factor is Σ share ÷ Σ equity over the
//! class's combos on all flops, each combo counted by how often it meets the opponent's range
//! (card removal).
//!
//! Every class the chart doesn't play is added at a tiny probe weight. In CFR a hand's strategy
//! doesn't depend on its own reach, so a probe hand plays its best line against an opponent who
//! is essentially unchanged: its factor is what that class would realize if it were added to the
//! range, which is what a preflop decision needs. Classes with no data fall back to the role
//! average (weighted by the chart ranges) and are flagged.

use crate::provenance::{Source, provenance};
use rayon::prelude::*;
use serde_json::{Value, json};
use solver_core::cards::CardSet;
use solver_core::cfr::Algorithm;
use solver_core::equity::exact_range_vs_range;
use solver_core::hands::{HandClass, NUM_CLASSES};
use solver_core::iso::canonical_set;
use solver_core::postflop::json::spot_from_json;
use solver_core::postflop::{PostflopGame, SpotConfig, estimate_memory};
use solver_core::preflop::mccfr::ClassFactors;
use solver_core::range::Range;
use solver_core::rng::Rng;
use std::time::Instant;

pub const OUT: &str = "data/eqr/eqr-v2.json";

/// One side of a matchup: its role and its range at the flop.
struct Side {
    seat: &'static str,
    aggressor: bool,
    range: Range,
    /// Chart weight of each class (0 for probe-only classes), for the role averages.
    weights: Vec<f64>,
}

struct Matchup {
    name: &'static str,
    /// 0 single-raised pot, 1 three-bet pot.
    pot_type: usize,
    oop: Side,
    ip: Side,
    pot: f64,
    stack: f64,
}

/// Probability of action `k` for each class in chart `id` of a chart file.
fn column(doc: &Value, id: &str, k: usize) -> Result<Vec<f64>, String> {
    let chart = doc["charts"]
        .as_array()
        .ok_or("chart file has no charts")?
        .iter()
        .find(|c| c["id"] == id)
        .ok_or_else(|| format!("chart {id} not found"))?;
    chart["strategy"]
        .as_array()
        .ok_or("no strategy")?
        .iter()
        .map(|row| row[k].as_f64().ok_or_else(|| format!("{id}: bad strategy")))
        .collect()
}

/// Size (bb) of the aggressive action in a chart, from its label ("Raise 7.5").
fn raise_size(doc: &Value, id: &str) -> Result<f64, String> {
    let chart = doc["charts"]
        .as_array()
        .ok_or("no charts")?
        .iter()
        .find(|c| c["id"] == id)
        .ok_or_else(|| format!("chart {id} not found"))?;
    let label = chart["actions"]
        .as_array()
        .ok_or("no actions")?
        .last()
        .and_then(Value::as_str)
        .ok_or("no actions")?;
    label
        .rsplit(' ')
        .next()
        .and_then(|x| x.parse().ok())
        .ok_or_else(|| format!("{id}: can't read size from '{label}'"))
}

/// Weight given to classes the chart doesn't play (see the module comment).
const PROBE: f64 = 0.005;

/// A side whose range gives every combo of each class that class's chart weight, or the probe
/// weight if the chart plays it less often than that.
fn side(seat: &'static str, aggressor: bool, weights: &[f64]) -> Side {
    let weights: Vec<f64> = weights
        .iter()
        .map(|&w| if w >= PROBE { w.min(1.0) } else { 0.0 })
        .collect();
    let mut range = Range::empty();
    for c in HandClass::all() {
        range.set_class(c, weights[c.index()].max(PROBE) as f32);
    }
    Side {
        seat,
        aggressor,
        range,
        weights,
    }
}

fn product(a: &[f64], b: &[f64]) -> Vec<f64> {
    a.iter().zip(b).map(|(x, y)| x * y).collect()
}

fn matchups(doc: &Value) -> Result<Vec<Matchup>, String> {
    let stack = doc["stack"].as_f64().ok_or("chart file has no stack")?;
    let open = |seat: &str| column(doc, &format!("first-in-{seat}"), 1);
    let btn_open = open("BTN")?;
    let co_open = open("CO")?;
    let bb_vs_btn = (
        "vs-open-BB-vs-BTN",
        column(doc, "vs-open-BB-vs-BTN", 1)?,
        column(doc, "vs-open-BB-vs-BTN", 2)?,
    );
    let btn_vs_co = (
        "vs-open-BTN-vs-CO",
        column(doc, "vs-open-BTN-vs-CO", 1)?,
        column(doc, "vs-open-BTN-vs-CO", 2)?,
    );
    let open_size = raise_size(doc, "first-in-BTN")?;
    let bb_3bet = raise_size(doc, bb_vs_btn.0)?;
    let btn_3bet = raise_size(doc, btn_vs_co.0)?;
    Ok(vec![
        Matchup {
            name: "single-raised pot: BTN opens, BB calls",
            pot_type: 0,
            oop: side("BB", false, &bb_vs_btn.1),
            ip: side("BTN", true, &btn_open),
            pot: 2.0 * open_size + 0.5,
            stack: stack - open_size,
        },
        Matchup {
            name: "single-raised pot: CO opens, BTN calls",
            pot_type: 0,
            oop: side("CO", true, &co_open),
            ip: side("BTN", false, &btn_vs_co.1),
            pot: 2.0 * open_size + 1.5,
            stack: stack - open_size,
        },
        Matchup {
            name: "3-bet pot: BTN opens, BB 3-bets, BTN calls",
            pot_type: 1,
            oop: side("BB", true, &bb_vs_btn.2),
            ip: side(
                "BTN",
                false,
                &product(&btn_open, &column(doc, "vs-3bet-BTN-vs-BB", 1)?),
            ),
            pot: 2.0 * bb_3bet + 0.5,
            stack: stack - bb_3bet,
        },
        Matchup {
            name: "3-bet pot: CO opens, BTN 3-bets, CO calls",
            pot_type: 1,
            oop: side(
                "CO",
                false,
                &product(&co_open, &column(doc, "vs-3bet-CO-vs-BTN", 1)?),
            ),
            ip: side("BTN", true, &btn_vs_co.2),
            pot: 2.0 * btn_3bet + 1.5,
            stack: stack - btn_3bet,
        },
    ])
}

/// The small calibration tree: one bet size per street, no raises.
fn spot(m: &Matchup, board: &[solver_core::cards::Card]) -> Result<SpotConfig, String> {
    let mut cfg = spot_from_json(&json!({
        "board": board.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(" "),
        "pot": m.pot, "stack": m.stack,
        "ranges": { "oop": "AA", "ip": "KK" },
        "sizes": {
            "flop": { "oop": { "bet": "33" }, "ip": { "bet": "33" } },
            "turn": { "oop": { "bet": "66" }, "ip": { "bet": "66" } },
            "river": { "oop": { "bet": "75" }, "ip": { "bet": "75" } }
        },
        "maxRaises": 0, "allInThreshold": 0.67
    }))?;
    cfg.ranges = [m.oop.range.clone(), m.ip.range.clone()];
    Ok(cfg)
}

/// A seeded sample of distinct flops (distinct up to suit relabelling).
fn flop_sample(n: usize, seed: u64) -> Vec<Vec<solver_core::cards::Card>> {
    let mut rng = Rng::seed(seed);
    let mut seen = std::collections::HashSet::new();
    let mut out = Vec::new();
    while out.len() < n {
        let mut f = rng.sample_cards(3, 0);
        f.sort_by_key(|c| std::cmp::Reverse(c.index()));
        if seen.insert(canonical_set(CardSet::from_cards(&f)).0.0) {
            out.push(f);
        }
    }
    out
}

/// Per class: Σ share and Σ equity over combos, each counted by how often it meets the
/// opponent's range; and the same totals weighted by the chart range, for the role average.
struct Sums {
    share: Vec<f64>,
    equity: Vec<f64>,
    chart_share: f64,
    chart_equity: f64,
}

struct SolveResult {
    sums: [Sums; 2],
    iterations: u32,
    exploitability_pct: f64,
    pot_check: f64,
}

fn solve_one(
    m: &Matchup,
    board: &[solver_core::cards::Card],
    target: f64,
    max_iterations: u32,
) -> Result<SolveResult, String> {
    let cfg = spot(m, board)?;
    let pot_chips = cfg.tree.pot as f64;
    let mut g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT)?;
    let mut ex = g.exploitability();
    while g.iterations() < max_iterations && ex.pct_pot > target {
        for _ in 0..25 {
            g.iterate();
        }
        ex = g.exploitability();
    }
    let ev = g.expected_values();
    let mut sums: [Sums; 2] = std::array::from_fn(|_| Sums {
        share: vec![0.0; NUM_CLASSES],
        equity: vec![0.0; NUM_CLASSES],
        chart_share: 0.0,
        chart_equity: 0.0,
    });
    for (p, sum) in sums.iter_mut().enumerate() {
        let values = g.hand_values(p);
        let meets = g.opponent_weights(p);
        let opp_total: f64 = g.initial_weights(1 - p).iter().map(|&w| w as f64).sum();
        let chart = if p == 0 {
            &m.oop.weights
        } else {
            &m.ip.weights
        };
        let eq = exact_range_vs_range(&cfg.ranges[p], &cfg.ranges[1 - p], board, CardSet::EMPTY)
            .map_err(|e| e.to_string())?;
        let mut eq_by_combo = std::collections::HashMap::new();
        for c in &eq.per_combo {
            eq_by_combo.insert(c.combo, c.equity);
        }
        for (h, combo) in g.hands(p).iter().enumerate() {
            let (Some(&e), v) = (eq_by_combo.get(combo), values[h]) else {
                continue;
            };
            if !v.is_finite() {
                continue;
            }
            let class = HandClass::of(*combo).index();
            let w = meets[h] / opp_total;
            sum.share[class] += w * v / pot_chips;
            sum.equity[class] += w * e;
            sum.chart_share += chart[class] * w * v / pot_chips;
            sum.chart_equity += chart[class] * w * e;
        }
    }
    // With no rake the two players' EVs add up to the pot.
    let pot_check = (ev[0] + ev[1] - pot_chips).abs() / pot_chips;
    Ok(SolveResult {
        sums,
        iterations: g.iterations(),
        exploitability_pct: ex.pct_pot,
        pot_check,
    })
}

pub fn run(
    charts_path: &str,
    flops: usize,
    target: f64,
    max_iterations: u32,
    memory_gb: f64,
    seed: u64,
    out: &str,
) -> Result<(), String> {
    let started = Instant::now();
    let text = std::fs::read_to_string(charts_path).map_err(|e| format!("{charts_path}: {e}"))?;
    let doc: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let matchups = matchups(&doc)?;
    let boards = flop_sample(flops, seed);
    let jobs: Vec<(usize, usize)> = (0..matchups.len())
        .flat_map(|m| (0..boards.len()).map(move |b| (m, b)))
        .collect();

    // Run as many solves at once as fit in the memory allowance.
    let mut worst = 0usize;
    for &(m, b) in &jobs {
        worst = worst.max(estimate_memory(&spot(&matchups[m], &boards[b])?)?);
    }
    let threads = ((memory_gb * 1e9 / worst as f64).floor() as usize).clamp(
        1,
        std::thread::available_parallelism().map_or(4, |n| n.get()),
    );
    eprintln!(
        "calibrate-eqr: {} solves, largest needs {:.0} MB; running {threads} at a time",
        jobs.len(),
        worst as f64 / 1e6
    );
    let pool = rayon::ThreadPoolBuilder::new()
        .num_threads(threads)
        .build()
        .map_err(|e| e.to_string())?;
    let done = std::sync::atomic::AtomicUsize::new(0);
    let results: Vec<Result<SolveResult, String>> = pool.install(|| {
        jobs.par_iter()
            .map(|&(m, b)| {
                let r = solve_one(&matchups[m], &boards[b], target, max_iterations);
                let n = done.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                if let Ok(r) = &r {
                    eprintln!(
                        "calibrate-eqr: {n}/{} {} on {}: {} iterations, exploitability {:.2}% of pot ({:.0}s)",
                        jobs.len(),
                        matchups[m].name,
                        boards[b].iter().map(|c| c.to_string()).collect::<String>(),
                        r.iterations,
                        r.exploitability_pct,
                        started.elapsed().as_secs_f64()
                    );
                }
                r
            })
            .collect()
    });

    // Collect each role's per-flop sums in a fixed order (deterministic).
    let mut per_flop: [[[Vec<Sums>; 2]; 2]; 2] = Default::default();
    let mut solves = Vec::new();
    let mut worst_pot_check: f64 = 0.0;
    for (&(m, b), r) in jobs.iter().zip(results) {
        let r = r?;
        let mu = &matchups[m];
        let [oop_sums, ip_sums] = r.sums;
        for (p, (side, sums)) in [(&mu.oop, oop_sums), (&mu.ip, ip_sums)]
            .into_iter()
            .enumerate()
        {
            per_flop[mu.pot_type][p][usize::from(side.aggressor)].push(sums);
        }
        worst_pot_check = worst_pot_check.max(r.pot_check);
        solves.push(json!({
            "matchup": mu.name,
            "flop": boards[b].iter().map(|c| c.to_string()).collect::<Vec<_>>().join(" "),
            "iterations": r.iterations, "exploitabilityPctPot": r.exploitability_pct,
        }));
    }

    // Factors per class with jackknife standard errors over flops; classes with no data fall
    // back to the role average.
    let mut factors: ClassFactors = [[[[1.0; NUM_CLASSES]; 2]; 2]; 2];
    let mut roles = Vec::new();
    let round = |x: f64| (x * 1e4).round() / 1e4;
    for pot in 0..2 {
        for ip in 0..2 {
            for aggr in 0..2 {
                let flops_data = &per_flop[pot][ip][aggr];
                if flops_data.is_empty() {
                    return Err(format!(
                        "no data for role pot {pot} ip {ip} aggressor {aggr}"
                    ));
                }
                let mean = jackknife(flops_data, |s| (s.chart_share, s.chart_equity));
                let mut fallback = Vec::new();
                let mut errors = Vec::with_capacity(NUM_CLASSES);
                for (c, factor) in factors[pot][ip][aggr].iter_mut().enumerate() {
                    let (f, se) = jackknife(flops_data, |s| (s.share[c], s.equity[c]));
                    if f.is_finite() {
                        *factor = f;
                        errors.push(round(se));
                    } else {
                        fallback.push(HandClass::from_index(c).to_string());
                        *factor = mean.0;
                        errors.push(round(mean.1));
                    }
                }
                let pot_name = ["single-raised", "3-bet"][pot];
                roles.push(json!({
                    "potType": pot_name, "inPosition": ip == 1, "aggressor": aggr == 1,
                    "meanFactor": round(mean.0),
                    "meanFactorStdError": round(mean.1),
                    "factors": factors[pot][ip][aggr].iter().map(|&x| round(x)).collect::<Vec<_>>(),
                    "stdErrors": errors,
                    "fallbackClasses": fallback,
                }));
            }
        }
    }
    let solver =
        json!({ "algorithm": "dcfr", "targetPctPot": target, "maxIterations": max_iterations });
    let mut prov = provenance(
        Source::SolverApprox,
        &format!("solver-cli calibrate-eqr --charts {charts_path} --flops {flops} --seed {seed}"),
        solver,
        "Equity-realization factors measured from postflop solves (one bet size per street, no \
         raises) of ranges taken from the input chart file, on a seeded sample of flops. \
         Approximate: the calibration tree is simplified, the flop sample is finite, and the input \
         ranges come from an approximate model.",
    );
    prov["seed"] = json!(seed);
    let doc_out = json!({
        "provenance": prov,
        "input": { "charts": charts_path, "chartsCommit": doc["provenance"]["gitCommit"], "chartsModel": doc["provenance"]["model"]["name"] },
        "classes": HandClass::all().map(|c| c.to_string()).collect::<Vec<_>>(),
        "index": "[potType][inPosition][aggressor][class]",
        "probeWeight": PROBE,
        "tree": { "flop": "33% pot", "turn": "66% pot", "river": "75% pot", "raises": "none", "allInThreshold": 0.67 },
        "matchups": matchups.iter().map(|m| json!({ "name": m.name, "potBb": m.pot, "stackBb": m.stack,
            "oop": { "seat": m.oop.seat, "aggressor": m.oop.aggressor, "range": m.oop.range.to_string() },
            "ip": { "seat": m.ip.seat, "aggressor": m.ip.aggressor, "range": m.ip.range.to_string() } })).collect::<Vec<_>>(),
        "flops": boards.iter().map(|f| f.iter().map(|c| c.to_string()).collect::<Vec<_>>().join(" ")).collect::<Vec<_>>(),
        "checks": { "worstPotConservation": worst_pot_check },
        "roles": roles,
        "solves": solves,
    });
    if let Some(dir) = std::path::Path::new(out).parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string_pretty(&doc_out).map_err(|e| e.to_string())?;
    std::fs::write(out, format!("{text}\n")).map_err(|e| format!("writing {out}: {e}"))?;
    eprintln!(
        "calibrate-eqr: wrote {out} in {:.0}s",
        started.elapsed().as_secs_f64()
    );
    Ok(())
}

/// Ratio Σ numerator ÷ Σ denominator over flops, and its jackknife (leave one flop out)
/// standard error. NaN if the denominator is zero.
fn jackknife(flops: &[Sums], part: impl Fn(&Sums) -> (f64, f64)) -> (f64, f64) {
    let parts: Vec<(f64, f64)> = flops.iter().map(part).collect();
    let (n, d) = parts
        .iter()
        .fold((0.0, 0.0), |(a, b), &(x, y)| (a + x, b + y));
    if d <= 1e-12 {
        return (f64::NAN, f64::NAN);
    }
    let k = parts.len() as f64;
    if parts.len() < 2 {
        return (n / d, f64::NAN);
    }
    let loo: Vec<f64> = parts
        .iter()
        .map(|&(x, y)| {
            if d - y > 1e-12 {
                (n - x) / (d - y)
            } else {
                n / d
            }
        })
        .collect();
    let avg = loo.iter().sum::<f64>() / k;
    let var = (k - 1.0) / k * loo.iter().map(|t| (t - avg).powi(2)).sum::<f64>();
    (n / d, var.sqrt())
}

/// Read the factors from a calibration file.
pub fn load_factors(path: &str) -> Result<(ClassFactors, Value), String> {
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let mut f: ClassFactors = [[[[1.0; NUM_CLASSES]; 2]; 2]; 2];
    for role in v["roles"].as_array().ok_or("no roles")? {
        let pot = usize::from(role["potType"] == "3-bet");
        let ip = usize::from(role["inPosition"] == true);
        let aggr = usize::from(role["aggressor"] == true);
        let vals = role["factors"].as_array().ok_or("no factors")?;
        if vals.len() != NUM_CLASSES {
            return Err("factors must have 169 entries".into());
        }
        for (c, x) in vals.iter().enumerate() {
            f[pot][ip][aggr][c] = x.as_f64().ok_or("bad factor")?;
        }
    }
    Ok((f, v))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flop(share: f64, equity: f64) -> Sums {
        Sums {
            share: vec![],
            equity: vec![],
            chart_share: share,
            chart_equity: equity,
        }
    }

    #[test]
    fn jackknife_ratio_and_error() {
        let part = |s: &Sums| (s.chart_share, s.chart_equity);
        // Every flop has the same ratio: no error.
        let (f, se) = jackknife(&[flop(1.0, 2.0), flop(2.0, 4.0), flop(0.5, 1.0)], part);
        assert!((f - 0.5).abs() < 1e-12 && se < 1e-12);
        // Ratios 0.5 and 1.0 with equal weight: ratio of sums 0.75, leave-one-out values 1.0
        // and 0.5, so the jackknife error is sqrt(1/2 · 2 · 0.25²) = 0.25.
        let (f, se) = jackknife(&[flop(1.0, 2.0), flop(2.0, 2.0)], part);
        assert!((f - 0.75).abs() < 1e-12 && (se - 0.25).abs() < 1e-12, "{f} {se}");
        // No equity anywhere: no factor.
        assert!(jackknife(&[flop(0.0, 0.0)], part).0.is_nan());
    }
}
