# OpenRange — State log

Newest entry first. Each entry: date, milestone, what works, what doesn't, next step.

## 2026-10-24 — M3 complete: river solver

**Works (verified):**
- Betting-tree builder: bet sizes as % of pot, raises as % of the pot after calling, all-in
  threshold, minimum raises, raise caps, rake with cap, chance nodes for later streets.
- Vectorized DCFR over hands with O(n) fold/showdown evaluation and exact card removal;
  exploitability (NashConv/2) in chips, bb and % of pot; memory estimator.
- Validation (`docs/VALIDATION.md`, 57/57): polarized toy game matches MDF P/(P+B) and bluff
  share B/(P+2B) within 0.01 at 33%, 75% and 150% pot; on 12 random river spots the
  vectorized exploitability equals an independent tabular best response (max difference
  ~1e-5 chips) and an independent tabular solve reaches the same value; suit relabelling,
  identical-range symmetry, determinism and regression goldens all pass.
- The committed WASM reproduces the native goldens bit for bit (Vitest).
- Performance: a 290 × 433-hand river spot with 20 decision points runs 1,000 iterations in
  ~0.3 s natively and at about the same speed in the browser (measured once, this machine).
- Web: River solver page (#/solver): spot form, memory check before allocating, live
  progress, pause/resume/cancel, provenance badge, node browser with a 13×13 strategy grid
  and per-combo strategy and EV. Playwright tests cover solving, browsing and the memory
  refusal.
- CLI: `solver-cli solve <spot.json>`, `solver-cli gen-goldens`.

**Not done / not verified:** turn/flop (M4); the tree editor and opponent-range views are
basic; GitHub Actions still hasn't run.

**Next:** M4 — turn and flop solving with suit isomorphism, abstraction ladder, progress
for long solves.

## 2026-10-24 — M2 complete: CFR engine and validation report

**Works (verified):**
- Tabular CFR engine with DCFR (α=1.5, β=0, γ=2), CFR+ and vanilla CFR, alternating updates.
- Kuhn poker: all three algorithms reach the closed-form equilibrium (value −1/18,
  P(bet K) = 3·P(bet J), P(call with Q) = 1/3); DCFR exploitability 2.4e-5 after 10,000
  iterations.
- Leduc hold'em: exploitability falls at every checkpoint; DCFR 1.7e-4 at 1,000 and 7.9e-6
  at 10,000 iterations; game value −0.085606 (reported, no closed form).
- Best response: recursive implementation matches a brute force over every pure strategy
  exactly on 36 Kuhn cases.
- `solver-cli validate` (or `npm run validate`) runs everything (including the 133M-hand
  enumeration and equity checks) in ~35 s and writes `docs/VALIDATION.md`: 35/35 checks pass.

**Bug found and fixed on the way:** the first version recomputed an infoset's strategy
mid-iteration from already-updated regrets; Kuhn still converged but Leduc stalled
(exploitability 0.056 after 1,000 DCFR iterations). Fixed by snapshotting σᵗ per pass.

**Next:** M3 — river solver (vectorized over hands), toy-game theory tests (MDF, bluff
share), poker best-response cross-check, reference solver, minimal river workbench UI.

## 2026-10-24 — M1 complete: cards, evaluator, ranges, equity

**Works (verified):**
- 7-card evaluator: the full enumeration of all 133,784,560 seven-card hands reproduces the
  exact category counts (1.99 s, release build); 7,462 distinct hand values; 200,000 random
  5–7-card hands agree with an independent best-of-21 reference evaluator.
- Range parser/printer: pairs, `+`, dash runs, connector runs, `s`/`o`/both, single combos,
  weights; canonical printing; print→parse is exact on 500 random weighted ranges.
- Equity: exact hand-vs-hand and range-vs-range (O(n log n) per runout sweep, cross-checked
  against pairwise enumeration), seeded multiway Monte Carlo (agrees with exact within 4σ;
  symmetric 3-way ranges split evenly), turn results match a brute-force reference.
- Suit isomorphism helpers (canonical sets, stabilizers, combo-pair keys).
- `solver-cli gen-equity` writes the exact 169×169 preflop table with provenance
  (47,008 suit classes, ~160 s on 24 threads). AA vs a random hand = 85.20 %; mirrored
  cells sum to 1 within rounding.
- Web: Equity calculator page (#/equity) running in the worker: exact or Monte Carlo
  (with ± standard error), up to 6 players, board and dead cards, cancel button, live range
  validation. Playwright test covers it.

**Not done / not verified:** no browser performance measurements beyond manual use; the
GitHub Actions workflow still hasn't run.

**Next:** M2 — tabular CFR (DCFR, CFR+), Kuhn and Leduc validation, VALIDATION.md generator.

## 2026-10-24 — M0 complete: scaffolding

**Works (verified on this machine, Windows 11, PowerShell 5.1):**
- `npm install` then `npm run dev` serves the app at http://localhost:5173. The page loads
  the Rust solver core as WebAssembly inside a Web Worker and shows a value computed there
  (1,326 two-card combos).
- `npm run check` passes: cargo fmt, clippy (`-D warnings`), cargo test, committed-WASM
  freshness, TypeScript typecheck, Vitest (4 tests, including one that loads the committed
  `.wasm`), license allowlist.
- `npm run test:e2e` passes: Playwright drives the system Edge against the production
  build (strict CSP) and asserts no requests leave localhost.
- `npm run build:wasm` rebuilds `web/public/wasm/` and records a source hash in
  `BUILD_INFO.json`.
- `docs/THIRD_PARTY_LICENSES.md` generated (all dependencies MIT/Apache/ISC-compatible).

**Environment set up:** Node 24.22.1, Rust 1.99.1 (MSVC host), VS 2022 Build Tools (C++),
wasm-bindgen-cli 0.2.129. The GNU Rust host was tried first and dropped (D-025).

**Not verified:** the GitHub Actions workflow has not run (no remote yet). The coverage gate
in CI is untested.

**Next:** M1 — cards, evaluator (with the 133,784,560-hand test), ranges, equity, preflop
equity table.

## 2026-10-24 — Planning (before M0)

- Wrote PLAN.md, ARCHITECTURE.md, DECISIONS.md (D-001 … D-024), CLAUDE.md, and skeletons for
  the remaining docs.
- Machine check: Windows 11 Pro, 31 GB RAM, 24 logical cores, git 2.54, winget available.
  **Node.js and Rust are not installed yet**; git has no user name/email configured.
- Found two older, unrelated folders in `C:\Users\aless\.vscode` (`gto-trainer`,
  `gto-wizard`). They are not git repos and are not used by OpenRange; left untouched.
- No code yet. Nothing is validated yet.
- Next: answers to the blocking questions, then M0.
