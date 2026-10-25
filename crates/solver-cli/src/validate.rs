//! `solver-cli validate`: runs the validation suite and writes docs/VALIDATION.md.
//!
//! Every row states what theory (or an independent method) predicts, what we measured, and
//! the tolerance. The report is generated; never edit it by hand.

use crate::goldens;
use crate::provenance::{git_commit_label, utc_now};
use solver_core::cards::{CardSet, Combo, parse_cards};
use solver_core::cfr::tabular::{
    Algorithm, Solver, Strategy, Tree, best_response_value, brute_force_best_response_value,
    expected_value, exploitability,
};
use solver_core::equity::{exact_range_vs_range, hand_vs_hand, monte_carlo};
use solver_core::eval::{Evaluator, count_seven_card_categories};
use solver_core::games::{kuhn::Kuhn, leduc::Leduc};
use solver_core::hands::{HandClass, NUM_CLASSES};
use solver_core::iso::{permute_card, permute_combo};
use solver_core::postflop::abstraction::fit_to_budget;
use solver_core::postflop::json::spot_from_json;
use solver_core::postflop::{Options, PostflopGame, SpotConfig, estimate_memory_with, reference};
use solver_core::preflop::icm::icm_equity;
use solver_core::preflop::mccfr::Engine;
use solver_core::preflop::pairs::{PairEquity, pair_equity_from_json};
use solver_core::preflop::pushfold::{
    Payoffs, PushFoldSpot, ShoveGame, ShoveSolver, hu_spot, report_for as shove_report_for,
    solve as solve_shove,
};
use solver_core::preflop::tree::{PNode, push_fold};
use solver_core::range::Range;
use solver_core::rng::Rng;
use std::fmt::Write as _;
use std::time::Instant;

struct Check {
    name: String,
    expected: String,
    measured: String,
    pass: bool,
    kind: Kind,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    /// Pass/fail correctness check.
    Check,
    /// A measured value with nothing to pass or fail.
    Report,
    /// Plausibility band for a model output (not a correctness check; D-047).
    Sanity,
}

struct Section {
    title: String,
    intro: String,
    checks: Vec<Check>,
    tables: String,
}

impl Section {
    fn new(title: &str, intro: &str) -> Section {
        Section {
            title: title.into(),
            intro: intro.into(),
            checks: Vec::new(),
            tables: String::new(),
        }
    }

    fn check(
        &mut self,
        name: &str,
        expected: impl Into<String>,
        measured: impl Into<String>,
        pass: bool,
    ) {
        let (expected, measured) = (expected.into(), measured.into());
        eprintln!(
            "  [{}] {name}: {measured}",
            if pass { "pass" } else { "FAIL" }
        );
        self.checks.push(Check {
            name: name.into(),
            expected,
            measured,
            pass,
            kind: Kind::Check,
        });
    }

    /// A plausibility band: shown and summarised separately from correctness checks.
    fn sanity(
        &mut self,
        name: &str,
        expected: impl Into<String>,
        measured: impl Into<String>,
        inside: bool,
    ) {
        let (expected, measured) = (expected.into(), measured.into());
        eprintln!(
            "  [{}] {name}: {measured}",
            if inside { "in band" } else { "OUT OF BAND" }
        );
        self.checks.push(Check {
            name: name.into(),
            expected,
            measured,
            pass: inside,
            kind: Kind::Sanity,
        });
    }

    /// A value worth showing that has no pass/fail criterion.
    fn report(&mut self, name: &str, measured: impl Into<String>) {
        let measured = measured.into();
        eprintln!("  [info] {name}: {measured}");
        self.checks.push(Check {
            name: name.into(),
            expected: "(reported, not checked)".into(),
            measured,
            pass: true,
            kind: Kind::Report,
        });
    }
}

fn evaluator_section(quick: bool) -> Section {
    let mut s = Section::new(
        "Hand evaluator",
        "Exact category counts over all C(52,7) = 133,784,560 seven-card hands, and the number \
         of distinct 5-card hand values. The evaluator is also cross-checked against an \
         independent best-of-21 reference evaluator in `cargo test`.",
    );
    let distinct = Evaluator::get().distinct_values();
    s.check(
        "distinct hand values",
        "7462",
        distinct.to_string(),
        distinct == 7462,
    );
    if quick {
        s.report("7-card enumeration", "skipped in --quick");
        return s;
    }
    let expected: [(&str, u64); 9] = [
        ("high card", 23_294_460),
        ("pair", 58_627_800),
        ("two pair", 31_433_400),
        ("three of a kind", 6_461_620),
        ("straight", 6_180_020),
        ("flush", 4_047_644),
        ("full house", 3_473_184),
        ("four of a kind", 224_848),
        ("straight flush (incl. royal)", 41_584),
    ];
    let counts = count_seven_card_categories();
    for (i, (name, want)) in expected.iter().enumerate() {
        s.check(
            name,
            want.to_string(),
            counts[i].to_string(),
            counts[i] == *want,
        );
    }
    let total: u64 = counts.iter().sum();
    s.check(
        "total",
        "133784560",
        total.to_string(),
        total == 133_784_560,
    );
    s
}

fn equity_section() -> Result<Section, String> {
    let mut s = Section::new(
        "Equity",
        "Exact enumeration against Monte Carlo, symmetry, and the generated preflop table \
         (`data/equity/preflop-169.json`).",
    );
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../data/equity/preflop-169.json"
    );
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    let table: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let aa = table["checks"]["aaVsRandom"].as_f64().unwrap_or(f64::NAN);
    s.check(
        "AA vs a random hand (table)",
        "≈ 85.2% (±0.05)",
        format!("{:.4}%", aa * 100.0),
        (aa - 0.852).abs() < 0.0005,
    );
    let mirror = table["checks"]["mirroredMaxError"]
        .as_f64()
        .unwrap_or(f64::NAN);
    s.check(
        "table: equity(A,B) + equity(B,A) = 1",
        "max error < 1e-12 (f64 rounding; measured 2.2e-15)",
        format!("{mirror:.1e}"),
        mirror < 1e-12,
    );

    let combo = |x: &str| Combo::parse(x).expect("combo");
    let mut worst: f64 = 0.0;
    for (a, b, board) in [
        ("AsKs", "QhQd", ""),
        ("7c2d", "8h8s", "Ts9s3d"),
        ("AhKd", "AcKh", "Qd7c2s"),
    ] {
        let board = parse_cards(board).expect("board");
        let ab =
            hand_vs_hand(combo(a), combo(b), &board, CardSet::EMPTY).map_err(|e| e.to_string())?;
        let ba =
            hand_vs_hand(combo(b), combo(a), &board, CardSet::EMPTY).map_err(|e| e.to_string())?;
        worst = worst.max((ab.equity() + ba.equity() - 1.0).abs());
    }
    s.check(
        "hand vs hand: mirrored sum = 1",
        "error < 1e-12",
        format!("{worst:.1e}"),
        worst < 1e-12,
    );

    let hero = Range::parse("88+, AJs+, KQs").expect("range");
    let villain = Range::parse("22+, A2s+, KTo+").expect("range");
    let board = parse_cards("Qs8d3c").expect("board");
    let exact =
        exact_range_vs_range(&hero, &villain, &board, CardSet::EMPTY).map_err(|e| e.to_string())?;
    let mc = monte_carlo(&[hero, villain], &board, CardSet::EMPTY, 400_000, 7)
        .map_err(|e| e.to_string())?;
    let z = (mc.equity[0] - exact.equity) / mc.std_error[0];
    s.check(
        "Monte Carlo vs exact (88+,AJs+,KQs vs 22+,A2s+,KTo+ on Qs8d3c)",
        "|z| < 4",
        format!(
            "exact {:.4}%, MC {:.4}% ± {:.4}, z = {z:.2}",
            exact.equity * 100.0,
            mc.equity[0] * 100.0,
            mc.std_error[0] * 100.0
        ),
        z.abs() < 4.0,
    );
    Ok(s)
}

