//! Push/fold solvers against each other, on the committed exact equities.

use solver_core::hands::{HandClass, NUM_CLASSES};
use solver_core::preflop::mccfr::Engine;
use solver_core::preflop::pairs::{PairEquity, pair_equity_from_json};
use solver_core::preflop::pushfold::{PushFoldSpot, ShoveSolver, hu_spot, report_for, solve};
use solver_core::preflop::tree::{PNode, push_fold};

fn pairs() -> PairEquity {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../data/equity/preflop-pairs.json"
    );
    let v =
        serde_json::from_str(&std::fs::read_to_string(path).expect("pairs file")).expect("JSON");
    pair_equity_from_json(&v).expect("pairs")
}

/// Expand a per-class probability to every combo of that class.
fn per_combo(class_freq: &[f64]) -> Vec<f64> {
    let mut out = vec![0.0; 1326];
    for c in HandClass::all() {
        for combo in c.combos() {
            out[combo.index()] = class_freq[c.index()];
        }
    }
    out
}

/// Exploitability (bb) of the sampled-CFR heads-up strategy when judged by the exact solver.
pub fn sampled_strategy_exploitability(
    eq: &PairEquity,
    stack: f64,
    iterations: u64,
    seed: u64,
) -> f64 {
    let tree = push_fold(2, stack, 0.0).unwrap();
    let mut e = Engine::new(&tree, Some(eq), None, seed).unwrap();
    e.iterate(iterations);
    let PNode::Action { children, .. } = &tree.nodes[0] else {
        panic!()
    };
    let bb_node = children[1];
    let mut sigma = [0.0; 2];
    let mut class_freq = |node: usize| -> Vec<f64> {
        (0..NUM_CLASSES)
            .map(|c| {
                e.strategy(node, c, true, &mut sigma);
                sigma[1]
            })
            .collect()
    };
    let (x, y) = (per_combo(&class_freq(0)), per_combo(&class_freq(bb_node)));
    let exact = ShoveSolver::new(
        hu_spot(&PushFoldSpot::heads_up(stack), eq).unwrap(),
        solver_core::cfr::Algorithm::DCFR_DEFAULT,
    );
    report_for(&exact, &x, &y).exploitability
}

#[test]
fn exact_hu_push_fold_converges() {
    let eq = pairs();
    for stack in [3.0, 10.0, 20.0] {
        let (_, r) = solve(
            hu_spot(&PushFoldSpot::heads_up(stack), &eq).unwrap(),
            1e-6,
            20_000,
            50,
        );
        assert!(r.exploitability < 1e-6, "{stack}: {r:?}");
        // Chip EV is zero-sum heads-up: the two values add up to 0.
        assert!((r.value[0] + r.value[1]).abs() < 1e-9, "{r:?}");
    }
}

#[test]
fn sampled_cfr_is_nearly_unexploitable_when_judged_exactly() {
    let eq = pairs();
    let ex = sampled_strategy_exploitability(&eq, 10.0, 2_000_000, 11);
    eprintln!("sampled strategy, judged exactly: {ex:.2e} bb");
    // Measured 3.7e-4 bb (2M iterations, seed 11); tolerance ~8x (D-040).
    assert!(ex < 3e-3, "{ex}");
}

/// The sampled best-response estimate (cross-validated, own-reach weighted) must agree with
/// the exact per-player gain on heads-up push/fold, where each player decides once.
#[test]
fn sampled_best_response_gain_matches_the_exact_gain() {
    let eq = pairs();
    let stack = 10.0;
    let tree = push_fold(2, stack, 0.0).unwrap();
    // A poorly converged strategy, so the gains are large enough to compare.
    let mut e = Engine::new(&tree, Some(&eq), None, 3).unwrap();
    e.iterate(20_000);
    let sampled = e.evaluate(4_000_000, 17).best_response_gain;
    let PNode::Action { children, .. } = &tree.nodes[0] else {
        panic!()
    };
    let mut sigma = [0.0; 2];
    let mut freq = |node: usize| -> Vec<f64> {
        (0..NUM_CLASSES)
            .map(|c| {
                e.strategy(node, c, true, &mut sigma);
                sigma[1]
            })
            .collect()
    };
    let (x, y) = (per_combo(&freq(0)), per_combo(&freq(children[1])));
    let exact_game = ShoveSolver::new(
        hu_spot(&PushFoldSpot::heads_up(stack), &eq).unwrap(),
        solver_core::cfr::Algorithm::DCFR_DEFAULT,
    );
    let r = report_for(&exact_game, &x, &y);
    let exact = [
        r.best_response[0] - r.value[0],
        r.best_response[1] - r.value[1],
    ];
    eprintln!("sampled gains {sampled:?}, exact gains {exact:?}");
    for p in 0..2 {
        // Measured relative error 1.8% (seed 17); tolerance 10% (~5x, D-040).
        assert!(
            (sampled[p] - exact[p]).abs() <= 0.1 * exact[p],
            "player {p}: {} vs {}",
            sampled[p],
            exact[p]
        );
    }
}
