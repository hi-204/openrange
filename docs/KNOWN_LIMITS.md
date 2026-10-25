# OpenRange — Known limits

This is the honest list of what OpenRange does **not** do, does only approximately, or
hasn't verified. The app links here from every approximation badge. If something is
missing from this list, that is a bug.

_Status 2026-10-26 (M6): postflop solving and push/fold are validated; the trainer grades push/fold and postflop drills by EV loss; the cash-game charts use measured equity realization (EQR v2) but early positions still open slightly less than the sanity bands (D-050), so they are practice only._

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

## Preflop

- **Heads-up push/fold** is exact for its model: blinds 0.5/1, optional antes, only the two
  players' decisions are solved (everyone else folds). With payouts it uses ICM
  (Malmuth–Harville); a player who busts takes the lowest remaining prize, shared equally if
  two bust in the same hand (real tie-breaks use starting stacks).
- **3–6-handed push/fold** is approximate: equal stacks only, chip EV only, strategies per hand
  class (not per combo), solved by sampling; CFR with 3+ players has no equilibrium
  guarantee. The reported best-response gain is a sampled estimate of single-decision
  deviations.
- **6-max cash charts (EQR v2) are approximate and partly outside the sanity bands.** At 100 bb
  the button opens 44.7% (band 40–50%). UTG, HJ and CO open 12.6 / 16.1 / 22.7%, about 1.5–2
  points under their bands (D-050). Cash charts are not used for EV-graded drills.
  - **How realization is measured:** per hand class from OpenRange's own postflop solves
    (D-048), on 60 flops with a one-size tree and no raises. A raise ablation found raises
    change the factors little (D-049).
  - **Sampling error:** each factor has a standard error of about 0.04–0.10.
  - **Unstable role:** the button flatting a CO open is nearly empty in every round, so its
    factors are unstable.
  - **Measured at 100 bb only:** the 20/40/60 bb charts reuse the 100 bb factors.
  - **Extrapolations:**
    - factors measured against one opener are reused against every opener (BB defends only 23%
      against UTG, which looks low);
    - 4-bet+ pots reuse 3-bet factors;
    - multiway flops reuse single-raised factors and approximate equity from heads-up matchups.
  - **Circularity:** the ranges come from the previous round's charts; three rounds were run
    and stopped by a rule fixed in advance.
  - **Tree simplifications:** no limps, at most one cold caller, no cold 4-bets or cold calls
    of 3-bets, rake-free.
- **Charts are per class.** Within a class, suits can matter slightly (card removal); the
  exact heads-up charts average their combos.

## Trainer

- **Preflop grading is per hand class.** The dealt combo shows real suits, but the charts
  (and so the grade) don't distinguish them.
- **What gets graded:** heads-up push/fold (exact) and 3–6-handed push/fold (approximate,
  with a sampling allowance, D-052). Cash charts are **practice only** (D-050): you see the
  answer, but it isn't graded, counted in stats or scheduled.
- **Explanations for 3–6-handed and cash spots** stop at the EVs, the mix and the sampling
  note. The pot-odds and shove breakdowns are only given heads-up, where they are exact.
- **Postflop spots are a small fixed set.** The ranges and bet sizes are example inputs (one
  or a few sizes, limited raises), solved in the browser. The flop spot takes about 30 s to
  solve.
- **Postflop decisions off the solution's path are not graded.** With your hand, the solution
  reaches the point less than 1% as often as it holds the hand there. Its numbers at such
  points aren't a reliable reference.
- **Before the river, the pot-odds sentence uses only your current equity.** It ignores the
  betting still to come; the grade always uses the solver's EVs.
- **Category thresholds are conventions** (D-052), not facts about poker. They can be changed
  on the Review tab.
- **Scheduling is simple SM-2 per spot family** (D-054). No placement quiz or daily plan
  yet (M7).
- **Stats need at least 30 graded answers per group** before showing numbers. A leak is only
  reported when the intervals separate (D-055).
- **No lessons yet.** The "related lesson" line names the topic; lessons arrive in M7.
- **Trainer data stays in this browser.** Clearing site data deletes it. Use Export on the
  Review tab to keep a copy.

## Not yet verified

- **River solver:** heads-up only; one bet-size list per player per street (no separate
  donk or probe sizes yet); strategies are stored as 32-bit floats. A solve stops at the
  exploitability target (default 0.3% of the pot in the app) or the iteration limit, and the
  result badge always shows which.
- **Turn and flop solving are slow** (single-threaded, 32-bit storage; D-038). In the browser a
  small flop tree (one bet size per street, no raises, narrow ranges) takes about a minute;
  bigger flop trees can take far longer or need more memory than a browser allows. Use the
  "simplify automatically" option (it lists every simplification) or the command-line solver.
- **Simplified trees:** when the abstraction ladder runs, the solution is for the simpler tree
  (fewer sizes or raises), not the one entered. The UI says so in a warning and on the badge.
- **Suit isomorphism at chance nodes** shows only one representative card per group of
  equivalent cards (marked +N); browsing a specific suit of a merged card isn't possible yet.
- **No separate donk/probe sizes**, and the same bet-size list applies on every node of a
  street for a player.
- **Node browser:** strategies are shown for the acting player only; there is no "opponent
  range at this node" view yet (M9 workbench).
- Browser performance has only been checked informally on one machine (Ryzen AI 9 HX 370).