type Rows = Vec<(u32, f64, f64)>;

fn solve(tree: &Tree, algo: Algorithm, checkpoints: &[u32]) -> (Rows, Strategy) {
    let mut solver = Solver::new(tree.clone(), algo);
    let mut rows = Vec::new();
    for &cp in checkpoints {
        while solver.iterations() < cp {
            solver.iterate();
        }
        let sigma = solver.average_strategy();
        rows.push((
            cp,
            exploitability(tree, &sigma),
            expected_value(tree, &sigma),
        ));
    }
    (rows, solver.average_strategy())
}

const ALGORITHMS: [Algorithm; 3] = [
    Algorithm::DCFR_DEFAULT,
    Algorithm::CFR_PLUS,
    Algorithm::Vanilla,
];

fn convergence_table(title: &str, results: &[(Algorithm, Rows)]) -> String {
    let mut t = format!(
        "\n**{title}** — exploitability (game units) / value for player 0\n\n| Iterations |"
    );
    for (a, _) in results {
        let _ = write!(t, " {} |", a.name());
    }
    t.push_str("\n|---|");
    t.push_str(&"---|".repeat(results.len()));
    t.push('\n');
    for i in 0..results[0].1.len() {
        let _ = write!(t, "| {} |", results[0].1[i].0);
        for (_, rows) in results {
            let _ = write!(t, " {:.2e} / {:.6} |", rows[i].1, rows[i].2);
        }
        t.push('\n');
    }
    t
}

fn kuhn_section() -> Section {
    let mut s = Section::new(
        "CFR on Kuhn poker",
        "Kuhn poker has a closed-form equilibrium family (Kuhn 1950): value −1/18 for the first \
         player, who bets a jack with some α ∈ [0, 1/3], a king with 3α, and never opens a \
         queen; the second player calls a bet with a queen 1/3 of the time. Exploitability must \
         go to 0.",
    );
    let tree = Tree::build(&Kuhn);
    let prob = |sigma: &Strategy, key: &str, action: &str| -> f64 {
        let is = tree
            .infosets
            .iter()
            .position(|i| i.key == key)
            .expect("infoset");
        let a = tree.infosets[is]
            .actions
            .iter()
            .position(|x| x == action)
            .expect("action");
        sigma[is][a]
    };
    let mut results = Vec::new();
    for algo in ALGORITHMS {
        let (rows, sigma) = solve(&tree, algo, &[10, 100, 1000, 10_000]);
        let (_, ex, value) = *rows.last().expect("rows");
        let n = algo.name();
        s.check(
            &format!("{n}: exploitability after 10,000 iterations"),
            "< 1e-3 (worst measured 1.1e-4, CFR)",
            format!("{ex:.2e}"),
            ex < 1e-3,
        );
        s.check(
            &format!("{n}: value for player 0"),
            "−1/18 = −0.0555556 (±5e-5; worst measured 8.0e-6)",
            format!("{value:.7}"),
            (value + 1.0 / 18.0).abs() < 5e-5,
        );
        let alpha = prob(&sigma, "J", "b");
        let king = prob(&sigma, "K", "b");
        s.check(
            &format!("{n}: P(bet K) = 3·P(bet J), α ≤ 1/3"),
            "|P(K) − 3α| < 3e-3 (worst measured 4.2e-4), α ≤ 1/3",
            format!(
                "α = {alpha:.5}, P(K) = {king:.5}, |P(K) − 3α| = {:.1e}",
                (king - 3.0 * alpha).abs()
            ),
            (king - 3.0 * alpha).abs() < 3e-3 && alpha <= 1.0 / 3.0 + 1e-3,
        );
        let call_q = prob(&sigma, "Qb", "b");
        s.check(
            &format!("{n}: player 1 calls a bet with Q"),
            "1/3 (±3e-3; worst measured 3.7e-4)",
            format!("{call_q:.5}"),
            (call_q - 1.0 / 3.0).abs() < 3e-3,
        );
        let open_q = prob(&sigma, "Q", "b");
        s.check(
            &format!("{n}: player 0 never opens a queen"),
            "P(bet Q) < 5e-3 (worst measured 7.5e-4)",
            format!("{open_q:.1e}"),
            open_q < 5e-3,
        );
        results.push((algo, rows));
    }
    s.tables = convergence_table("Kuhn convergence", &results);
    s
}

fn best_response_section() -> Section {
    let mut s = Section::new(
        "Best response cross-check",
        "The recursive best-response code (used for every exploitability number) is compared \
         with an independent brute force that tries every pure strategy, on Kuhn poker, for \
         strategies at several stages of training.",
    );
    let tree = Tree::build(&Kuhn);
    let mut worst: f64 = 0.0;
    let mut cases = 0;
    for algo in ALGORITHMS {
        let mut solver = Solver::new(tree.clone(), algo);
        for cp in [0u32, 1, 3, 10, 100, 1000] {
            while solver.iterations() < cp {
                solver.iterate();
            }
            let sigma = solver.average_strategy();
            for p in 0..2 {
                let fast = best_response_value(&tree, &sigma, p);
                let brute = brute_force_best_response_value(&tree, &sigma, p);
                worst = worst.max((fast - brute).abs());
                cases += 1;
            }
        }
    }
    s.check(
        &format!("recursive vs brute-force best response ({cases} cases)"),
        "difference < 1e-12",
        format!("{worst:.1e}"),
        worst < 1e-12,
    );
    s
}

fn leduc_section(quick: bool) -> Section {
    let mut s = Section::new(
        "CFR on Leduc hold'em",
        "Leduc hold'em (Southey et al. 2005) has no simple closed form, so we check that \
         exploitability keeps falling and drops below a stated threshold. Thresholds were set \
         from measured convergence with margin (DCFR measured 1.7e-4 at 1,000 iterations and \
         7.9e-6 at 10,000 when the thresholds were chosen in M2, before D-031 made the discount \
         math bit-reproducible; the current values are in the table).",
    );
    let tree = Tree::build(&Leduc);
    s.report("information sets", tree.infosets.len().to_string());
    let checkpoints: &[u32] = if quick {
        &[10, 100, 1000]
    } else {
        &[10, 100, 1000, 10_000]
    };
    let mut results = Vec::new();
    for algo in ALGORITHMS {
        let (rows, _) = solve(&tree, algo, checkpoints);
        let falling = rows.windows(2).all(|w| w[1].1 < w[0].1);
        let trail: Vec<String> = rows.iter().map(|r| format!("{:.1e}", r.1)).collect();
        s.check(
            &format!("{}: exploitability falls at every checkpoint", algo.name()),
            "strictly decreasing",
            trail.join(" → "),
            falling,
        );
        results.push((algo, rows));
    }
    let dcfr = &results[0].1;
    let at = |it: u32| dcfr.iter().find(|r| r.0 == it).map(|r| r.1);
    if let Some(ex) = at(1000) {
        s.check(
            "DCFR exploitability after 1,000 iterations",
            "< 1e-3",
            format!("{ex:.2e}"),
            ex < 1e-3,
        );
    }
    if let Some(ex) = at(10_000) {
        s.check(
            "DCFR exploitability after 10,000 iterations",
            "< 5e-5",
            format!("{ex:.2e}"),
            ex < 5e-5,
        );
    }
    let value = dcfr.last().expect("rows").2;
    s.report(
        "game value for player 0 (no closed form)",
        format!("{value:.6}"),
    );
    s.tables = convergence_table("Leduc convergence", &results);
    s
}

