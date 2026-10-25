# OpenRange — State log

Newest entry first. Each entry: date, milestone, what works, what doesn't, next step.

## 2026-10-25 — M6.5 done: design and UX pass

**Works (verified):**
- **Look and navigation:**
  - Design tokens (warm dark-first theme, iris accent), Inter bundled locally, tabular numbers.
  - Left rail on desktop and a bottom bar on phones (Home · Learn · Train · Play · Solve ·
    Stats · Settings); old links redirect.
- **Onboarding and modes:** first-run onboarding (skippable) sets Guided or Expert mode; the
  mode can be switched from the top bar.
- **Table:** a reusable `<PokerTable>` with our own SVG cards (two- and four-colour, three
  backs), chips, bets, pot, board with street labels, action history and a spot summary. It is
  used in the preflop and postflop drills and on the Play preview.
- **Coaching card after every answer in every drill** (D-065): verdict, why, key idea, next
  time, learn more, and "Show the math" with the 13×13 grid. Also available as
  "Explain this hand" in the workbench. Tests:
  - every heads-up decision, 3000 synthetic ones and 120 played river hands;
  - the recommended action is best in the data;
  - 0% actions are never praised;
  - mixed actions are never called mistakes, and "slightly more common" only for close mixes;
  - quoted numbers match the computed ones.
- **Drill flow:** hints, quick mode, an optional timer (ungraded on expiry), and a session
  summary with "drill my weak spots"; a math drill page.
- **Settings:** searchable, with presets, per-section reset, help text and advanced
  sections, plus a live memory estimate. They persist and are included in the backup.
- **Lesson reader:** table of contents, reading progress, objectives and recap, callouts,
  instant quiz feedback, practice links, and build-time equities (D-066). Sample lesson
  2.3 Pot odds; `docs/LESSON_REVIEW.md`.
- **Quality checks:**
  - axe accessibility checks pass on every main screen in both themes;
  - 8 visual baselines;
  - Playwright 38 e2e tests, Vitest 87 tests, `npm run check` passing;
  - 78 screenshots in `docs/screenshots/`.

**Not done / known issues:** KNOWN_LIMITS → Interface. Play mode is M9.

**Next:** M7 content (Levels 0–4, placement questions), which was paused for this pass.

## 2026-10-25 — M6 done: trainer

**Works (verified):**
- **Trainer page** (`#/trainer`) with Preflop, Postflop and Review tabs.
- **Preflop drill:**
  - Filters by chart set, position, situation, stack and difficulty. Hands are dealt in
    proportion to how often the player reaches the decision with them.
  - Spot families are scheduled by SM-2. Keyboard shortcuts: F/C/R, 1–9, Enter/N.
  - Heads-up and 3–6-handed push/fold are graded; cash charts are practice only.
- **Postflop drill:** solves a spot in the browser (river 0.4 s, turn about 0.5 s, flop about
  30 s), then plays hands against the solution. Real turn and river cards are mapped onto the
  solver's suit-isomorphic cards; tested against a solve without isomorphism, with identical
  EVs. Decisions off the solution's path aren't graded.
- **Grading:** EV loss in bb or % of the pot. Sampled references get an allowance, mixed
  actions are never marked wrong, and thresholds are tunable (D-052).
- **Explanations are checked claims (D-053).** Over every class and stack of the exact
  heads-up charts, the pot-odds and shove breakdowns match the chart EVs within 7.8e-5 bb.
  On 190 randomly played postflop hands every claim passes its predicate, and on the river
  the pot-odds identity holds within 8.1e-5 bb.
- **Review tab:** 95% intervals, "not enough data yet" below 30 answers, leaks only when
  intervals separate. Also the review schedule, recent answers, threshold settings, and
  export/import/reset.
- **Tests:** Vitest 47 tests; Playwright 14 tests (3 new for the trainer); `npm run check`
  passes.

**Not done / known issues:** see KNOWN_LIMITS → Trainer. Placement quiz, daily plan, math
drills and lessons come in M7. Cash charts stay practice only (D-050). The GitHub push and
Linux CI (item 8) still wait for the repo URL.

**Next:** M7 — lesson platform, Levels 0–4, math drills, placement quiz, daily plan.

## 2026-10-25 — M5 in progress: EQR v2 and cash charts

**Works (verified):**
- `solver-cli calibrate-eqr` measures equity realization per hand class from our postflop
  solves (D-048).
  - Every solve reaches ≤ 1% of the pot, and the players' EVs sum to the pot within 1.2e-7.
  - A raise ablation (D-049) showed the cheap tree is adequate.
