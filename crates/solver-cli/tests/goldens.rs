//! Regression goldens: every stored river spot must re-solve to the stored fingerprint, bit
//! for bit. If a solver change is intentional, regenerate with
//! `cargo run --release -p solver-cli -- gen-goldens` and explain the change in the commit.

use serde_json::Value;
use solver_core::cfr::Algorithm;
use solver_core::postflop::PostflopGame;
use solver_core::postflop::json::spot_from_json;

#[test]
fn goldens_reproduce_exactly() {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/goldens/river.json");
    let doc: Value =
        serde_json::from_str(&std::fs::read_to_string(path).expect("goldens file")).expect("JSON");
    let spots = doc["spots"].as_array().expect("spots");
    assert!(!spots.is_empty());
    for g in spots {
        let name = g["name"].as_str().unwrap();
        let cfg = spot_from_json(&g["spot"]).unwrap();
        let mut game = PostflopGame::new(cfg, Algorithm::DCFR_DEFAULT).unwrap();
        for _ in 0..g["iterations"].as_u64().unwrap() {
            game.iterate();
        }
        assert_eq!(
            format!("{:016x}", game.fingerprint()),
            g["fingerprint"].as_str().unwrap(),
            "{name}"
        );
        let ev = game.expected_values();
        let want = g["evBb"].as_array().unwrap();
        for p in 0..2 {
            assert!(
                (ev[p] / 100.0 - want[p].as_f64().unwrap()).abs() < 1e-9,
                "{name} EV"
            );
        }
    }
}