fn river_theory_section() -> Result<Section, String> {
    let mut s = Section::new(
        "River solver vs theory (polarized toy game)",
        "OOP holds only nut hands (88 on Ah Kd 8c 5s 2h) and air (76); IP holds only \
         bluff-catchers (QQ). OOP may check or bet B; IP may only call or fold. Theory: IP \
         defends P/(P+B) (minimum defense frequency) and bluffs make up B/(P+2B) of the betting \
         range. Solved with DCFR for 3,000 iterations at three bet sizes.",
    );
    for f in [0.33, 0.75, 1.5] {
        let r = reference::toy_check(f, 3000)?;
        let label = format!("{:.0}% pot", f * 100.0);
        s.check(
            &format!("{label}: IP call frequency"),
            format!("P/(P+B) = {:.5} (±5e-4; worst measured 6.0e-5)", r.mdf),
            format!("{:.5}", r.call),
            (r.call - r.mdf).abs() < 5e-4,
        );
        s.check(
            &format!("{label}: bluff share of the betting range"),
            format!(
                "B/(P+2B) = {:.5} (±1e-3; worst measured 1.2e-4)",
                r.theory_bluff_share
            ),
            format!("{:.5}", r.bluff_share),
            (r.bluff_share - r.theory_bluff_share).abs() < 1e-3,
        );
        s.check(
            &format!("{label}: value hands bet"),
            "100% (> 99.99%; measured exactly 100%)",
            format!("{:.4}%", r.value_bet * 100.0),
            r.value_bet > 0.9999,
        );
        s.check(
            &format!("{label}: exploitability"),
            "< 0.01% of pot (worst measured 0.0019%)",
            format!("{:.4}% of pot", r.exploitability_pct),
            r.exploitability_pct < 0.01,
        );
    }
    Ok(s)
}

fn node_lock_section() -> Result<Section, String> {
    let mut s = Section::new(
        "Node-locking vs theory (polarized toy game)",
        "The same toy game with IP's call/fold decision locked at a fixed frequency (D-076). OOP's best response bluffs every air hand when IP calls less than the MDF and never bluffs when it calls more; its EV per hand pair is (3·(P + cB) + 16·max(0, (1−c)P − cB)) / 19 (3 value combos, 16 air combos). Solved with DCFR for 2,000 iterations.",
    );
    for (f, c) in [(0.75, 0.3), (0.75, 0.8), (1.0, 0.2)] {
        let r = reference::toy_lock_check(f, c, 2000)?;
        let label = format!(
            "{:.0}% pot, IP locked at {:.0}% calls (MDF {:.0}%)",
            f * 100.0,
            c * 100.0,
            r.mdf * 100.0
        );
        s.check(
            &format!("{label}: OOP air that bets"),
            format!("{:.0}% (±0.1%)", r.theory_air_bets * 100.0),
            format!("{:.3}%", r.air_bets * 100.0),
            (r.air_bets - r.theory_air_bets).abs() < 1e-3,
        );
        s.check(
            &format!("{label}: OOP EV"),
            format!("{:.2} chips (±0.5)", r.theory_ev),
            format!("{:.2} chips", r.ev),
            (r.ev - r.theory_ev).abs() < 0.5,
        );
        s.check(
            &format!("{label}: exploitability of the locked game"),
            "< 0.01% of pot",
            format!("{:.4}% of pot", r.exploitability_pct),
            r.exploitability_pct < 0.01,
        );
    }
    Ok(s)
}

fn river_reference_section(quick: bool) -> Result<Section, String> {
    let mut s = Section::new(
        "River solver vs independent reference",
        "Random small river spots (4-9 weighted combos per side, two bet sizes, raises, \
         card overlap between ranges) are restated as ordinary extensive-form games, one chance \
         outcome per pair of hands, with showdowns scored by the slow reference evaluator, and \
         solved by the tabular engine validated above. (1) The vectorized solution is \
         translated into that game and its exploitability is measured by the tabular \
         best-response code; it must equal the vectorized solver's own figure. (2) Both \
         solvers must reach the same game value. 1,500 DCFR iterations each.",
    );
    let mut rng = Rng::seed(0x00C0_FFEE);
    let n = if quick { 4 } else { 12 };
    let (mut worst_br, mut worst_value, mut worst_ex) = (0f64, 0f64, 0f64);
    for _ in 0..n {
        let cfg = reference::random_river_spot(&mut rng);
        let r = reference::reference_check(&cfg, 1500)?;
        worst_br = worst_br.max((r.tabular_exploitability - r.vectorized_exploitability).abs());
        worst_value = worst_value.max((r.tabular_value - r.vectorized_value).abs());
        worst_ex = worst_ex.max(r.vectorized_exploitability);
    }
    s.check(
        &format!("best response: vectorized vs tabular ({n} spots)"),
        "max difference < 1e-4 chips (measured 1.9e-5)",
        format!("{worst_br:.2e} chips"),
        worst_br < 1e-4,
    );
    s.check(
        &format!("game value: vectorized vs tabular solve ({n} spots)"),
        "max difference < 0.02 chips (10× measured 1.9e-3; floor 0.01)",
        format!(
            "{worst_value:.2e} chips ({:.5}% of pot)",
            worst_value / 10.0
        ),
        worst_value < 0.02,
    );
    s.report(
        "largest vectorized exploitability among these spots",
        format!("{:.4}% of pot", worst_ex / 10.0),
    );
    Ok(s)
}

fn solve_spot(cfg: &SpotConfig, iterations: u32) -> Result<PostflopGame, String> {
    let mut g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT)?;
    for _ in 0..iterations {
        g.iterate();
    }
    Ok(g)
}