- Three calibration rounds (D-050). Factors committed in `data/eqr/eqr-v2.json`; 6-max cash
  charts at 20/40/60/100 bb committed with model `eqr-v2`.
- The button now opens 44.7% at 100 bb (inside its band; v1: 31.8%). BB defence vs the button
  fell from 81% to 56%.
- Long generators now record provenance when they start.

**Not done / known issues:**
- UTG/HJ/CO open 1.5–2 points under their sanity bands.
- BB defends only 23% vs UTG.
- The button-flats-CO role is unstable.
- Cash charts stay out of EV-graded drills (KNOWN_LIMITS).

**Next:** M6 (trainer). The GitHub push and Linux CI (item 8) wait for the repo URL.

## 2026-10-25 — M5 in progress: preflop

**Works (verified):**
- Exact combo-pair preflop equities (47,008 suit classes, integer counts) and ICM.
- Exact heads-up push/fold (chip EV and ICM): the closed-form toy game matches theory within
  3.2e-5; every stack is solved to ≤ 1e-6 bb; combos that mix are indifferent within 5.9e-4 bb.
  Charts for 2–25 bb committed (`data/charts/pushfold-hu.json`).
- Sampled-CFR engine: with 2 players its strategy, judged by the exact solver, is exploitable
  by 3.7e-4 bb per hand; its best-response estimate matches exact best responses within 2%.
- 3–6-handed push/fold charts at 5/10/15/20 bb committed; estimated best-response gains are
  at the noise floor (|gain| ≤ ~0.02 bb).
- Web: Charts page (provenance badge with full details, approximate/out-of-band warnings,
  per-hand EV, greyed-out unreached hands, compare view) and a Push/fold calculator that solves
  any table with ICM in the browser in about a second. The browser solver reproduces the
  committed exact chart to its stored precision. Validation: 100 checks + separate sanity bands.

**Not done:** the 6-max cash charts (EQR v1) miss the CO and BTN sanity bands; they are held
back from the repository pending the owner's decision on calibrating EQR v2 (D-047).

**Next:** the EQR decision, then M6 (trainer).

## 2026-10-24 — Test-honesty pass (between M4 and M5)

- Every test change since M3 is recorded in D-039; every tolerance was re-measured and set
  to about 5–10× the measured value (D-040, with a before/measured/after table). The flop
  convergence threshold stays at 2% of pot, with a new check that it falls at 6 checkpoints.
- The narrowed turn-tree assertion's coverage is restored as a general "no betting after an
  all-in" property on flop, turn and river trees.
- New: an independent tabular reference check for flop spots (turn and river cards as
  explicit chance nodes): best-response difference ≤ 6.5e-5 chips, value within 1.9e-4 chips
  on 3 random spots. Slow (~40-80 s per spot), so ignored in debug builds; runs in release.
- The browser simplification test takes its budget from the solver's own memory estimate,
  which the Solver page now shows live under the budget field.
- VALIDATION.md counts real checks separately from report-only rows.
- 133M-hand enumeration (release, this machine): exact counts in 1.77 s.
- Not done: CI on GitHub (waiting for a repository URL).

## 2026-10-24 — M4 complete: turn and flop solving

**Works (verified):**
- Chance nodes for turn and river cards; suit isomorphism (only for relabellings that keep
  both ranges unchanged); per-street raise caps; automatic abstraction ladder; count-only
  memory estimate.
- Validation (`docs/VALIDATION.md`, 69/69): on 5 random turn spots the vectorized solver
  matches an independent tabular restatement with explicit river-card chance nodes
  (best-response difference ~3e-5 chips, same game value); isomorphism on vs off agrees
  (EV difference 2e-4 chips, root strategy within 2e-4) at less than half the storage;
  turn and small-flop solves converge; the abstraction ladder fits a 3.4 GB flop tree into
  10% of that, reporting each step; river goldens are unchanged bit for bit.
- Web: one Solver page for flop, turn and river spots: example presets, per-street sizes and
  raise caps, "simplify automatically" option with a warning listing what changed, card
  picker at chance nodes (merged suits shown as +N), progress with "at the last check".
  Playwright tests cover river, turn (dealing a river card), memory refusal and
  simplification.

**Measured (this machine, once):** small flop preset 58×91 hands, 191,844 game nodes, 130 MB,
~0.5 s per iteration in the browser, reached 0.63% of pot in ~38 s.

**Not done / not verified:** speed work (threads, SIMD, 16-bit storage) is deferred to M10
(D-038); GitHub Actions still hasn't run.

**Next:** M5 — preflop library: push/fold Nash (+ICM), the 100 bb EQR pipeline, provenance
badges and the chart explorer.

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
