# OpenRange — Decision log

Each entry: **context → decision → why → alternatives considered**. Entries are never
deleted; a reversed decision gets a new entry that supersedes the old one. Any loosened
test tolerance must be recorded here with the reason.

---

### D-001 · Follow the target stack from the spec
**Decision:** Rust (`solver-core`, `solver-cli`, `solver-wasm`) + TypeScript/React/Vite/
Tailwind/Zustand/Dexie/Vitest/Playwright, PWA, heavy work in Web Workers.
**Why:** It is the stack requested and it fits: Rust gives predictable memory and speed in
both WASM and native; one solver codebase feeds the app and the chart pipeline.
**Deviations so far:** none.

### D-002 · Project folder `C:\Users\aless\openrange`
**Context:** The session started in `C:\Users\aless\.vscode`, which is VS Code's own
settings/extensions folder. OneDrive is at `C:\Users\aless\OneDrive`.
**Decision:** Create the repo at `C:\Users\aless\openrange` (short path, no spaces, not
synced). **Why:** `node_modules` and Cargo `target/` produce tens of thousands of files;
OneDrive syncing them is slow and can lock files mid-build; a short root keeps us far from
the 260-character path limit. The repo still *works* inside OneDrive (README documents this).
**Alternatives:** inside `.vscode` (mixes with editor config, rejected); inside OneDrive
(works, slower, documented as supported).

### D-003 · Write our own solver core
**Decision:** No third-party solver code. postflop-solver (AGPL-3.0) is not used, copied,
or vendored. Algorithms come from published research (CFR, CFR+, DCFR) and standard
techniques (vectorized traversal, prefix-sum terminal evaluation); the implementation is ours.
**Why:** Keeps licensing simple (permissive), keeps every line reviewable by us, and the
spec prefers it. **Cost:** more work in M3–M4; mitigated by the validation suite.

### D-004 · License: MIT
**Decision:** All OpenRange code and lesson content under MIT. `NOTICE` lists third-party
dependencies; `scripts/license-report.mjs` generates `docs/THIRD_PARTY_LICENSES.md`.
**Allowed dependency licenses:** MIT, Apache-2.0, BSD-2/3, ISC, Zlib, Unicode-3.0, MPL-2.0
(file-level, unmodified only). Anything else needs a new decision entry.
**Alternatives:** AGPL-3.0 (only needed if we used postflop-solver; rejected with D-003).

### D-005 · Rust toolchain on Windows: GNU host, pinned stable
**Status:** superseded by D-025.
**Decision:** Development uses rustup with the `stable-x86_64-pc-windows-gnu` host
toolchain plus the `wasm32-unknown-unknown` target, pinned in `rust-toolchain.toml`.
**Why:** The MSVC host needs Visual Studio Build Tools (several GB, admin install). The GNU
host ships its own linker; our dependencies are pure Rust, and the WASM target uses
`rust-lld` either way. Users never need Rust (prebuilt WASM is committed). The README
documents both options; MSVC works too.

### D-006 · Node.js 24 LTS
**Decision:** `engines.node >= 22`, `.nvmrc` = 24, developed and verified on 24.x.
**Why:** Current LTS line; Vite and Vitest require modern Node.

### D-007 · npm workspaces with a root `package.json`
**Decision:** Root `package.json` declares workspace `web` and forwards scripts, so
`npm install` then `npm run dev` at the repo root just works. **Why:** the spec's one-command
start. **Alternatives:** pnpm/yarn (extra install step for the user, rejected).

### D-008 · All scripts are Node `.mjs`
**Decision:** No bash/PowerShell-only scripts in the build. `scripts/*.mjs` use `node:path`,
`node:child_process` with argument arrays (no shell string concatenation).
**Why:** Paths with spaces, OneDrive, PowerShell vs CMD differences.

### D-009 · Prebuilt WASM committed to `web/public/wasm/`
**Decision:** Commit wasm-bindgen output (`--target web`). The worker loads it with a
runtime dynamic import of `/wasm/solver_wasm.js` (marked `@vite-ignore`). A CI job rebuilds
and fails if the committed artifact is stale (hash compared against a recorded source hash).
**Why:** `npm install && npm run dev` must work without Rust.
**Tooling pin:** `wasm-bindgen` crate pinned with `=x.y.z`; the CLI is installed with the
exact same version (`cargo install wasm-bindgen-cli --version x.y.z --locked`). No
`wasm-pack`, no `wasm-opt` download (D-020).

### D-010 · Single-threaded WASM inside a Web Worker
**Decision:** No WASM threads. **Why:** threads need `SharedArrayBuffer`, which needs
cross-origin isolation headers (COOP/COEP); that complicates static hosting and the PWA and
adds failure modes for a beginner. Native CLI uses rayon for heavy pre-generation instead.
**Revisit:** M10 performance pass, if river/turn solves are too slow.