fn river_invariance_section() -> Result<Section, String> {
    let mut s = Section::new(
        "River solver: symmetry, determinism and regression goldens",
        "Relabelling suits must not change values or strategies; identical ranges with no \
         betting must split the pot; the same inputs must give bit-identical results; and the \
         stored golden spots (`data/goldens/river.json`) must re-solve to exactly the stored \
         fingerprints. The committed WebAssembly build is checked against the same \
         fingerprints by `npm test` (web/src/lib/wasm/goldens.test.ts).",
    );
    let spot = |board: &str, oop: &str, ip: &str, bet: &str| -> Result<SpotConfig, String> {
        spot_from_json(&serde_json::json!({
            "board": board, "pot": 10, "stack": 50,
            "ranges": { "oop": oop, "ip": ip },
            "sizes": { "default": { "oop": { "bet": bet, "raise": "100" }, "ip": { "bet": bet, "raise": "100" } } },
            "maxRaises": 2
        }))
    };
    let (oop, ip) = (
        "TT+, AJs+, KQs, 98s, 76s, AQo+",
        "99+, ATs+, KJs+, QJs, JTs, T9s, AJo+, KQo",
    );
    // Swap spades and hearts everywhere.
    let perm = [0u8, 1, 3, 2];
    let base = spot("Ks Th 7d 4c 2s", oop, ip, "50, 100")?;
    let mut permuted = base.clone();
    permuted.board = base.board.iter().map(|&c| permute_card(c, &perm)).collect();
    for p in 0..2 {
        let mut r = Range::empty();
        for (c, w) in base.ranges[p].iter() {
            r.set(permute_combo(c, &perm), w);
        }
        permuted.ranges[p] = r;
    }
    let (mut a, mut b) = (solve_spot(&base, 500)?, solve_spot(&permuted, 500)?);
    let (ea, eb) = (a.expected_values(), b.expected_values());
    let ev_diff = (ea[0] - eb[0]).abs().max((ea[1] - eb[1]).abs());
    let (sa, sb) = (
        a.river_average(0).ok_or("root")?,
        b.river_average(0).ok_or("root")?,
    );
    let n = a.hands(0).len();
    let mut strat_diff: f32 = 0.0;
    for (h, &c) in a.hands(0).iter().enumerate() {
        let hb = b
            .hands(0)
            .iter()
            .position(|&x| x == permute_combo(c, &perm))
            .ok_or("hand")?;
        for act in 0..sa.len() / n {
            strat_diff = strat_diff.max((sa[act * n + h] - sb[act * n + hb]).abs());
        }
    }
    s.check(
        "suit relabelling: EV difference",
        "< 1e-6 chips (measured exactly 0)",
        format!("{ev_diff:.1e} chips"),
        ev_diff < 1e-6,
    );
    s.check(
        "suit relabelling: max strategy difference (any combo, any action)",
        "< 1e-6 (measured exactly 0)",
        format!("{strat_diff:.1e}"),
        strat_diff < 1e-6,
    );

    let mut sym = solve_spot(&spot("Ks Th 7d 4c 2s", oop, oop, "")?, 1)?;
    let ev = sym.expected_values();
    let half = 500.0;
    s.check(
        "identical ranges, no betting: each player expects half the pot",
        "500 chips each (±1e-6; measured exactly 500)",
        format!("{:.6} / {:.6}", ev[0], ev[1]),
        (ev[0] - half).abs() < 1e-6 && (ev[1] - half).abs() < 1e-6,
    );

    let (x, y) = (solve_spot(&base, 300)?, solve_spot(&base, 300)?);
    s.check(
        "determinism: two identical solves",
        "identical fingerprints",
        format!("{:016x} / {:016x}", x.fingerprint(), y.fingerprint()),
        x.fingerprint() == y.fingerprint(),
    );

    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/goldens/river.json");
    match std::fs::read_to_string(path) {
        Err(_) => s.check(
            "regression goldens",
            "file present",
            "missing (run gen-goldens)",
            false,
        ),
        Ok(text) => {
            let doc: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
            for g in doc["spots"].as_array().ok_or("goldens: no spots")? {
                let name = g["name"].as_str().unwrap_or("?");
                let cfg = spot_from_json(&g["spot"])?;
                let iterations = g["iterations"].as_u64().unwrap_or(0) as u32;
                let r = goldens::solve(&cfg, iterations)?;
                let want = g["fingerprint"].as_str().unwrap_or("");
                let got = format!("{:016x}", r.fingerprint);
                s.check(
                    &format!("golden {name}"),
                    format!("fingerprint {want}"),
                    got.clone(),
                    got == want,
                );
            }
        }
    }
    Ok(s)
}

fn turn_reference_section(quick: bool) -> Result<Section, String> {
    let mut s = Section::new(
        "Turn solver vs independent reference",
        "Random small turn spots (3-5 weighted combos per side, one bet size and one raise per \
         street) restated as extensive-form games with an explicit chance node for every river \
         card and solved by the tabular engine; same two checks as for the river. 800 DCFR \
         iterations each, no suit isomorphism.",
    );
    let mut rng = Rng::seed(0x7AB1E);
    let n = if quick { 2 } else { 5 };
    let (mut worst_br, mut worst_value) = (0f64, 0f64);
    for _ in 0..n {
        let cfg = reference::random_turn_spot(&mut rng);
        let r = reference::reference_check(&cfg, 800)?;
        worst_br = worst_br.max((r.tabular_exploitability - r.vectorized_exploitability).abs());
        worst_value = worst_value.max((r.tabular_value - r.vectorized_value).abs());
    }
    s.check(
        &format!("best response: vectorized vs tabular ({n} turn spots)"),
        "max difference < 2e-4 chips (measured 2.6e-5)",
        format!("{worst_br:.2e} chips"),
        worst_br < 2e-4,
    );
    s.check(
        &format!("game value: vectorized vs tabular solve ({n} turn spots)"),
        "max difference < 0.01 chips (floor; measured 1.9e-4)",
        format!(
            "{worst_value:.2e} chips ({:.5}% of pot)",
            worst_value / 10.0
        ),
        worst_value < 0.01,
    );
    Ok(s)
}

fn flop_reference_section(quick: bool) -> Result<Section, String> {
    let mut s = Section::new(
        "Flop solver vs independent reference",
        "Tiny random flop spots (2-3 weighted combos per side, one bet size on flop and turn, \
         no raises, no river betting) restated as extensive-form games with explicit chance \
         nodes for every turn and every river card, and solved by the tabular engine; same two \
         checks as for the river and turn. 600 DCFR iterations each, no suit isomorphism. \
         These are slow for the tabular side (30-60 s per spot).",
    );
    let mut rng = Rng::seed(0xF10F);
    let n = if quick { 1 } else { 2 };
    let (mut worst_br, mut worst_value) = (0f64, 0f64);
    for _ in 0..n {
        let cfg = reference::random_flop_spot(&mut rng);
        let r = reference::reference_check(&cfg, 600)?;
        worst_br = worst_br.max((r.tabular_exploitability - r.vectorized_exploitability).abs());
        worst_value = worst_value.max((r.tabular_value - r.vectorized_value).abs());
    }
    s.check(
        &format!("best response: vectorized vs tabular ({n} flop spots)"),
        "max difference < 5e-4 chips (measured 6.5e-5 over 3 spots)",
        format!("{worst_br:.2e} chips"),
        worst_br < 5e-4,
    );
    s.check(
        &format!("game value: vectorized vs tabular solve ({n} flop spots)"),
        "max difference < 0.01 chips (floor; measured 1.9e-4)",
        format!(
            "{worst_value:.2e} chips ({:.5}% of pot)",
            worst_value / 10.0
        ),
        worst_value < 0.01,
    );
    Ok(s)
}

fn solve_with(cfg: &SpotConfig, iso: bool, iterations: u32) -> Result<PostflopGame, String> {
    let options = Options {
        algorithm: Algorithm::DCFR_DEFAULT,
        isomorphism: iso,
    };
    let mut g = PostflopGame::with_options(cfg.clone(), options)?;
    for _ in 0..iterations {
        g.iterate();
    }
    Ok(g)
}

