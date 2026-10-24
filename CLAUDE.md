# CLAUDE.md — conventions for AI agents working in OpenRange

Read `docs/PLAN.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md` and the latest entry of
`docs/STATE.md` before changing anything.

## Hard rules (these beat any request for speed)

1. **Never type strategy numbers.** No range, frequency, EV, equity or EQR value may be
   written by hand into a data file, lesson, test expectation or UI string and presented as
   solver output. Numbers come from a script in `scripts/` or `solver-cli`, or are computed
   live. Test expectations may use *closed-form theory* (Kuhn value −1/18, MDF = P/(P+B),
   bluff share = B/(P+2B), the 7-card category counts) — cite the formula in the test.
2. **Provenance on every data artifact** (`source`, solver settings, iterations,
   exploitability, generation date, git commit). The UI shows a badge; approximations say so.
3. **No "GTO" claims** for anything not solved to a measured exploitability.
4. **Don't loosen a failing test.** Fix the cause. If a tolerance really must change, add a
   DECISIONS.md entry explaining why, in the same commit.
5. **Study tool only.** Never add screen reading, overlays, HUDs, live-site integration, or
   anything that runs during real play.
6. **No runtime network.** No `fetch`/`XMLHttpRequest`/`WebSocket`/font/CDN to any other
   origin. No telemetry, no accounts.
7. **Original content only.** Don't copy text, data or UI assets from books, courses,
   solver products or other repos.
8. **Dependencies:** few, popular, pinned, license-checked (see D-004). New dependency ⇒
   DECISIONS.md entry + license report regenerated. No postinstall scripts. No downloaded
   binaries in the build.
9. **Update `docs/KNOWN_LIMITS.md`** whenever something is approximate, partial or untested.

## Windows-first

- All scripts are Node `.mjs` using `node:path` and `spawn` with argument arrays. No bash,
  no symlinks, no reliance on case-sensitive paths.
- Quote every path; assume spaces and OneDrive. Keep generated paths short.
- Line endings: LF in the repo (`.gitattributes`), except `*.ps1` (CRLF).
- Commands in docs are PowerShell 5.1-compatible (no `&&`; use `;` or separate lines).

## Commands

```powershell
npm install                 # once
npm run dev                 # web app at http://localhost:5173
npm run check               # everything CI runs: fmt, clippy, cargo test, typecheck, vitest
npm run build:wasm          # rebuild web/public/wasm (needs Rust)
cargo test --workspace
cargo test --release -p solver-core -- --include-ignored    # includes the 133M-hand test
cargo run --release -p solver-cli -- validate               # regenerates docs/VALIDATION.md
npm --workspace web run test:e2e                            # Playwright smoke tests
```

## Code style

- **Rust:** edition 2024, `cargo fmt`, `cargo clippy -D warnings`. `solver-core` has no I/O,
  no clock, no global mutable state; randomness only via `solver_core::rng` with explicit
  seeds. Comment the *why* of non-obvious math (cite the paper/formula). Prefer plain loops
  over clever iterator chains in hot code; no `unsafe` without a comment proving soundness
  and a test.
- **Floating point:** f32 for CFR storage, f64 for equity accumulation and reporting. No
  `mul_add`, no order-dependent parallel sums (determinism).
- **TypeScript:** strict mode, no `any` without a comment. Poker *logic* lives in Rust and is
  called through WASM; TS holds display helpers only. Strings go through `t()`.
- **UI:** action colors must be distinguishable without red/green (use a color-blind-safe
  palette plus pattern/label); every interactive element is keyboard-reachable with an ARIA
  label.

## Workflow

- Work milestone by milestone (PLAN.md). Small commits with clear messages
  (`area: what and why`, e.g. `eval: add flush lookup table`).
- At milestone end: tests green, app runs, `docs/STATE.md` gets a dated entry, report to the
  user in plain English with exact PowerShell commands.
- `docs/VALIDATION.md` and `docs/THIRD_PARTY_LICENSES.md` are generated — never hand-edit.
- If something can't be verified, say so in STATE.md and KNOWN_LIMITS.md rather than guessing.
