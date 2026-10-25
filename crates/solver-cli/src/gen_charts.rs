//! `solver-cli gen-charts <family>`: preflop chart files with provenance (data/charts/).
//!
//! Families:
//! - `pushfold-hu`: exact heads-up push/fold Nash (chip EV), small blind shove and big
//!   blind call, for a range of stack depths. `solver_exact`.
//! - `pushfold-multi`: 3–6-handed push/fold by sampled CFR. `solver_approx`.
//! - `cash`: 100 bb (and shallower) 6-max cash preflop from the equity-realization model.
//!   `solver_approx`.
//!
//! Every chart lists its actions, per-class frequencies (169 classes in grid order) and,
//! where available, per-class EV of each action in big blinds.

use crate::provenance::{Source, provenance};
use serde_json::{Value, json};
use solver_core::cards::COMBOS;
use solver_core::hands::{HandClass, NUM_CLASSES};
use solver_core::preflop::mccfr::{Engine, EqrModel, Evaluation};
use solver_core::preflop::pairs::{PairEquity, pair_equity_from_json};
use solver_core::preflop::pushfold::{PushFoldSpot, hu_spot, solve};
use solver_core::preflop::tree::{
    CashConfig, PAction, PNode, PreflopTree, cash, push_fold, seat_name,
};
use std::time::Instant;

pub const PAIRS_PATH: &str = "data/equity/preflop-pairs.json";

/// Load the committed combo-pair equities, checking that their numbering matches this build.
pub fn load_pairs(path: &str) -> Result<PairEquity, String> {
    let text = std::fs::read_to_string(path)
        .map_err(|e| format!("{path}: {e} (run `solver-cli gen-equity`)"))?;
    let v: Value = serde_json::from_str(&text).map_err(|e| format!("{path}: {e}"))?;
    pair_equity_from_json(&v)
}

/// Average a per-combo quantity over the combos of each class.
fn per_class(per_combo: &[f64]) -> Vec<f64> {
    HandClass::all()
        .map(|c| {
            let combos = c.combos();
            combos.iter().map(|x| per_combo[x.index()]).sum::<f64>() / combos.len() as f64
        })
        .collect()
}

fn r4(x: f64) -> f64 {
    (x * 1e4).round() / 1e4
}

pub fn pushfold_hu(out: &str, stacks: &[f64]) -> Result<(), String> {
    let eq = load_pairs(PAIRS_PATH)?;
    let started = Instant::now();
    let prov_solver = json!({ "algorithm": "dcfr", "alpha": 1.5, "beta": 0, "gamma": 2, "target": "exploitability ≤ 1e-6 bb" });
    let prov = provenance(
        Source::SolverExact,
        "solver-cli gen-charts pushfold-hu",
        prov_solver,
        "Heads-up push/fold, chip EV, blinds 0.5/1, no ante. Small blind shoves or folds; big blind \
         calls or folds. Solved over all 1326 combos per player with exact card removal and exact \
         all-in equities; frequencies and EVs are averaged over the combos of each class.",
    );
    let mut charts = Vec::new();
    for &stack in stacks {
        let game = hu_spot(&PushFoldSpot::heads_up(stack), &eq)?;
        let (solver, report) = solve(game, 1e-6, 20_000, 50);
        let (x, y) = (solver.average(0), solver.average(1));
        let v = solver.values(&x, &y);
        // Per-combo EVs: counterfactual values divided by the compatible opponent weight.
        let shove_ev: Vec<f64> = (0..COMBOS.len())
            .map(|i| v.shove[i] / v.pusher_mass[i])
            .collect();
        let fold_ev: Vec<f64> = (0..COMBOS.len())
            .map(|i| v.fold[i] / v.pusher_mass[i])
            .collect();
        let call_ev: Vec<f64> = (0..COMBOS.len())
            .map(|j| {
                if v.caller_mass[j] > 0.0 {
                    v.call[j] / v.caller_mass[j]
                } else {
                    f64::NAN
                }
            })
            .collect();
        let pass_ev: Vec<f64> = (0..COMBOS.len())
            .map(|j| {
                if v.caller_mass[j] > 0.0 {
                    v.pass[j] / v.caller_mass[j]
                } else {
                    f64::NAN
                }
            })
            .collect();
        let (xs, ys) = (per_class(&x), per_class(&y));
        let (se, fe, ce, pe) = (
            per_class(&shove_ev),
            per_class(&fold_ev),
            per_class(&call_ev),
            per_class(&pass_ev),
        );
        eprintln!(
            "gen-charts pushfold-hu: {stack} bb: {} iterations, exploitability {:.2e} bb",
            solver.iterations(),
            report.exploitability
        );
        let chart = |id: &str,
                     title: String,
                     seat: &str,
                     actions: [&str; 2],
                     freq: &[f64],
                     ev_a: &[f64],
                     ev_b: &[f64]| {
            json!({
                "id": id, "title": title, "seat": seat, "stack": stack,
                "actions": actions,
                // [fold-type action, aggressive action] per class
                "strategy": (0..NUM_CLASSES).map(|c| [r4(1.0 - freq[c]), r4(freq[c])]).collect::<Vec<_>>(),
                "ev": (0..NUM_CLASSES).map(|c| [r4(ev_b[c]), r4(ev_a[c])]).collect::<Vec<_>>(),
                "solve": { "iterations": solver.iterations(), "exploitabilityBb": report.exploitability, "valueBb": report.value },
            })
        };
        charts.push(chart(
            &format!("sb-shove-{stack}"),
            format!("SB shove or fold, {stack} bb"),
            "SB",
            ["Fold", "All-in"],
            &xs,
            &se,
            &fe,
        ));
        charts.push(chart(
            &format!("bb-call-{stack}"),
            format!("BB call or fold vs SB shove, {stack} bb"),
            "BB",
            ["Fold", "Call"],
            &ys,
            &ce,
            &pe,
        ));
    }
    let doc = json!({
        "provenance": prov,
        "family": "pushfold-hu",
        "classes": HandClass::all().map(|c| c.to_string()).collect::<Vec<_>>(),
        "evUnit": "bb, relative to the start of the hand (blinds posted count as invested)",
        "charts": charts,
    });
    write(out, &doc)?;
    eprintln!(
        "gen-charts pushfold-hu: wrote {out} in {:.0}s",
        started.elapsed().as_secs_f64()
    );
    Ok(())
}