fn multi_street_section() -> Result<Section, String> {
    let mut s = Section::new(
        "Turn and flop: suit isomorphism, convergence, abstraction, memory",
        "Suit isomorphism (sharing work between river or turn cards that are the same situation \
         with suits relabelled) must not change results; turn and flop solves must converge; \
         the automatic abstraction ladder must bring a spot under budget without touching ranges \
         or board; the memory estimate must cover what is allocated.",
    );
    let spot =
        |board: &str, oop: &str, ip: &str, sizes: serde_json::Value, raises: serde_json::Value| {
            spot_from_json(&serde_json::json!({
                "board": board, "pot": 10, "stack": 50,
                "ranges": { "oop": oop, "ip": ip },
                "sizes": sizes, "maxRaises": raises
            }))
        };
    let one = serde_json::json!({ "default": { "oop": { "bet": "66", "raise": "100" }, "ip": { "bet": "66", "raise": "100" } } });
    let turn = spot(
        "Ks Ts 7s 2s",
        "QQ+, AJs+, KQs, T9s, 87s, AQo+",
        "TT+, ATs+, KJs+, QJs, 98s, AJo+",
        one.clone(),
        serde_json::json!(1),
    )?;
    let (mut with, mut without) = (
        solve_with(&turn, true, 300)?,
        solve_with(&turn, false, 300)?,
    );
    let (a, b) = (with.expected_values(), without.expected_values());
    let ev_diff = (a[0] - b[0]).abs().max((a[1] - b[1]).abs());
    let (ea, eb) = (with.exploitability(), without.exploitability());
    let (ra, rb) = (
        with.river_average(0).ok_or("root")?,
        without.river_average(0).ok_or("root")?,
    );
    let strat = ra
        .iter()
        .zip(&rb)
        .map(|(x, y)| (x - y).abs())
        .fold(0.0f32, f32::max);
    s.check(
        "monotone turn (Ks Ts 7s 2s): relabellings found",
        "6 (the three other suits permute freely)",
        with.symmetries().to_string(),
        with.symmetries() == 6,
    );
    s.check(
        "isomorphism on vs off: storage",
        "less than half",
        format!(
            "{} vs {} entries",
            with.storage_entries(),
            without.storage_entries()
        ),
        with.storage_entries() * 2 < without.storage_entries(),
    );
    s.check(
        "isomorphism on vs off: EV difference",
        "< 2e-3 chips (measured 2.3e-4)",
        format!("{ev_diff:.1e} chips"),
        ev_diff < 2e-3,
    );
    s.check(
        "isomorphism on vs off: exploitability difference",
        "< 0.02 chips (measured 2.6e-3)",
        format!("{:.1e} chips", (ea.chips - eb.chips).abs()),
        (ea.chips - eb.chips).abs() < 0.02,
    );
    s.check(
        "isomorphism on vs off: max root strategy difference",
        "< 1e-3 (measured 2.4e-4)",
        format!("{strat:.1e}"),
        strat < 1e-3,
    );
    let asym = spot(
        "Ks Ts 7s 2s",
        "QQ+, AhQh",
        "TT+",
        one.clone(),
        serde_json::json!(1),
    )?;
    let g = PostflopGame::with_options(asym, Options::default())?;
    s.check(
        "asymmetric range (only the heart flush draw): relabellings kept",
        "2 (clubs and diamonds only)",
        g.symmetries().to_string(),
        g.symmetries() == 2,
    );

    let rainbow_turn = spot(
        "Kd Th 7c 2s",
        "QQ+, AJs+, KQs, T9s, AQo+",
        "TT+, ATs+, KJs+, QJs, AJo+",
        one.clone(),
        serde_json::json!(1),
    )?;
    let trail = convergence(&rainbow_turn, &[10, 50, 200])?;
    let shown = trail
        .iter()
        .map(|x| format!("{x:.3}%"))
        .collect::<Vec<_>>()
        .join(" → ");
    s.check(
        "turn (Kd Th 7c 2s): exploitability falls at every checkpoint (10, 50, 200)",
        "strictly decreasing",
        shown.clone(),
        trail.windows(2).all(|w| w[1] < w[0]),
    );
    let last = *trail.last().ok_or("empty")?;
    s.check(
        "turn (Kd Th 7c 2s): exploitability after 200 iterations",
        "< 0.25% of pot (measured 0.049%)",
        format!("{last:.3}%"),
        last < 0.25,
    );
    let small = serde_json::json!({
        "flop": { "oop": { "bet": "33" }, "ip": { "bet": "33" } },
        "turn": { "oop": { "bet": "66" }, "ip": { "bet": "66" } },
        "river": { "oop": { "bet": "75" }, "ip": { "bet": "75" } }
    });
    let flop = spot(
        "Qs Jh 4d",
        "TT+, AJs+, KQs, AQo+",
        "88+, ATs+, KJs+, QJs, JTs, AJo+",
        small,
        serde_json::json!(0),
    )?;
    let trail = convergence(&flop, &[5, 10, 20, 30, 45, 60])?;
    let shown = trail
        .iter()
        .map(|x| format!("{x:.3}%"))
        .collect::<Vec<_>>()
        .join(" → ");
    s.check(
        "flop (Qs Jh 4d, one size per street): exploitability falls at every checkpoint (5, 10, 20, 30, 45, 60)",
        "strictly decreasing",
        shown,
        trail.windows(2).all(|w| w[1] < w[0]),
    );
    let last = *trail.last().ok_or("empty")?;
    s.check(
        "flop (Qs Jh 4d, one size per street): exploitability after 60 iterations",
        "< 2% of pot (kept at the original threshold, which was chosen after seeing a run; measured 0.57%)",
        format!("{last:.3}%"),
        last < 2.0,
    );

    let big = spot(
        "Qs Jh 4d",
        "22+, A2s+, KTs+, QTs+, JTs, ATo+",
        "22+, A2s+, K9s+, Q9s+, J9s+, T9s, A9o+, KJo+",
        serde_json::json!({ "default": { "oop": { "bet": "33, 75", "raise": "100" }, "ip": { "bet": "33, 75, 150", "raise": "100" } } }),
        serde_json::json!(2),
    )?;
    let full = estimate_memory_with(&big, Options::default())?;
    let fitted = fit_to_budget(&big, full / 10, Options::default())?;
    s.check(
        "abstraction ladder: flop tree squeezed to 10% of its memory",
        "fits, steps reported, ranges and board unchanged",
        format!(
            "{:.0} MB → {:.0} MB via: {}",
            full as f64 / 1e6,
            fitted.bytes as f64 / 1e6,
            fitted.steps.join("; ")
        ),
        fitted.bytes <= full / 10
            && !fitted.steps.is_empty()
            && fitted.config.ranges == big.ranges
            && fitted.config.board == big.board,
    );
    let g = PostflopGame::with_options(turn.clone(), Options::default())?;
    let est = estimate_memory_with(&turn, Options::default())?;
    s.check(
        "memory estimate covers the solver storage",
        "estimate ≥ regrets + strategy sums",
        format!(
            "{:.1} MB estimated, {:.1} MB storage",
            est as f64 / 1e6,
            g.storage_entries() as f64 * 8.0 / 1e6
        ),
        est >= g.storage_entries() * 8,
    );
    Ok(s)
}

