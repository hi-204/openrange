# OpenRange — Known limits

This is the honest list of what OpenRange does **not** do, does only approximately, or
hasn't verified. The app links here from every approximation badge. If something is
missing from this list, that is a bug.

_Status 2026-10-24 (M1): cards, evaluator, ranges and equity exist; no solver yet._

## By design

- **Study tool only.** No real-time assistance, screen reading, HUD or overlay; hand-history
  import is for review after a session.
- **Multiway postflop is not solved.** Tools for 3+ player pots are heuristics (equity,
  realization estimates) and are labeled non-equilibrium.
- **100 bb cash preflop charts are approximate** (`solver_approx`): they come from a preflop
  tree whose postflop play is modeled by equity realization (EQR) factors, not by solving
  every flop. The model and its parameters are documented with each chart.
- **3–6-handed push/fold charts are approximate**: multiway all-in equities are sampled, and
  CFR with 3+ players has no equilibrium guarantee; measured best-response gains are shown.
- **Flop solves in the browser may be abstracted** (fewer bet sizes or raises) to fit memory.
  The result says exactly what was reduced.
- **Single-threaded in the browser** (D-010). Big solves are faster in the native CLI.
- **Solver strategies are equilibrium approximations against an equally strong opponent.**
  They are not the most profitable play against a specific weak opponent.

## Current tools

- **Equity calculator:** exact enumeration is offered for two players only; 3–6 players use
  Monte Carlo sampling (200,000 deals by default), shown with ± one standard error.
  Preflop range-vs-range is usually Monte Carlo because exact enumeration would take too
  long in the browser.
- **Preflop equity table** (`data/equity/preflop-169.json`): exact, values rounded to
  6 decimals.

## Not yet verified

- The CFR solver doesn't exist yet (M2+). Validation results will appear in
  `docs/VALIDATION.md` (generated) as it is built.
- Browser performance has only been checked informally on one machine (Ryzen AI 9 HX 370).