fn write(out: &str, doc: &Value) -> Result<(), String> {
    if let Some(dir) = std::path::Path::new(out).parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let text = serde_json::to_string(doc).map_err(|e| e.to_string())?;
    std::fs::write(out, format!("{text}\n")).map_err(|e| format!("writing {out}: {e}"))
}

// ---- sampled families (appended to gen_charts.rs) ------------------------------------------

/// A decision in a preflop tree, classified by the line that leads to it.
#[derive(Clone, Debug)]
pub struct Spot {
    pub node: usize,
    pub id: String,
    pub title: String,
    pub scenario: &'static str,
    pub seat: usize,
}

/// Walk the tree and name the decisions charts are made for: first-in (open or shove),
/// facing an open/shove with nobody else in, squeeze (open + one caller), facing a 3-bet,
/// a 4-bet and a 5-bet. Other decisions (overcalls, folds forced by tree rules) are solved
/// but not published as charts.
pub fn chart_spots(tree: &PreflopTree) -> Vec<Spot> {
    let mut out = Vec::new();
    let mut history: Vec<(usize, PAction)> = Vec::new();
    walk_spots(tree, 0, &mut history, &mut out);
    out
}

fn walk_spots(
    tree: &PreflopTree,
    node: usize,
    history: &mut Vec<(usize, PAction)>,
    out: &mut Vec<Spot>,
) {
    let PNode::Action {
        player,
        actions,
        children,
    } = &tree.nodes[node]
    else {
        return;
    };
    let n = tree.players;
    let name = |s: usize| seat_name(n, s);
    let moves: Vec<(usize, PAction)> = history
        .iter()
        .filter(|(_, a)| *a != PAction::Fold)
        .cloned()
        .collect();
    let raises: Vec<usize> = moves
        .iter()
        .filter(|(_, a)| a.is_aggressive())
        .map(|(s, _)| *s)
        .collect();
    let calls = moves.iter().filter(|(_, a)| *a == PAction::Call).count();
    let p = *player;
    let spot = match (raises.as_slice(), calls) {
        ([], 0) => Some((
            "first-in",
            format!("first-in-{}", name(p)),
            format!("{} first in", name(p)),
        )),
        ([o], 0) => Some((
            "vs-open",
            format!("vs-open-{}-vs-{}", name(p), name(*o)),
            format!("{} vs {} open", name(p), name(*o)),
        )),
        ([o], 1) if actions.len() == 3 => {
            let c = moves
                .iter()
                .find(|(_, a)| *a == PAction::Call)
                .expect("caller")
                .0;
            Some((
                "squeeze",
                format!("squeeze-{}-vs-{}-{}", name(p), name(*o), name(c)),
                format!("{} vs {} open and {} call", name(p), name(*o), name(c)),
            ))
        }
        ([o, r], 0) if p == *o => Some((
            "vs-3bet",
            format!("vs-3bet-{}-vs-{}", name(p), name(*r)),
            format!("{} opened, faces {} 3-bet", name(p), name(*r)),
        )),
        ([o, r, o2], 0) if p == *r && o == o2 => Some((
            "vs-4bet",
            format!("vs-4bet-{}-vs-{}", name(p), name(*o)),
            format!("{} 3-bet, faces {} 4-bet", name(p), name(*o)),
        )),
        ([o, r, o2, r2], 0) if p == *o && o == o2 && r == r2 => Some((
            "vs-5bet",
            format!("vs-5bet-{}-vs-{}", name(p), name(*r)),
            format!("{} 4-bet, faces {} all-in", name(p), name(*r)),
        )),
        _ => None,
    };
    if let Some((scenario, id, title)) = spot {
        out.push(Spot {
            node,
            id,
            title,
            scenario,
            seat: p,
        });
    }
    for (a, &c) in actions.iter().zip(children) {
        history.push((p, *a));
        walk_spots(tree, c, history, out);
        history.pop();
    }
}

