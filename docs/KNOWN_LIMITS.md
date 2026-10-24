# OpenRange — Known limits

This is the honest list of what OpenRange does **not** do, does only approximately, or
hasn't verified. The app links here from every approximation badge. If something is
missing from this list, that is a bug.

_Status 2026-10-24 (M3): river solving works and is validated; turn and flop arrive in M4._

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

- **River solver:** heads-up only; one bet-size list per player per street (no separate
  donk or probe sizes yet); strategies are stored as 32-bit floats. A solve stops at the
  exploitability target (default 0.3% of the pot in the app) or the iteration limit, and the
  result badge always shows which. Turn and flop solving are not available yet (M4).
- **Node browser:** strategies are shown for the acting player only; there is no "opponent
  range at this node" view yet (M9 workbench).
- Browser performance has only been checked informally on one machine (Ryzen AI 9 HX 370).
