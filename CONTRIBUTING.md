# Contributing to OpenRange

Thanks for helping. OpenRange is a study tool whose value depends on its numbers being right, so
the rules below come first. `CLAUDE.md` has the same rules in more detail.

## The rules

1. **Never type strategy numbers.** Ranges, frequencies, EVs, equities and realization factors
   come from a script in `scripts/`, from `solver-cli`, or are computed live. Tests may use
   closed-form theory (cite the formula).
2. **Provenance on every data file:** source, solver settings, accuracy, date, commit.
3. **No "GTO" claims** for anything not solved to a measured exploitability.
4. **Don't loosen a failing test.** Fix the cause. If a test must change, explain why in
   `docs/DECISIONS.md` in the same commit.
5. **Study tool only.** No screen reading, overlays, HUDs, live-site integration, or anything that
   runs during real play.
6. **No runtime network requests, telemetry or accounts.**
7. **Original content only:** no text, data or assets from books, courses or other tools.
8. **Few, pinned, license-checked dependencies.** A new dependency needs a DECISIONS entry and a
   regenerated `docs/THIRD_PARTY_LICENSES.md` (`npm run licenses`).
9. **Update `docs/KNOWN_LIMITS.md`** whenever something is approximate, partial or untested.
10. **Lessons:** numbers only through `{{calc …}}` and `{{eq …}}`; the lesson lint bans typed
    numbers and percentages. Record each lesson's key claims in `docs/LESSON_REVIEW.md` and pin
    chart or solver claims with a test.
11. **Coaching text never contradicts the data:** explanations are built from typed claims and
    each claim is re-checked against the raw numbers in tests.

## Setup (Windows, PowerShell)

```powershell
winget install OpenJS.NodeJS.LTS
git clone https://github.com/hi-204/openrange.git
cd openrange
npm install
npm run dev
```

Rust is only needed to change the solver: see "Rebuilding the solver" in the README. After any
change to `crates/solver-core` or `crates/solver-wasm`, run `cargo fmt` and
`node scripts/build-wasm.mjs` (a check compares the committed WebAssembly with the sources).

## Before you commit

```powershell
npm run check              # format, lint, Rust tests, typecheck, unit tests, licenses
npm run test:e2e           # browser tests (uses the Edge that comes with Windows)
npm run screenshots        # if the UI changed
cargo run --release -p solver-cli -- validate   # if solver code changed (writes docs/VALIDATION.md)
```

Keep commits small and explain the *why*. Comment the reasoning behind non-obvious solver maths
(cite the paper or formula). New decisions go in `docs/DECISIONS.md` (numbered, with context and
the decision); progress goes in `docs/STATE.md`.

## Style

- **Rust:** edition 2024, `cargo fmt`, `cargo clippy -D warnings`; `solver-core` has no I/O, clock
  or global state; randomness only through `solver_core::rng` with explicit seeds.
- **TypeScript:** strict; match the surrounding code (no formatter is enforced, so don't run one
  over whole files).
- **Scripts:** Node `.mjs` with `node:path` and argument arrays; quote paths; Windows-first.
- **Text:** plain English, every user-facing string in `web/src/lib/i18n/en.json`.