/// Chart JSON for one decision: average strategy and sampled EVs per class.
fn sampled_chart(engine: &Engine, ev: &Evaluation, spot: &Spot) -> Value {
    let PNode::Action { actions, .. } = &engine.tree.nodes[spot.node] else {
        unreachable!()
    };
    let k = actions.len();
    let values = engine.action_values(ev, spot.node).expect("action node");
    let mut sigma = vec![0.0; k];
    let strategy: Vec<Vec<f64>> = (0..NUM_CLASSES)
        .map(|c| {
            engine.strategy(spot.node, c, true, &mut sigma);
            sigma.iter().map(|&x| r4(x)).collect()
        })
        .collect();
    let evs: Vec<Vec<Value>> = values
        .iter()
        .map(|row| {
            row.iter()
                .map(|&(m, _)| {
                    if m.is_finite() {
                        json!(r4(m))
                    } else {
                        Value::Null
                    }
                })
                .collect()
        })
        .collect();
    let ses: Vec<Vec<Value>> = values
        .iter()
        .map(|row| {
            row.iter()
                .map(|&(_, s)| {
                    if s.is_finite() {
                        json!(r4(s))
                    } else {
                        Value::Null
                    }
                })
                .collect()
        })
        .collect();
    json!({
        "id": spot.id, "title": spot.title, "scenario": spot.scenario,
        "seat": seat_name(engine.tree.players, spot.seat),
        "line": engine.tree.lines[spot.node],
        "actions": actions.iter().map(|a| a.to_string()).collect::<Vec<_>>(),
        "strategy": strategy, "ev": evs, "evStdError": ses,
        // Probability the player arrives here with each class by their own earlier choices;
        // the strategy for classes with ~0 reach is not meaningful.
        "reach": engine.own_reach(spot.node).iter().map(|&r| r4(r)).collect::<Vec<_>>(),
    })
}

/// Share of all 1326 combos that take an aggressive action at a node.
pub fn aggressive_share(engine: &Engine, node: usize) -> f64 {
    let PNode::Action { actions, .. } = &engine.tree.nodes[node] else {
        return f64::NAN;
    };
    let mut sigma = vec![0.0; actions.len()];
    let mut total = 0.0;
    for c in HandClass::all() {
        engine.strategy(node, c.index(), true, &mut sigma);
        let aggr: f64 = actions
            .iter()
            .zip(&sigma)
            .filter(|(a, _)| a.is_aggressive())
            .map(|(_, s)| s)
            .sum();
        total += aggr * c.num_combos() as f64;
    }
    total / 1326.0
}

