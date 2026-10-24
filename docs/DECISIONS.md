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