### D-011 · WASM memory budget
**Decision:** Default solve budget 1.0 GB, user-adjustable up to 3 GB (wasm32 maximum is
4 GB; browsers and phones may give less). The estimator refuses solves over budget before
allocating; allocation failures are caught and reported, never a silent tab crash.

### D-012 · Internal chip unit = 1/100 bb
**Decision:** Pot, stacks and bets are integers in centi-bb inside the tree builder; bet
sizes rounded to the unit. **Why:** exact, deterministic tree construction and equality of
bet sizes; floating-point only inside CFR values.

### D-013 · Own PRNG
**Decision:** SplitMix64 for seeding + xoshiro256** for streams, implemented in
`solver-core::rng`, with known-answer tests. **Why:** `rand` crate algorithm/output changes
across versions would silently change "reproducible" outputs. Also removes a dependency.

### D-014 · Exploitability defined as NashConv / 2
**Decision:** `Σᵢ (BRᵢ(σ̄₋ᵢ) − uᵢ(σ̄)) / 2`, reported in bb and % of the starting pot.
**Why:** equals the usual `(BR₁ + BR₂ − pot)/2` in constant-sum spots, and stays meaningful
with rake (which makes the game non-constant-sum).

### D-015 · Two-player postflop only for exact solving
**Decision:** Exact solving is heads-up. Multiway tools are equity/realization heuristics
labeled "non-equilibrium". **Why:** spec; CFR has no Nash guarantee for 3+ players and trees
explode.

### D-016 · 100 bb cash charts: rake-free baseline first
**Decision:** First Tier B chart set is rake-free; a raked set (configurable %, cap, no
flop-no-drop) is generated as a separate, labeled family. **Why:** rake-free is the cleanest
target to validate; rake values differ by site and stakes, so a raked set must state its
assumptions explicitly. The spec's sanity bands are checked against both and differences
explained in VALIDATION.md.

