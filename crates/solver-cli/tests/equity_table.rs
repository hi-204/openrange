//! Checks on the committed, generated preflop equity table (data/equity/preflop-169.json).
//! Regenerate with `cargo run --release -p solver-cli -- gen-equity`.

use serde_json::Value;
use solver_core::hands::{HandClass, NUM_CLASSES};

fn table() -> Value {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../data/equity/preflop-169.json"
    );
    serde_json::from_str(&std::fs::read_to_string(path).expect("table file exists"))
        .expect("valid JSON")
}

fn cell(v: &Value, key: &str, a: usize, b: usize) -> f64 {
    v[key][a][b].as_f64().expect("number")
}

#[test]
fn provenance_and_layout() {
    let t = table();
    assert_eq!(t["provenance"]["source"], "solver_exact");
    assert_eq!(t["provenance"]["schema"], "openrange.provenance/1");
    let names: Vec<String> = HandClass::all().map(|c| c.to_string()).collect();
    let file_names: Vec<&str> = t["classes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|x| x.as_str().unwrap())
        .collect();
    assert_eq!(file_names, names);
}

#[test]
fn mirrored_matchups_sum_to_one() {
    let t = table();
    for a in 0..NUM_CLASSES {
        for b in 0..NUM_CLASSES {
            // Each value is rounded to 1e-6, so the sum can be off by at most 1e-6.
            let s = cell(&t, "equity", a, b) + cell(&t, "equity", b, a);
            assert!((s - 1.0).abs() <= 1.0e-6 + 1e-12, "{a} {b}: {s}");
            assert_eq!(t["pairs"][a][b], t["pairs"][b][a]);
        }
    }
}

#[test]
fn every_combo_meets_all_1225_non_overlapping_combos() {
    // A combo blocks 2 cards; C(50, 2) = 1225 combos remain.
    let t = table();
    for a in HandClass::all() {
        let total: u64 = (0..NUM_CLASSES)
            .map(|b| t["pairs"][a.index()][b].as_u64().unwrap())
            .sum();
        assert_eq!(total, a.num_combos() as u64 * 1225, "{a}");
    }
}

#[test]
fn aces_vs_random_matches_the_sanity_figure() {
    // Project spec sanity check: AA vs a random hand ≈ 85.2%.
    let t = table();
    let aa = t["checks"]["aaVsRandom"].as_f64().unwrap();
    assert!((aa - 0.852).abs() < 0.0005, "{aa}");
}
