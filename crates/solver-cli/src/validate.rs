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
use solver_core::iso::{permute_card, permute_combo};
use solver_core::postflop::json::spot_from_json;
use solver_core::postflop::{PostflopGame, SpotConfig, reference};
use solver_core::range::Range;
use solver_core::rng::Rng;
use std::fmt::Write as _;
use std::time::Instant;

struct Check {
    name: String,
    expected: String,
    measured: String,
    pass: bool,
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
        s.check(
            "7-card enumeration",
            "(skipped in --quick)",
            "skipped",
            true,
        );
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
        "max error < 1e-9",
        format!("{mirror:.1e}"),
        mirror < 1e-9,
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
            "< 2e-3",
            format!("{ex:.2e}"),
            ex < 2e-3,
        );
        s.check(
            &format!("{n}: value for player 0"),
            "−1/18 = −0.055556 (±0.003)",
            format!("{value:.6}"),
            (value + 1.0 / 18.0).abs() < 3e-3,
        );
        let alpha = prob(&sigma, "J", "b");
        let king = prob(&sigma, "K", "b");
        s.check(
            &format!("{n}: P(bet K) = 3·P(bet J), α ≤ 1/3"),
            "|P(K) − 3α| < 0.03",
            format!("α = {alpha:.4}, P(K) = {king:.4}"),
            (king - 3.0 * alpha).abs() < 0.03 && alpha <= 1.0 / 3.0 + 0.01,
        );
        let call_q = prob(&sigma, "Qb", "b");
        s.check(
            &format!("{n}: player 1 calls a bet with Q"),
            "1/3 (±0.03)",
            format!("{call_q:.4}"),
            (call_q - 1.0 / 3.0).abs() < 0.03,
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
         7.9e-6 at 10,000 when the thresholds were chosen).",
    );
    let tree = Tree::build(&Leduc);
    s.check(
        "information sets",
        "(reported)",
        tree.infosets.len().to_string(),
        true,
    );
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
    s.check(
        "game value for player 0",
        "(reported; no closed form)",
        format!("{value:.6}"),
        true,
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
            format!("P/(P+B) = {:.4} (±0.01)", r.mdf),
            format!("{:.4}", r.call),
            (r.call - r.mdf).abs() < 0.01,
        );
        s.check(
            &format!("{label}: bluff share of the betting range"),
            format!("B/(P+2B) = {:.4} (±0.01)", r.theory_bluff_share),
            format!("{:.4}", r.bluff_share),
            (r.bluff_share - r.theory_bluff_share).abs() < 0.01,
        );
        s.check(
            &format!("{label}: value hands bet"),
            "100% (> 99%)",
            format!("{:.2}%", r.value_bet * 100.0),
            r.value_bet > 0.99,
        );
        s.check(
            &format!("{label}: exploitability"),
            "< 0.05% of pot",
            format!("{:.4}% of pot", r.exploitability_pct),
            r.exploitability_pct < 0.05,
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
        "max difference < 0.01 chips (0.001% of pot)",
        format!("{worst_br:.2e} chips"),
        worst_br < 0.01,
    );
    s.check(
        &format!("game value: vectorized vs tabular solve ({n} spots)"),
        "max difference < 0.2% of pot",
        format!("{:.4}% of pot", worst_value / 10.0),
        worst_value < 2.0,
    );
    s.check(
        "largest vectorized exploitability among these spots",
        "(reported)",
        format!("{:.4}% of pot", worst_ex / 10.0),
        true,
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
        "< 0.001 chips",
        format!("{ev_diff:.1e} chips"),
        ev_diff < 1e-3,
    );
    s.check(
        "suit relabelling: max strategy difference (any combo, any action)",
        "< 0.001",
        format!("{strat_diff:.1e}"),
        strat_diff < 1e-3,
    );

    let mut sym = solve_spot(&spot("Ks Th 7d 4c 2s", oop, oop, "")?, 1)?;
    let ev = sym.expected_values();
    let half = 500.0;
    s.check(
        "identical ranges, no betting: each player expects half the pot",
        "500 chips each (±0.001)",
        format!("{:.4} / {:.4}", ev[0], ev[1]),
        (ev[0] - half).abs() < 1e-3 && (ev[1] - half).abs() < 1e-3,
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
    eprintln!("validate: river reference");
    sections.push(river_reference_section(quick)?);
    eprintln!("validate: river invariance");
    sections.push(river_invariance_section()?);

    let failed: usize = sections
        .iter()
        .map(|s| s.checks.iter().filter(|c| !c.pass).count())
        .sum();
    let total: usize = sections.iter().map(|s| s.checks.len()).sum();

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
        "**Result: {}** ({} of {total} checks passed).\n",
        if failed == 0 {
            "all checks passed"
        } else {
            "FAILURES"
        },
        total - failed
    );
    let _ = writeln!(
        md,
        "Not yet covered (arrives with turn and flop solving, M4): chance-node and \
         suit-isomorphism checks on turn/flop trees.\n"
    );
    for s in &sections {
        let _ = writeln!(
            md,
            "## {}\n\n{}\n\n| Check | Expected | Measured | Result |\n|---|---|---|---|",
            s.title, s.intro
        );
        for c in &s.checks {
            let result = if c.pass { "pass" } else { "**FAIL**" };
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
        "validate: wrote {out}: {}/{total} checks passed in {:.0}s",
        total - failed,
        start.elapsed().as_secs_f64()
    );
    if failed > 0 {
        Err(format!("{failed} validation check(s) failed"))
    } else {
        Ok(())
    }
}