### D-017 · Tier B preflop uses an EQR model; parameters are labeled
**Decision:** EQR v1 parameters are authored model inputs (documented per value, flagged
`authored` inside the chart's `model` block while the chart itself is `solver_approx`).
EQR v2 calibrates them from our own postflop solves on a sampled flop set. A sensitivity
report shows how RFI frequencies move under ±10 % EQR changes.
**Why:** a full preflop+postflop 6-max solve is out of reach for a local tool; being explicit
about the model is the honest alternative.

### D-018 · Multiway push/fold labeled approximate
**Decision:** HU push/fold (chip EV and ICM) = `solver_exact` (exact equities, exploitability
measured ≈ 0). 3–6-handed = `solver_approx`: CFR with Monte-Carlo multiway equities (seeded,
standard error reported) and per-player best-response gain reported.

### D-019 · Spaced repetition: SM-2 variant
**Decision:** SM-2 style scheduling per *spot family* (e.g. "BTN vs BB 3-bet, 100 bb"),
grade mapped from EV-loss category. **Why:** small, transparent, easy to test. FSRS can be
swapped in later behind the same interface.

### D-020 · No downloaded binaries in the build
**Decision:** Everything is built from crates.io/npm sources. Exceptions, documented and
optional: Playwright browser download (`npx playwright install chromium`, from Microsoft's
official CDN, dev/test only). No postinstall scripts of our own.

### D-021 · CI on GitHub Actions
**Decision:** `.github/workflows/ci.yml` runs on `windows-latest` and `ubuntu-latest`.
It runs only if the repo is pushed to GitHub; locally `npm run check` runs the same steps.

### D-022 · Lessons: markdown-it with small in-house plugins
**Decision:** markdown-it (MIT) + our own plugins for math (calls KaTeX), widget fences and
glossary terms; front-matter parsed with `yaml` (ISC). **Why:** few dependencies, full control
over the widget syntax. **Alternatives:** MDX (heavier toolchain), react-markdown + remark/
rehype (many transitive packages).

### D-023 · i18n: in-house `t()`
**Decision:** Strings in `web/src/lib/i18n/en.json`, a typed `t(key, params)` helper; lessons
live in per-locale folders. **Why:** no dependency needed for one language; easy to migrate
to i18next later.

### D-024 · PWA via vite-plugin-pwa
**Decision:** Use vite-plugin-pwa (MIT, Workbox) with a precache-everything strategy and no
runtime caching of external origins (there are none). Added in M10; nothing before M10
depends on it.

### D-025 · Rust toolchain on Windows: MSVC host (supersedes D-005)
**Context:** With the GNU host, crates that use `raw-dylib` (current `windows-sys`,
`getrandom` 0.3 — pulled in by `wasm-bindgen-cli` and `proptest`) need GNU `dlltool`, which
in turn needs an assembler (`as.exe`) that rustup's self-contained MinGW does not ship. The
claim in D-005 that "our dependencies are pure Rust" was wrong for dev tooling.
**Decision:** Use the standard `x86_64-pc-windows-msvc` host with Visual Studio 2022 Build
Tools (C++ workload). Version still pinned by `rust-toolchain.toml` (1.99.1).
**Why:** It is the officially recommended Windows setup and every crate builds with it.
Users who only run the app still need neither (prebuilt WASM, D-009).

### D-026 · Playwright uses the system Microsoft Edge on Windows
**Decision:** Locally on Windows, Playwright drives the preinstalled Edge (`channel: msedge`),
so no browser binary is downloaded. CI (and `PW_BROWSER=chromium`) uses Playwright's
Chromium, installed explicitly in the workflow. **Why:** D-020 (no downloaded binaries in
the user's build).

### D-027 · Randomized property tests with our own seeded RNG (no proptest)
**Decision:** Property tests (evaluator vs reference, range round trips, equity method
agreement) use `solver_core::rng` with fixed seeds instead of the `proptest` crate.
**Why:** one fewer dependency tree (proptest pulls in `rand`/`getrandom`); fixed seeds make
failures reproducible by construction. **Cost:** no automatic shrinking of failing cases;
tests print the failing input instead.

### D-028 · serde_json at the CLI/WASM boundary only
**Decision:** `serde_json` (MIT/Apache-2.0) is used by `solver-cli` and `solver-wasm`;
`solver-core` stays dependency-free. `rayon` (MIT/Apache-2.0) is used only by `solver-cli`.
**Cost:** WASM grew from 19 KiB to 234 KiB (uncompressed), acceptable for a one-time load.

### D-029 · Equity "auto" mode threshold
**Decision:** Exact enumeration when two players and runouts × live combos ≤ 3·10⁷,
otherwise Monte Carlo with 200,000 samples (seed shown in the UI). **Why:** keeps the
browser responsive (well under a second for exact) while giving exact answers for most
postflop spots. Monte Carlo results always display their standard error.

### D-030 · How validation thresholds are set
**Decision:** Where theory gives an exact answer (Kuhn value −1/18, equilibrium structure,
7-card counts) the test compares against theory with a stated tolerance. Where it doesn't
(Leduc), thresholds are set from a measured run with roughly 5× margin, and the measured
value at the time is written next to the threshold in the report. Thresholds are never
relaxed to make a failing run pass without a new entry here.

### D-031 · Bit-identical results across platforms
**Decision:** The default DCFR discount factors are computed with sqrt, × and ÷ only
(t^1.5 = t·√t, x^2 = x·x), never the platform `powf`, and every summation has a fixed
order. **Why:** `powf` differs in the last bit between math libraries (MSVC, glibc,
WebAssembly), which would make "reproducible" outputs differ between the CLI that
generates data and the browser that displays it. Non-default exponents fall back to `powf`
and are documented as not bit-reproducible across platforms.

### D-032 · Regression goldens are fingerprints, not tolerances
**Decision:** `data/goldens/river.json` stores, per spot, an FNV-1a hash of all strategy-sum
bits after a fixed number of iterations, plus EVs and exploitability. Tests require an
exact fingerprint match in native (`cargo test`) and WASM (`npm test`) builds. An
intentional solver change regenerates the goldens (`solver-cli gen-goldens`) in the same
commit, with the reason in the message.

### D-033 · Optional `json` feature in solver-core
**Decision:** The spot JSON format lives in solver-core behind `features = ["json"]`
(enabled by solver-cli and solver-wasm via the workspace dependency). **Why:** one parser
for the CLI, the browser and the golden files; the default core build stays dependency-free.

### D-034 · EVs shown per action are spot-relative
**Decision:** Per-hand action EVs are in big blinds, measured from the start of the spot
(pot winnings minus chips put in after the spot began), given both players follow the
solved average strategies below the node. **Why:** it makes actions at one node directly
comparable (the difference is the EV loss used for grading in M6). The UI says so next to
every EV table.

### D-035 · Suit isomorphism only for range-symmetric relabellings
**Decision:** A suit permutation is used to merge chance outcomes only if it fixes the
starting board, the cards dealt so far, and both players' range weights combo by combo.
**Why:** merging is only exact when the two subgames really are the same game relabelled;
user ranges with specific suited combos (e.g. only AhQh) break the symmetry, and the solver
then quietly keeps the affected cards separate.

### D-036 · Per-street raise caps
**Decision:** `max_raises` is per street (`maxRaises` accepts one number or
`{flop, turn, river}`). **Why:** typical study trees allow raises on the flop but not on later
streets, and the abstraction ladder needs to remove raises street by street.

### D-037 · Exploitability checks take at most ~10% of solve time
**Decision:** The browser worker measures exploitability at most every max(0.4 s, 10× the
last measurement's duration) and reports iteration progress in between; the UI labels the
shown exploitability "at the last check". **Why:** a full best-response pass costs about two
iterations; measuring after every iteration made flop solves ~2.5× slower.

### D-038 · Performance work deferred to M10
**Decision:** No multithreading, SIMD or compressed storage yet. Measured on this machine:
a 58×91-hand flop with one size per street takes ~0.19 s per iteration natively and ~0.5 s in
the browser; a 229×324-hand flop with two flop sizes and raises on every street needs ~1.75 GB
and ~3.5 s per iteration natively. **Why:** correctness and validation first; the M10 pass
will add rayon parallelism over chance children for the CLI (deterministic summation order),
16-bit regret/strategy storage, and revisit WASM threads (D-010).

### D-039 · Test changes since M3 (recorded 2026-10-24, some after the fact)
CLAUDE.md rule 4 requires that changes to failing tests be recorded. These were not recorded
when made; this entry fixes that.
1. **`postflop/tree.rs` turn-tree test, expected chance-node count 2 → 3** (changed after a
   failure). The expectation was wrong: besides check-check and "OOP shoves, IP calls", a
   third line ("OOP checks, IP shoves, OOP calls") also reaches the river. Verified by
   printing the tree. The count is still checked exactly.
2. **Same test, an assertion replaced after a failure.** The original line forbade any river
   decision where OOP had put in the whole stack; it failed on a legitimate river shove after
   a turn check-check. It was first replaced by a narrower check (after a called turn all-in
   the river card leads straight to showdown), which lost coverage. Restored on 2026-10-24
   with a general property checked on flop, turn and river trees: an all-in player never
   acts; facing an all-in only fold/call is offered; below any node where both players are
   all-in there are only chance cards and the showdown; only the player with less in can
   fold. A positive control requires the legitimate river shove to exist.
3. **Browser test "simplifies a spot that does not fit": budget 2.2 MB → 2.68 MB** (changed
   after a failure). 2.2 MB was below the estimator's fixed overhead (~2.5 MB), so no
   simplified tree could fit and the test exercised the refusal path instead. The hand-picked
   2.68 MB depended on estimator constants; on 2026-10-24 it was replaced by a budget derived
   from the solver's own estimate shown in the UI (estimate − 1 kB).
4. **Adapted to app changes, not loosened:** the memory-refusal browser test unticks
   "simplify automatically" (the new default would otherwise simplify); the WASM goldens test
   passes the constructor's new `allowAbstraction` argument.
5. **Not regenerated when they could have been:** the M4 rewrite changed the river golden
   fingerprints (an extra f32 rounding in fold terminals); the code was fixed instead, and the
   goldens match bit for bit.
6. **New ignored test:** the flop reference check (`postflop/reference.rs`) is `#[ignore]` in
   debug builds because its tabular side takes ~40-80 s in release and far longer in debug.
   It runs in CI's release step (`--include-ignored`) and in `solver-cli validate`.
7. **Kuhn unit test 20,000 → 10,000 iterations,** so it runs exactly the configuration whose
   values were measured for D-040 (its tolerances were tightened at the same time).

### D-040 · Tolerances at about 5–10× the measured value
**Decision (2026-10-24):** every tolerance on a deterministic check is about 5–10× the value
measured when it was set, and the measured value is printed next to it in VALIDATION.md.
Where the measured value is exactly 0 a fixed floor of 1e-6 is used; for agreement between
the vectorized solver and the tabular reference on game value, the tolerance is
max(10 × measured, 0.01 chips), because that difference reflects convergence of two solvers
rather than arithmetic noise. (Pot in these spots is 1000 chips = 10 bb.)

| Check | Before | Measured | Now |
|---|---|---|---|
| Kuhn exploitability, 10k iterations (worst: CFR) | 2e-3 | 1.1e-4 | 1e-3 |
| Kuhn value vs −1/18 | 3e-3 | 8.0e-6 | 5e-5 |
| Kuhn \|P(bet K) − 3α\| | 0.03 | 4.2e-4 | 3e-3 |
| Kuhn \|P(call with Q) − 1/3\| | 0.03 | 3.7e-4 | 3e-3 |
| Kuhn P(open Q) (now also in the report) | 0.02 | 7.5e-4 | 5e-3 |
| Toy game \|call − MDF\| | 0.01 | 6.0e-5 | 5e-4 |
| Toy game \|bluff share − B/(P+2B)\| | 0.01 | 1.2e-4 | 1e-3 |
| Toy game value hands bet | > 99% | 100% | > 99.99% |
| Toy game exploitability | 0.05% pot | 0.0019% | 0.01% |
| River unit test exploitability after 1000 | 0.1% pot | 0.0047% | 0.03% |
| River reference: best-response difference | 0.01 chips | 1.9e-5 | 1e-4 |
| River reference: value difference | 2 chips | 1.9e-3 | 0.02 (10×) |
| Turn reference: best-response difference | 0.01 chips | 2.6e-5 | 2e-4 |
| Turn reference: value difference | 2 chips | 1.9e-4 | 0.01 (floor) |
| Flop reference (new): best-response difference | — | 6.5e-5 | 5e-4 |
| Flop reference (new): value difference | — | 1.9e-4 | 0.01 (floor) |
| Suit relabelling: EV and strategy | 1e-3 | 0 | 1e-6 |
| Identical ranges split the pot | 1e-3 | 0 | 1e-6 |
| Rake taken from the pot | 1e-2 | 0 | 1e-6 |
| Isomorphism on/off: EV | 0.05 chips | 2.3e-4 | 2e-3 |
| Isomorphism on/off: exploitability | 0.05 chips | 2.6e-3 | 0.02 |
| Turn convergence after 200 | 1% pot | 0.049% | 0.25% |
| Preflop table: mirrored sums (unrounded) | 1e-9 | 2.2e-15 | 1e-12 |

**Kept as they were, and why:**
- *Flop convergence < 2% of pot after 60 iterations* (measured 0.57%, i.e. 3.5×): kept at the
  owner's request. Note that this threshold was chosen **after** seeing a browser run of the
  same spot (0.63% after 64 iterations), so it is informed by data rather than set blind.
  A separate check now requires exploitability to fall at each of 6 checkpoints
  (5, 10, 20, 30, 45, 60).
- *Isomorphism on/off root strategy < 1e-3* (measured 2.4e-4, 4.2×): slightly under 5×; kept
  rather than loosened.
- *Leduc 1e-3 at 1,000 and 5e-5 at 10,000 iterations*: already 7× and 8× the current
  measurements (1.4e-4 and 6.2e-6).
- *AA vs a random hand 85.2% ± 0.05 points*: the reference is an external figure quoted to
  one decimal; the tolerance is its rounding interval, not our noise (measured 85.2037%).
- *Statistical checks* (Monte Carlo vs exact |z| < 4, RNG uniformity 5σ): tolerances are in
  standard errors and must not shrink with the measured value.
- *Committed equity table mirrored sums ≤ 1e-6*: the stored values are rounded to 6 decimals.
- *Golden fingerprints and determinism*: exact equality.
- *Browser equity test (two displayed percentages sum to 100 ± 0.05)*: display rounding.
- *Isomorphism storage < half* (measured 0.46): a structural property, not a tolerance.

**Report-only rows** (values with no pass/fail criterion, e.g. the Leduc game value) are now
counted separately from checks in VALIDATION.md.

### D-041 · Debug builds of our own crates use opt-level 1
**Decision:** `[profile.dev] opt-level = 1` in the workspace (dependencies already used 2).
**Why:** the solver tests are numeric loops; at opt-level 0 the debug `cargo test` of
solver-core took ~86 s. Release builds, generated data and goldens are unaffected (they use
the release profile). Overflow checks and debug assertions stay on.

### D-042 · Combo-level preflop equities stored as exact integer counts
**Decision:** `data/equity/preflop-pairs.json` stores, for each of the 47,008 suit classes of
combo pairs (numbered by `solver_core::preflop::pairs::pair_classes()`), the hero's win and
tie counts out of 1,712,304 boards. **Why:** exact (no rounding), compact (~1 MB), and enough
to rebuild all-in equity for every ordered combo pair, which push/fold and the cash-game
model need with exact card removal.

### D-043 · Exact heads-up push/fold over combos
**Decision:** Heads-up push/fold is a two-decision game solved with DCFR over all 1326 × 1326
combo pairs (exact card removal, exact all-in equities from D-042), to an exploitability of
at most 1e-6 bb (chip EV) or a millionth of the largest payoff (ICM). Charts average the
combo strategies of each class. **Why:** it is small enough to solve exactly in seconds,
natively and in the browser, so there is no reason to approximate it.

### D-044 · One sampled-CFR engine for every other preflop tree
**Decision:** 3–6-handed push/fold and the 6-max cash model share one engine:
external-sampling MCCFR with information sets (decision node, hand class), linear averaging,
real cards and boards per iteration, and the exact heads-up all-in equity at two-way
showdowns (same expectation as a sampled board, far less noise). **Validation:** run with two
players it reproduces the exact heads-up solution closely enough that, judged by the exact
solver, its strategy is exploitable by 3.7e-4 bb per hand.

### D-045 · Best-response estimate for sampled solutions
**Decision:** Each seat's "best-response gain" is estimated by an evaluation pass on the
average strategies: per (decision, class), action values are sampled with the seat exploring
every action; the best action is chosen on one half of the samples and its gain measured on
the other (cross-validation), and each decision is weighted by the seat's own probability of
reaching it. **Why:** choosing and measuring on the same samples biased the estimate upwards
by the noise summed over thousands of decisions (it read ~2 bb per hand on a converged cash
solve); unweighted by own reach it counted improvements at decisions the seat never reaches.
The fixed estimator matches exact best responses within 2% on heads-up push/fold. It
measures single-decision deviations, so for trees where a seat acts several times it can
understate the full best-response gain; reports say so.

### D-046 · Cash model v1: EQR inputs authored, tree simplified, rake-free
**Decision:** The 100 bb (and 20/40/60 bb) 6-max charts use the EQR v1 factors in
`EqrModel::v1()` (authored, labelled `source: authored` inside the `solver_approx` chart),
hand-independent; multiway flops approximate each player's equity from heads-up matchups;
the tree has no limps, at most one cold caller of an open (blinds may always call), no cold
4-bets or cold calls of 3-bets, and only the previous raiser continues against 4-bets and
5-bets. **Outcome (recorded per the spec's sanity-band rule):** see D-047.

### D-047 · Cash v1 misses the late-position sanity bands; charts flagged, not tuned
**Context:** At 100 bb the generated first-in frequencies are inside the bands for UTG and HJ
but below them for CO and well below for BTN (≈32% against 40–50%).
**Investigation:** the big blind defends ≈81% of hands against a button open, far wider than
is plausible, which makes steals unprofitable. The cause is the hand-independent EQR: weak
offsuit hands out of position are credited with the same realization (0.84) as strong ones.
A sensitivity run with out-of-position realization ×0.9 moves the button to ≈40%.
**Decision:** do not tune EQR inputs until the bands are hit (that would be fitting authored
numbers to remembered outputs, which principle 1 forbids). The charts ship labelled
approximate with a prominent "outside the sanity checks" warning in the UI, and are excluded
from trainer grading until a calibrated model exists. **Next:** EQR v2 calibrated from
OpenRange's own postflop solves (owner's decision pending on scope/timing).

### D-048 · EQR v2: realization measured per hand class from our own postflop solves
**Context:** D-047 (v1's hand-independent realization makes the big blind over-defend). The
owner chose to calibrate rather than tune.
**Method (`solver-cli calibrate-eqr`, output `data/eqr/eqr-v2.json`):** four lines taken from
the 100 bb cash chart file: single-raised BTN vs BB and CO vs BTN; 3-bet BB vs BTN and BTN vs
CO. Each side's flop range is the chart's frequency for that line. Each line is solved with
the validated postflop solver on a seeded sample of 60 flops (D-049), distinct up to suit
relabelling, to ≤ 1% of the pot. The tree has one bet size per street (33% / 66% / 75% of pot),
no raises, and all-in above 67% of the stack. For each role (pot type × in position ×
preflop aggressor) and class, the factor is Σ EV share of the pot ÷ Σ all-in equity against
the opponent's range on that flop. The sums run over the class's combos on every flop, each
combo counted by how often it meets the opponent's range.
**Probe hands:** classes the chart doesn't play are added at weight 0.005. A hand's CFR
strategy doesn't depend on its own reach, so a probe hand plays its best line against an
essentially unchanged opponent. Its factor is the realization that class would get if it
were added to the range, which is what the preflop decision between calling and folding
needs. Without probes the first trial gave 161 of 169 classes the role average (the
hand-independent assumption v1 already failed on).
**Use in the preflop model:** heads-up flops use factor[pot type][in position][aggressor]
[class]. 4-bet+ pots use the 3-bet factors. Multiway flops use the single-raised factors with
"in position" meaning last to act. All three are extrapolations and are recorded in the
chart provenance.
**Circularity:** the ranges come from a chart solved with the previous model, so one
stability round is run: recalibrate from the v2 charts and compare the factors and the first-in
frequencies. The outcome is recorded below (D-050).
**Not done:** calibration only at 100 bb (shallower stacks reuse it); no rake; a one-size
tree (more sizes would let both players realize more); 60 flops (sampling error is reported
per role in the file).

### D-049 · EQR calibration: no raises in the tree, 60 flops
**Context:** the first full calibration (20 flops, tree without raises) fixed the button
(44.3% first-in at 100 bb) but pushed UTG/HJ/CO below their bands; in-position players 3-bet
about 10% against UTG. Hypothesis: with no raises the caller can never check-raise, so
c-betting any two cards can't be punished. That would inflate aggressor realization,
especially for junk hands (72o measured 1.7–2.9× its equity as the aggressor).
**Test (decided before looking at charts):** the same v1 input and the same 4 seeded flops,
solved with no raises and with one pot-sized raise allowed per street
(`calibrate-eqr --flops 4 --raises 0|1`).
**Result — hypothesis refuted:** role averages moved by ≤ 0.025. Class factors moved by
0.03–0.09 on average (combo-weighted). Aggressor junk did not drop (72o, single-raised OOP
aggressor: 2.89 → 2.97). The largest changes were for premium hands as callers (AA, BB vs
BTN: 2.04 → 2.44), which gain from check-raising. Flop sampling matters far more. The same
input with 4 vs 20 flops moved class factors by 0.18–0.44 on average. At 20 flops the
median jackknife standard error of a class factor is 0.07–0.16.
**Decision:** keep the tree without raises (`--raises 0`; raises need 3.4× the memory,
5.6 GB per solve, and about 3× the time) and spend the compute on 60 flops instead of 20.
That cuts the sampling error by √3. The raise option stays available and documented.

### D-050 · EQR v2 outcome: three rounds, button fixed, early positions slightly tight
**Rounds** (100 bb). Each round calibrates from the previous round's 100 bb chart; rounds 2
and 3 use 60 flops.

| First-in | v1 (authored) | Round 1 | Round 2 | Round 3 (final) | Band |
|---|---|---|---|---|---|
| UTG | 15.4% | 12.9% | 13.8% | 12.6% | 14–18% |
| HJ | 18.5% | 15.1% | 15.7% | 16.1% | 18–22% |
| CO | 23.0% | 21.3% | 23.3% | 22.7% | 24–29% |
| BTN | 31.8% | 44.3% | 41.1% | 44.7% | 40–50% |

BB defence against a BTN open went from 80.8% (v1) to 61%, then 54%, then 56%.

**Stopping rule (fixed before round 3 was run):** round 3's factors are final whatever they
show; no further rounds and no tuning toward the bands (D-047).

**Stability:** from round 2 to round 3, six of the eight roles moved by 0.03–0.09 per class on
average (combo-weighted), about the size of their standard errors (median 0.04–0.10). One role
is unstable: the button flatting a CO open, which moved 0.29 on average with 85 of 169 classes
beyond 2 SE. That range is nearly empty (the button flats 0.3–2.6% across rounds), so the CO's
strategy against it changes with every small change in its composition. The first-in
frequencies move by up to ±2 points between rounds 1–3, partly from this and partly from the
charts' own sampling.

**Outcome:** the button is inside its band. UTG, HJ and CO are 1.4–1.9 points below theirs in
the final charts (all three were below their bands in every v2 round).

**Observations not covered by any band:**
- BB defends only 23% against a UTG open (v1: 51%). The BB's factors are measured against a
  button range and reused against every opener, which is an extrapolation.
- In-position players 3-bet 8–10% against UTG and cold-call almost never. The tree allows at
  most one cold caller, and 3-bet pots reuse factors measured in BB-vs-BTN and BTN-vs-CO
  3-bet pots.

**Decision:**
- Commit the v2 charts for 20/40/60/100 bb, labelled `solver_approx` with model `eqr-v2`.
- The 100 bb file keeps its "outside the sanity checks" warning for UTG, HJ and CO.
- The 20/40/60 bb files reuse the 100 bb factors, and their stack depth isn't calibrated
  separately, which KNOWN_LIMITS says.
- Cash charts stay excluded from EV-graded trainer drills (as in D-047) until all four 100 bb
  bands pass. The trainer may show them as reference with the warning.

### D-051 · What the trainer grades
**Decision:**
- **Graded, preflop:**
  - Heads-up push/fold (`solver_exact`, chip EV).
  - 3–6-handed push/fold (`solver_approx`), with the noise allowance of D-052.
- **Graded, postflop:** "drill this spot". The browser solves a spot to its target
  exploitability, and every grade states that exploitability.
- **Not graded:** cash charts (D-050). They can be drilled as *practice*: the answer and the
  reference are shown with the out-of-band warning, but nothing enters stats or scheduling.
- Hands are dealt in proportion to how often the player reaches the decision with them
  (chart `reach`, solver reach), so nobody is quizzed on hands they would never hold there.
- Preflop charts are per hand class, so the dealt combo is graded by its class
  (KNOWN_LIMITS).
- **Postflop presets:** ranges must be suit-symmetric (written as classes). The drill maps
  real cards onto the solver's suit-isomorphic representative cards, which is only valid for
  such ranges. It checks this and refuses otherwise.

### D-052 · Grading rules
**EV loss** = EV(best action) − EV(chosen action) for the hand, taken from the reference's EVs.
It is measured in bb preflop and in % of the pot at the decision postflop.
- **Sampled references** (EVs with standard errors) are graded on
  max(0, loss − 2·√(SE_best² + SE_chosen²)). A difference the sampling can't resolve is never
  called a mistake. Both numbers are shown.
- **Postflop:** the Best threshold is at least the solve's exploitability (% of pot).
- **Mixed strategies:** if the reference plays the chosen action at least 10% of the time,
  the answer is **Best**. If that action isn't the most frequent one, it is labelled
  "lower-frequency". At equilibrium every action in the mix has the same EV. If the shown
  EVs differ by more than the Inaccuracy threshold anyway, the answer notes that the solution
  isn't fully converged there.
- **Categories** (defaults from ARCHITECTURE §7, adjustable in the trainer settings):
  | | Best | Acceptable | Inaccuracy | Mistake | Blunder |
  |---|---|---|---|---|---|
  | preflop (bb) | ≤ 0.02 | ≤ 0.10 | ≤ 0.30 | ≤ 1.0 | > 1.0 |
  | postflop (% of pot) | ≤ 1 | ≤ 3 | ≤ 8 | ≤ 20 | > 20 |

### D-053 · Explanations are claims with predicates
**Decision:** an explanation is a list of typed *claims* computed from the decision's numbers.
Text is rendered from a claim's fields only, through i18n templates. Each claim kind has a
predicate (`checkClaims`) that recomputes it from the raw data.
- **Tests:**
  - Seeded random synthetic decisions.
  - Every class at every stack of the exact heads-up charts.
  - Real nodes of a solved river spot.
- **Exact identities double as validation:**
  - Heads-up all-in call, chip EV: EV(call) − EV(fold) = equity · pot after calling − amount
    to call.
  - Heads-up shove: EV = P(fold)·(+1 bb) + P(call)·(2S·equity − S) per combo.
  - River call vs fold: EV(call) − EV(fold) = equity · (pot + call) − call.
  The pot-odds sentence must agree with the EVs wherever these identities hold.
- **Where they don't hold** (turn, multiway): the pot-odds check is labelled "raw equity
  only". If it disagrees with the solver, the text says that future betting is the reason
  and never contradicts the EV ranking.

### D-054 · Spaced repetition details (refines D-019)
- **Family** = drill + reference + decision + stack band; e.g. "heads-up push/fold · SB shove ·
  8–14 bb", or a postflop preset + street + "first to act"/"facing a bet".
- **SM-2 per family.** Answer quality: Best 5, Acceptable 4, Inaccuracy 3, Mistake 2,
  Blunder 1. Intervals in days: 1, 6, then × ease factor. Quality < 3 resets the family to
  "due in 10 minutes".
- Answers given before a family is due only count if they are lapses, so drilling one family
  many times in a session can't inflate its interval.
- **Picking the next spot:** an overdue family first (most overdue), otherwise a new family,
  otherwise the family due soonest. Always within the user's filters.

### D-055 · Statistics and leaks
- **Grouping:** by drill, position, scenario, street and hand class. Preflop (bb) and postflop
  (% of pot) are never mixed.
- **Per group:** n, mean EV loss with a 95% normal interval (sample SD, n ≥ 2), and the share of
  Mistakes + Blunders with a 95% Wilson interval.
- Below 30 graded answers a group shows "not enough data yet" and nothing else.
- **A leak** is reported only when the group's mean-EV-loss interval lies entirely above the
  interval of all the user's other answers in that unit.
- Practice (ungraded) answers are excluded.

### D-056 · Trainer storage
**Decision:**
- Dexie (IndexedDB, already a pinned dependency) holds answers, scheduling state and trainer
  settings, on this device only.
- The Review page can export everything as JSON, import it, and reset it.
- Unit tests use the same `TrainerStore` interface with an in-memory implementation.

### D-057 · M6 test thresholds, including the ones changed after seeing a run
- **Explanation identity tolerances.** Before the first run I set 0.002 bb for the heads-up
  identities (from the charts' 4-decimal rounding) and 0.005 bb for the river identity.
  - **Measured worst errors:** heads-up call 7.8e-5 bb and shove 6.0e-5 bb, over all 24 stacks
    × 169 classes. River 9.8e-6 bb (river test spot, 59 call decisions) and 8.1e-5 bb (river
    decisions of the turn test spot).
  - **Tightened** both to 5e-4 bb, about 6× the worst error (the 5–10× rule).
- **Suit-mapping test** (the iso vs non-iso solve).
  - **Before:** it required "> 1000 EV comparisons", a number I guessed before running. It
    failed with 828 comparisons, all of which agreed within 1e-3 bb.
  - **After seeing the run:** it compares *every* mirrored card instead of the first six, and
    requires each one to be compared on more than 50 hand/action pairs.
- **Heads-up explanation test timeout.** It failed once in the full parallel run under
  Vitest's default 5 s timeout. Alone it takes about 1.3 s; it competes with the postflop
  solves. It now has an explicit 60 s timeout, like the other heavy tests. Two further full
  runs passed.