fn convergence(cfg: &SpotConfig, checkpoints: &[u32]) -> Result<Vec<f64>, String> {
    let mut g = PostflopGame::new(cfg.clone(), Algorithm::DCFR_DEFAULT)?;
    let mut out = Vec::new();
    for &cp in checkpoints {
        while g.iterations() < cp {
            g.iterate();
        }
        out.push(g.exploitability().pct_pot);
    }
    Ok(out)
}

// ---- preflop (M5) ------------------------------------------------------------------------

fn load_pairs_for_validation() -> Result<PairEquity, String> {
    let path = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../data/equity/preflop-pairs.json"
    );
    let text = std::fs::read_to_string(path).map_err(|e| format!("{path}: {e}"))?;
    pair_equity_from_json(&serde_json::from_str(&text).map_err(|e| e.to_string())?)
}

fn per_combo(class_freq: &[f64]) -> Vec<f64> {
    let mut out = vec![0.0; 1326];
    for c in HandClass::all() {
        for combo in c.combos() {
            out[combo.index()] = class_freq[c.index()];
        }
    }
    out
}

fn preflop_section() -> Result<Section, String> {
    let mut s = Section::new(
        "Preflop: push/fold, ICM and the sampled engine",
        "Heads-up push/fold is solved exactly over all 1326 combos per player (DCFR, exact \
         card removal, exact all-in equities from data/equity/preflop-pairs.json). A toy version \
         with a closed-form answer checks the solver; indifference checks that hands which mix \
         have equal EVs. The sampled-CFR engine used for 3+ players and for the cash model is \
         checked against the exact heads-up solver, and its best-response estimate against exact \
         best responses. ICM is checked on hand-computable cases.",
    );
    // Toy: the pusher's hand always wins (weight p) or always loses; one caller hand.
    let (st, p) = (10.0, 0.3);
    let toy = ShoveGame {
        pusher: vec![p, 1.0 - p],
        caller: vec![1.0],
        compat: vec![1.0, 1.0],
        outcome: vec![(1.0, 0.0), (0.0, 0.0)],
        payoffs: Payoffs {
            fold: [-0.5, 0.5],
            steal: [1.0, -1.0],
            win: [st, -st],
            tie: [0.0, 0.0],
            lose: [-st, st],
        },
    };
    let (solver, report) = solve_shove(toy, 1e-9, 20_000, 100);
    let q = (st - 1.0) / (2.0 * st);
    let (xt, yt) = (p * q / ((1.0 - p) * (1.0 - q)), 1.5 / (1.0 + st));
    let (x, y) = (solver.average(0), solver.average(1));
    s.check(
        "toy push/fold: losing hand's shove frequency",
        format!("p·q/((1−p)(1−q)) = {xt:.6} (±3e-4; measured 3.2e-5)"),
        format!("{:.6}", x[1]),
        (x[1] - xt).abs() < 3e-4,
    );
    s.check(
        "toy push/fold: call frequency",
        format!("1.5/(1+S) = {yt:.6} (±3e-4; measured 1.2e-5)"),
        format!("{:.6}", y[0]),
        (y[0] - yt).abs() < 3e-4,
    );
    s.check(
        "toy push/fold: winning hand always shoves",
        "> 0.9999",
        format!("{:.6}", x[0]),
        x[0] > 0.9999,
    );
    s.check(
        "toy push/fold: exploitability",
        "< 1e-4 bb (measured 3.3e-5)",
        format!("{:.2e} bb", report.exploitability),
        report.exploitability < 1e-4,
    );

    let eq = load_pairs_for_validation()?;
    for stack in [5.0, 10.0, 20.0] {
        let (solver, report) = solve_shove(
            hu_spot(&PushFoldSpot::heads_up(stack), &eq)?,
            1e-6,
            20_000,
            50,
        );
        let (x, y) = (solver.average(0), solver.average(1));
        let v = solver.values(&x, &y);
        let mut worst = 0.0f64;
        for i in 0..1326 {
            if x[i] > 0.02 && x[i] < 0.98 {
                worst = worst.max(((v.shove[i] - v.fold[i]) / v.pusher_mass[i]).abs());
            }
            if y[i] > 0.02 && y[i] < 0.98 && v.caller_mass[i] > 0.0 {
                worst = worst.max(((v.call[i] - v.pass[i]) / v.caller_mass[i]).abs());
            }
        }
        s.check(
            &format!("heads-up push/fold {stack} bb: exploitability"),
            "≤ 1e-6 bb (solve target)",
            format!(
                "{:.2e} bb after {} iterations",
                report.exploitability,
                solver.iterations()
            ),
            report.exploitability <= 1e-6,
        );
        s.check(
            &format!("heads-up push/fold {stack} bb: chip EV is zero-sum"),
            "|SB value + BB value| < 1e-12",
            format!("{:.1e}", (report.value[0] + report.value[1]).abs()),
            (report.value[0] + report.value[1]).abs() < 1e-12,
        );
        s.check(
            &format!("heads-up push/fold {stack} bb: indifference of mixing combos"),
            "|EV(shove/call) − EV(fold)| < 3e-3 bb (worst measured 5.9e-4)",
            format!("{worst:.1e} bb"),
            worst < 3e-3,
        );
    }

    // Sampled engine (2 players) judged by the exact solver.
    let tree = push_fold(2, 10.0, 0.0)?;
    let mut e = Engine::new(&tree, Some(&eq), None, 11)?;
    e.iterate(2_000_000);
    let PNode::Action { children, .. } = &tree.nodes[0] else {
        return Err("tree".into());
    };
    let bb = children[1];
    let freq = |e: &Engine, node: usize| -> Vec<f64> {
        let mut sigma = [0.0; 2];
        (0..NUM_CLASSES)
            .map(|c| {
                e.strategy(node, c, true, &mut sigma);
                sigma[1]
            })
            .collect()
    };
    let exact_game = ShoveSolver::new(
        hu_spot(&PushFoldSpot::heads_up(10.0), &eq)?,
        Algorithm::DCFR_DEFAULT,
    );
    let r = shove_report_for(
        &exact_game,
        &per_combo(&freq(&e, 0)),
        &per_combo(&freq(&e, bb)),
    );
    s.check(
        "sampled CFR (2 players, 10 bb, 2M iterations) judged by the exact solver",
        "exploitability < 3e-3 bb (measured 3.7e-4)",
        format!("{:.2e} bb", r.exploitability),
        r.exploitability < 3e-3,
    );
    let mut rough = Engine::new(&tree, Some(&eq), None, 3)?;
    rough.iterate(20_000);
    let sampled = rough.evaluate(4_000_000, 17).best_response_gain;
    let r = shove_report_for(
        &exact_game,
        &per_combo(&freq(&rough, 0)),
        &per_combo(&freq(&rough, bb)),
    );
    let exact = [
        r.best_response[0] - r.value[0],
        r.best_response[1] - r.value[1],
    ];
    let rel = (0..2)
        .map(|p| ((sampled[p] - exact[p]) / exact[p]).abs())
        .fold(0.0, f64::max);
    s.check(
        "sampled best-response estimate vs exact best response (under-converged HU strategy)",
        "relative error < 10% (measured 1.8%)",
        format!(
            "sampled {:.4}/{:.4} vs exact {:.4}/{:.4} bb",
            sampled[0], sampled[1], exact[0], exact[1]
        ),
        rel < 0.1,
    );

    // ICM.
    let ev = icm_equity(&[3000.0, 1000.0], &[70.0, 30.0]);
    s.check(
        "ICM, 2 players: linear in chips",
        "60 / 40 = 30 + 40 × chip share",
        format!("{:.6} / {:.6}", ev[0], ev[1]),
        (ev[0] - 60.0).abs() < 1e-12 && (ev[1] - 40.0).abs() < 1e-12,
    );
    let ev = icm_equity(&[50.0, 30.0, 20.0], &[60.0, 40.0]);
    let a = 0.5 * 60.0 + (0.3 * 50.0 / 70.0 + 0.2 * 50.0 / 80.0) * 40.0;
    s.check(
        "ICM, 3 players 50/30/20, payouts 60/40: first player",
        format!("{a:.9} (by hand)"),
        format!("{:.9}", ev[0]),
        (ev[0] - a).abs() < 1e-12,
    );
    let ev = icm_equity(&[5000.0, 3000.0, 1500.0, 500.0], &[50.0, 30.0, 20.0]);
    let total: f64 = ev.iter().sum();
    s.check(
        "ICM: prizes are conserved",
        "sum = 100 (±1e-9)",
        format!("{total:.12}"),
        (total - 100.0).abs() < 1e-9,
    );
    Ok(s)
}

