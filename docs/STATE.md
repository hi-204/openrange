# OpenRange — State log

Newest entry first. Each entry: date, milestone, what works, what doesn't, next step.

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