pub fn pushfold_multi(
    out: &str,
    players: usize,
    stacks: &[f64],
    iterations: u64,
    eval_samples: u64,
    seed: u64,
) -> Result<(), String> {
    let started = Instant::now();
    let prov = provenance(
        Source::SolverApprox,
        &format!("solver-cli gen-charts pushfold-multi --players {players}"),
        json!({ "algorithm": "external-sampling MCCFR, linear averaging", "iterations": iterations, "evaluationSamples": eval_samples }),
        "Push/fold with equal stacks, chip EV, blinds 0.5/1, no ante. Strategies per hand class. \
         Approximate: sampled CFR (sampling error) and, with 3+ players, CFR has no equilibrium \
         guarantee; bestResponseGainBb estimates how much each seat could gain by changing single \
         decisions (sampled, biased upwards).",
    );
    let eq = load_pairs(PAIRS_PATH)?;
    let mut charts = Vec::new();
    let mut solves = Vec::new();
    for (k, &stack) in stacks.iter().enumerate() {
        let tree = push_fold(players, stack, 0.0)?;
        let mut engine = Engine::new(&tree, Some(&eq), None, seed + k as u64)?;
        engine.iterate(iterations);
        let ev = engine.evaluate(eval_samples, seed + 1000 + k as u64);
        eprintln!(
            "gen-charts pushfold-multi: {players} players, {stack} bb: best-response gains {:?} bb",
            ev.best_response_gain
                .iter()
                .map(|g| r4(*g))
                .collect::<Vec<_>>()
        );
        for spot in chart_spots(&tree) {
            let mut c = sampled_chart(&engine, &ev, &spot);
            c["stack"] = json!(stack);
            c["id"] = json!(format!("{}-{stack}", spot.id));
            charts.push(c);
        }
        solves.push(json!({ "stack": stack, "bestResponseGainBb": ev.best_response_gain.iter().map(|g| r4(*g)).collect::<Vec<_>>() }));
    }
    let doc = json!({
        "provenance": prov, "family": format!("pushfold-{players}max"), "players": players,
        "classes": HandClass::all().map(|c| c.to_string()).collect::<Vec<_>>(),
        "evUnit": "bb, relative to the start of the hand; sampled (see evStdError)",
        "solves": solves, "charts": charts,
    });
    write(out, &doc)?;
    eprintln!(
        "gen-charts pushfold-multi: wrote {out} in {:.0}s",
        started.elapsed().as_secs_f64()
    );
    Ok(())
}

/// 100 bb sanity bands for 6-max raise-first-in frequency (project spec; checks only).
pub const RFI_BANDS: [(&str, f64, f64); 4] = [
    ("UTG", 0.14, 0.18),
    ("HJ", 0.18, 0.22),
    ("CO", 0.24, 0.29),
    ("BTN", 0.40, 0.50),
];

pub struct CashResult {
    pub rfi: Vec<(String, f64)>,
    pub best_response_gain: Vec<f64>,
}

pub fn cash_solve(
    stack: f64,
    eqr: EqrModel,
    eq: &PairEquity,
    iterations: u64,
    eval_samples: u64,
    seed: u64,
) -> Result<(PreflopTree, Vec<f64>, Value, CashResult), String> {
    let tree = cash(&CashConfig::six_max(stack));
    let mut engine = Engine::new(&tree, Some(eq), Some(eqr), seed)?;
    engine.iterate(iterations);
    let ev = engine.evaluate(eval_samples, seed + 1);
    let spots = chart_spots(&tree);
    let rfi: Vec<(String, f64)> = spots
        .iter()
        .filter(|s| s.scenario == "first-in")
        .map(|s| {
            (
                seat_name(6, s.seat).to_string(),
                aggressive_share(&engine, s.node),
            )
        })
        .collect();
    let charts: Vec<Value> = spots
        .iter()
        .map(|s| sampled_chart(&engine, &ev, s))
        .collect();
    let gains = ev.best_response_gain.clone();
    Ok((
        tree,
        gains.clone(),
        json!(charts),
        CashResult {
            rfi,
            best_response_gain: gains,
        },
    ))
}