/// Checks on the committed chart files (data/charts), which take ~30 minutes to regenerate.
fn charts_section() -> Result<Section, String> {
    let mut s = Section::new(
        "Preflop chart files (data/charts)",
        "Read from the committed files (regenerate with `solver-cli gen-charts`). Heads-up \
         push/fold must be solved to its target; sampled families report each seat's estimated \
         best-response gain (cross-validated, weighted by the seat's own reach, so it is near 0 \
         or slightly negative at convergence). Sanity bands are plausibility checks on the cash \
         model, listed separately from correctness checks.",
    );
    let dir = concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/charts");
    let read = |name: &str| -> Result<serde_json::Value, String> {
        let p = format!("{dir}/{name}");
        let text = std::fs::read_to_string(&p)
            .map_err(|e| format!("{p}: {e} (run solver-cli gen-charts)"))?;
        serde_json::from_str(&text).map_err(|e| e.to_string())
    };
    let hu = read("pushfold-hu.json")?;
    let charts = hu["charts"].as_array().ok_or("pushfold-hu: no charts")?;
    let worst = charts
        .iter()
        .filter_map(|c| c["solve"]["exploitabilityBb"].as_f64())
        .fold(0.0, f64::max);
    s.check(
        &format!(
            "pushfold-hu.json: every one of {} charts solved to target",
            charts.len()
        ),
        "exploitability ≤ 1e-6 bb",
        format!("worst {worst:.2e} bb"),
        worst <= 1e-6 && hu["provenance"]["gitDirty"] == false,
    );
    for n in 3..=6 {
        let doc = read(&format!("pushfold-{n}max.json"))?;
        let gains: Vec<f64> = doc["solves"]
            .as_array()
            .ok_or("no solves")?
            .iter()
            .flat_map(|x| {
                x["bestResponseGainBb"]
                    .as_array()
                    .cloned()
                    .unwrap_or_default()
            })
            .filter_map(|x| x.as_f64())
            .collect();
        let max = gains.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        s.check(
            &format!(
                "pushfold-{n}max.json: largest estimated best-response gain (any seat, any stack)"
            ),
            "< 0.05 bb per hand",
            format!("{max:.4} bb"),
            max < 0.05,
        );
    }
    for stack in [20, 40, 60, 100] {
        let Ok(doc) = read(&format!("cash-6max-{stack}bb.json")) else {
            s.report(&format!("cash-6max-{stack}bb.json"), "not committed");
            continue;
        };
        let gains: Vec<f64> = doc["bestResponseGainBb"]
            .as_array()
            .ok_or("no gains")?
            .iter()
            .filter_map(|x| x.as_f64())
            .collect();
        let max = gains.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        s.check(
            &format!("cash-6max-{stack}bb.json: largest estimated best-response gain (any seat)"),
            "< 0.05 bb per hand",
            format!("{max:.4} bb"),
            max < 0.05,
        );
        let first_in: Vec<String> = doc["firstIn"]
            .as_array()
            .ok_or("no firstIn")?
            .iter()
            .map(|x| {
                format!(
                    "{} {:.1}%",
                    x["seat"].as_str().unwrap_or("?"),
                    x["share"].as_f64().unwrap_or(f64::NAN) * 100.0
                )
            })
            .collect();
        s.report(
            &format!("cash-6max-{stack}bb.json: EQR model"),
            format!(
                "{} (commit {}, dirty {})",
                doc["provenance"]["model"]["name"].as_str().unwrap_or("?"),
                doc["provenance"]["gitCommit"].as_str().unwrap_or("?"),
                doc["provenance"]["gitDirty"]
            ),
        );
        s.report(
            &format!("cash {stack} bb: first-in (open) frequency"),
            first_in.join(", "),
        );
        for b in doc["sanityBands"].as_array().cloned().unwrap_or_default() {
            let (lo, hi, m) = (
                b["low"].as_f64().unwrap_or(0.0),
                b["high"].as_f64().unwrap_or(0.0),
                b["measured"].as_f64().unwrap_or(f64::NAN),
            );
            s.sanity(
                &format!(
                    "cash {stack} bb: {} opens",
                    b["seat"].as_str().unwrap_or("?")
                ),
                format!("{:.0}–{:.0}% (plausibility band)", lo * 100.0, hi * 100.0),
                format!("{:.1}%", m * 100.0),
                m >= lo && m <= hi,
            );
        }
        for sens in doc["sensitivity"].as_array().cloned().unwrap_or_default() {
            let row: Vec<String> = sens["firstIn"]
                .as_array()
                .cloned()
                .unwrap_or_default()
                .iter()
                .map(|x| {
                    format!(
                        "{} {:.1}%",
                        x["seat"].as_str().unwrap_or("?"),
                        x["share"].as_f64().unwrap_or(f64::NAN) * 100.0
                    )
                })
                .collect();
            s.report(
                &format!(
                    "cash {stack} bb: first-in with out-of-position realization ×{}",
                    sens["oopScale"]
                ),
                row.join(", "),
            );
        }
    }
    Ok(s)
}

fn eqr_section() -> Result<Section, String> {
    let mut s = Section::new(
        "EQR v2 calibration (data/eqr/eqr-v2.json)",
        "Equity-realization factors measured from OpenRange's own postflop solves (D-048); read \
         from the committed file (regenerate with `solver-cli calibrate-eqr`). Factors are \
         model outputs with sampling error, so only the solve quality is checked; the factors \
         themselves are reported.",
    );
    let p = concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/eqr/eqr-v2.json");
    let Ok(text) = std::fs::read_to_string(p) else {
        s.report("eqr-v2.json", "not committed");
        return Ok(s);
    };
    let doc: serde_json::Value = serde_json::from_str(&text).map_err(|e| e.to_string())?;
    let target = doc["provenance"]["solver"]["targetPctPot"]
        .as_f64()
        .ok_or("eqr-v2: no target")?;
    let max_it = doc["provenance"]["solver"]["maxIterations"]
        .as_u64()
        .unwrap_or(0);
    let solves = doc["solves"].as_array().ok_or("eqr-v2: no solves")?;
    let worst = solves
        .iter()
        .filter_map(|x| x["exploitabilityPctPot"].as_f64())
        .fold(0.0, f64::max);
    let capped = solves
        .iter()
        .filter(|x| x["iterations"].as_u64() >= Some(max_it))
        .count();
    s.check(
        &format!(
            "every one of {} calibration solves reached its target",
            solves.len()
        ),
        format!("exploitability ≤ {target}% of pot"),
        format!("worst {worst:.3}% ({capped} stopped at the iteration cap)"),
        worst <= target,
    );
    let pot = doc["checks"]["worstPotConservation"]
        .as_f64()
        .unwrap_or(f64::NAN);
    s.check(
        "the two players' EVs add up to the pot (no rake), every solve",
        "relative error < 1e-6",
        format!("{pot:.1e}"),
        pot < 1e-6,
    );
    s.check(
        "generated from a clean commit",
        "gitDirty = false",
        format!(
            "commit {}, dirty {}",
            doc["provenance"]["gitCommit"].as_str().unwrap_or("?"),
            doc["provenance"]["gitDirty"]
        ),
        doc["provenance"]["gitDirty"] == false,
    );
    let classes: Vec<&str> = doc["classes"]
        .as_array()
        .ok_or("eqr-v2: no classes")?
        .iter()
        .filter_map(|x| x.as_str())
        .collect();
    let idx = |name: &str| classes.iter().position(|&c| c == name);
    for role in doc["roles"].as_array().ok_or("eqr-v2: no roles")? {
        let name = format!(
            "{} pot, {}, {}",
            role["potType"].as_str().unwrap_or("?"),
            if role["inPosition"] == true {
                "in position"
            } else {
                "out of position"
            },
            if role["aggressor"] == true {
                "preflop aggressor"
            } else {
                "caller"
            }
        );
        let f = role["factors"].as_array().ok_or("no factors")?;
        let e = role["stdErrors"].as_array().ok_or("no errors")?;
        let show: Vec<String> = ["AA", "AKs", "T9s", "22", "K7o", "72o"]
            .iter()
            .filter_map(|&c| {
                let i = idx(c)?;
                Some(format!("{c} {:.2}±{:.2}", f[i].as_f64()?, e[i].as_f64()?))
            })
            .collect();
        s.report(
            &format!("{name}: range-average factor; examples"),
            format!(
                "{:.3} ± {:.3}; {} (fallbacks: {})",
                role["meanFactor"].as_f64().unwrap_or(f64::NAN),
                role["meanFactorStdError"].as_f64().unwrap_or(f64::NAN),
                show.join(", "),
                role["fallbackClasses"].as_array().map_or(0, |a| a.len())
            ),
        );
    }
    Ok(s)
}

/// Table cells may contain `|` (e.g. "|z| < 4"), which Markdown would read as a column break.
fn cell(x: &str) -> String {
    x.replace('|', r"\|")
}

pub fn run(quick: bool, out: &str) -> Result<(), String> {
    let start = Instant::now();
    eprintln!("validate: evaluator");
    let mut sections = vec![evaluator_section(quick)];
    eprintln!("validate: equity");
    sections.push(equity_section()?);
    eprintln!("validate: kuhn");
    sections.push(kuhn_section());
    eprintln!("validate: best response");
    sections.push(best_response_section());
    eprintln!("validate: leduc");
    sections.push(leduc_section(quick));
    eprintln!("validate: river theory");
    sections.push(river_theory_section()?);
    sections.push(node_lock_section()?);
    eprintln!("validate: river reference");
    sections.push(river_reference_section(quick)?);
    eprintln!("validate: river invariance");
    sections.push(river_invariance_section()?);
    eprintln!("validate: turn reference");
    sections.push(turn_reference_section(quick)?);
    eprintln!("validate: flop reference");
    sections.push(flop_reference_section(quick)?);
    eprintln!("validate: turn and flop");
    sections.push(multi_street_section()?);
    eprintln!("validate: preflop");
    sections.push(preflop_section()?);
    eprintln!("validate: eqr v2");
    sections.push(eqr_section()?);
    eprintln!("validate: chart files");
    sections.push(charts_section()?);

    let failed: usize = sections
        .iter()
        .map(|s| {
            s.checks
                .iter()
                .filter(|c| !c.pass && c.kind == Kind::Check)
                .count()
        })
        .sum();
    let total: usize = sections
        .iter()
        .map(|s| s.checks.iter().filter(|c| c.kind == Kind::Check).count())
        .sum();
    let reported: usize = sections
        .iter()
        .map(|s| s.checks.iter().filter(|c| c.kind == Kind::Report).count())
        .sum();
    let bands: Vec<&Check> = sections
        .iter()
        .flat_map(|s| s.checks.iter())
        .filter(|c| c.kind == Kind::Sanity)
        .collect();
    let bands_in = bands.iter().filter(|c| c.pass).count();

    let mut md = String::new();
    let _ = writeln!(md, "# OpenRange — Validation report\n");
    let _ = writeln!(
        md,
        "_Generated by `solver-cli validate{}` — do not edit by hand._\n",
        if quick { " --quick" } else { "" }
    );
    let _ = writeln!(
        md,
        "- Generated: {}  \n- Git commit: `{}`  \n- solver-core: {}  \n- Run time: {:.0} s\n",
        utc_now(),
        git_commit_label(),
        solver_core::VERSION,
        start.elapsed().as_secs_f64()
    );
    let _ = writeln!(
        md,
        "**Result: {}** ({} of {total} checks passed). Another {reported} rows only report a \
         value and are not counted as checks.\n",
        if failed == 0 {
            "all checks passed"
        } else {
            "FAILURES"
        },
        total - failed
    );
    let _ = writeln!(
        md,
        "Tolerances were set at about 5–10× the value measured when they were chosen (shown in \
         the Expected column); see D-040 in docs/DECISIONS.md.\n"
    );
    if !bands.is_empty() {
        let _ = writeln!(
            md,
            "Sanity bands (plausibility of model outputs, not correctness checks): {bands_in} of {} \
             in band. Bands that are missed are investigated and recorded in docs/DECISIONS.md \
             (D-047).\n",
            bands.len()
        );
    }
    let _ = writeln!(
        md,
        "Not covered here: speed (see docs/KNOWN_LIMITS.md) and the trainer, which arrives in M6.\n"
    );
    for s in &sections {
        let _ = writeln!(
            md,
            "## {}\n\n{}\n\n| Check | Expected | Measured | Result |\n|---|---|---|---|",
            s.title, s.intro
        );
        for c in &s.checks {
            let result = match (c.kind, c.pass) {
                (Kind::Report, _) => "reported",
                (Kind::Sanity, true) => "in band",
                (Kind::Sanity, false) => "**out of band**",
                (Kind::Check, true) => "pass",
                (Kind::Check, false) => "**FAIL**",
            };
            let _ = writeln!(
                md,
                "| {} | {} | {} | {result} |",
                cell(&c.name),
                cell(&c.expected),
                cell(&c.measured)
            );
        }
        md.push_str(&s.tables);
        md.push('\n');
    }
    std::fs::write(out, md).map_err(|e| format!("writing {out}: {e}"))?;
    eprintln!(
        "validate: wrote {out}: {}/{total} checks passed ({reported} report-only rows) in {:.0}s",
        total - failed,
        start.elapsed().as_secs_f64()
    );
    if failed > 0 {
        Err(format!("{failed} validation check(s) failed"))
    } else {
        Ok(())
    }
}