pub fn cash_family(
    out_dir: &str,
    stacks: &[f64],
    iterations: u64,
    eval_samples: u64,
    seed: u64,
    eqr_file: Option<&str>,
) -> Result<(), String> {
    let eq = load_pairs(PAIRS_PATH)?;
    // EQR v2 (factors measured from postflop solves, read from a file) or v1 (authored).
    let (eqr, model_info) = match eqr_file {
        Some(path) => {
            let (factors, doc) = crate::calibrate_eqr::load_factors(path)?;
            let info = json!({
                "name": "eqr-v2",
                "source": "measured from OpenRange postflop solves (solver-cli calibrate-eqr)",
                "file": path,
                "fileCommit": doc["provenance"]["gitCommit"],
                "fileDirty": doc["provenance"]["gitDirty"],
                "flops": doc["flops"].as_array().map(|a| a.len()),
                "inputCharts": doc["input"],
                "extrapolations": "4-bet+ pots use the 3-bet factors; multiway flops use single-raised factors with 'in position' = last to act",
            });
            (EqrModel::with_class_factors(factors), info)
        }
        None => {
            let m = EqrModel::v1();
            let info = json!({
                "name": "eqr-v1",
                "source": "authored",
                "headsUp": { "potTypes": ["single-raised", "3-bet", "4-bet+"], "index": "[potType][inPosition][aggressor]", "values": m.heads_up },
                "multiLast": m.multi_last,
                "multiOther": m.multi_other,
                "multiAggressorBonus": m.multi_aggressor,
            });
            (m, info)
        }
    };
    // Provenance describes the code as it is when the run starts (a long run must not pick up
    // edits made while it was solving).
    let provs: Vec<Value> = stacks
        .iter()
        .map(|&stack| {
            let prov = provenance(
                Source::SolverApprox,
                &format!(
                    "solver-cli gen-charts cash --stack {stack}{}",
                    eqr_file.map(|f| format!(" --eqr {f}")).unwrap_or_default()
                ),
                json!({ "algorithm": "external-sampling MCCFR, linear averaging", "iterations": iterations, "evaluationSamples": eval_samples }),
                "6-max cash preflop, rake-free, blinds 0.5/1. Postflop play is not solved: when a hand \
                 reaches the flop each player's pot share is all-in equity × an equity-realization factor \
                 (see `model`: eqr-v1 authored, or eqr-v2 measured from postflop solves). Multiway pots also approximate equity from \
                 heads-up matchups. Tree simplifications are listed in `tree`. CFR with six players has no \
                 equilibrium guarantee; bestResponseGainBb estimates the gain from changing single decisions.",
            );
            let mut prov = prov;
            prov["model"] = model_info.clone();
            prov
        })
        .collect();
    let config = CashConfig::six_max(100.0);
    for (k, &stack) in stacks.iter().enumerate() {
        let started = Instant::now();
        let (_, _, charts, result) = cash_solve(
            stack,
            eqr.clone(),
            &eq,
            iterations,
            eval_samples,
            seed + k as u64,
        )?;
        // Sensitivity: how first-in frequencies move if out-of-position realization is ±10%.
        let mut sensitivity = Vec::new();
        for scale in [0.9, 1.1] {
            let (_, _, _, r) = cash_solve(
                stack,
                eqr.scaled_oop(scale),
                &eq,
                iterations / 2,
                eval_samples / 10,
                seed + 77 + k as u64,
            )?;
            sensitivity.push(json!({ "oopScale": scale, "firstIn": r.rfi.iter().map(|(s, f)| json!({ "seat": s, "share": r4(*f) })).collect::<Vec<_>>() }));
        }
        let bands: Vec<Value> = if (stack - 100.0).abs() < 1e-9 {
            RFI_BANDS
                .iter()
                .map(|(seat, lo, hi)| {
                    let f = result.rfi.iter().find(|(s, _)| s == seat).map(|r| r.1).unwrap_or(f64::NAN);
                    json!({ "seat": seat, "low": lo, "high": hi, "measured": r4(f), "inBand": f >= *lo && f <= *hi })
                })
                .collect()
        } else {
            Vec::new()
        };
        eprintln!(
            "gen-charts cash: {stack} bb: first-in {:?}; best-response gains {:?} ({:.0}s)",
            result
                .rfi
                .iter()
                .map(|(s, f)| format!("{s} {:.1}%", f * 100.0))
                .collect::<Vec<_>>(),
            result
                .best_response_gain
                .iter()
                .map(|g| r4(*g))
                .collect::<Vec<_>>(),
            started.elapsed().as_secs_f64()
        );
        let prov = provs[k].clone();
        let doc = json!({
            "provenance": prov, "family": "cash-6max", "stack": stack, "players": 6,
            "tree": {
                "open": config.open, "threeBetInPosition": config.three_bet_ip, "threeBetOutOfPosition": config.three_bet_oop,
                "squeezePerCaller": config.squeeze_per_caller, "fourBet": config.four_bet, "allInFraction": config.all_in_fraction,
                "maxColdCallers": config.max_cold_callers,
                "simplifications": ["no limping", "at most one cold call of an open (blinds may always call)",
                    "facing a 3-bet, players who have not put money in may only fold", "facing a 4-bet or 5-bet only the previous raiser continues"],
            },
            "classes": HandClass::all().map(|c| c.to_string()).collect::<Vec<_>>(),
            "evUnit": "bb, relative to the start of the hand; sampled (see evStdError); depends on the EQR model",
            "bestResponseGainBb": result.best_response_gain.iter().map(|g| r4(*g)).collect::<Vec<_>>(),
            "firstIn": result.rfi.iter().map(|(s, f)| json!({ "seat": s, "share": r4(*f) })).collect::<Vec<_>>(),
            "sanityBands": bands, "sensitivity": sensitivity,
            "charts": charts,
        });
        write(&format!("{out_dir}/cash-6max-{stack}bb.json"), &doc)?;
    }
    Ok(())
}
