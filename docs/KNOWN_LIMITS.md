# OpenRange — Known limits

This is the honest list of what OpenRange does **not** do, does only approximately, or
hasn't verified. The app links here from every approximation badge. If something is
missing from this list, that is a bug.

_Status 2026-10-25, version 1.0 (M10): postflop solving and push/fold are validated (docs/VALIDATION.md); the trainer grades push/fold and postflop drills by EV loss; the cash-game charts use measured equity realization (EQR v2) but early positions still open slightly less than the sanity bands (D-050), so they are practice only._

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
- **Scheduling is simple SM-2 per spot family** (D-054). The daily plan on Home (D-061) is
  a fixed recipe (next lesson, due review, one drill), not a personalised study programme.
- **Stats need at least 30 graded answers per group** before showing numbers. A leak is only
  reported when the intervals separate (D-055).
- **Drill answers don't link back to lessons.** Lessons and the daily plan link to drills,
  but the coaching card after an answer doesn't name a lesson.
- **Trainer data stays in this browser.** Clearing site data deletes it. Use Export on the
  Review tab to keep a copy.

## Interface

- **Play mode bots are practice opponents.** Before the flop they play from the charts when the
  spot is in the chart tree (approximate cash charts, exact heads-up push/fold); after the
  flop, and anywhere off the tree (limps, two callers), they use a simple rule-based strategy
  that is easy to exploit. Every hand starts with full stacks; no hand histories are saved.
- **Guided and Expert modes** change defaults and what is open:
  - Guided: hints on, Standard coaching, study mode.
  - Expert: Detailed coaching, quick mode, filters and advanced settings open, compact density.
  They don't yet rewrite labels in simpler or more technical words.
- **No bet-size slider in drills.** Drill answers must be actions in the solved tree, so drills
  offer the tree's sizes as buttons. Play mode has preset sizes and a "raise to" field.
- **The coach explains from the computed claims only.** Where a feature isn't computed (e.g.
  position effects postflop beyond in/out of position) it says nothing rather than guess.
- **Visual-regression baselines are for Windows** (`tests/screens/baselines/*-win32.png`).
  On another platform, create them first with `--update-snapshots`.
- **Sound effects are simple synthesized tones** (off by default).

## Lessons (M7)

- **Preflop lessons teach from approximate charts.** Levels 1 and 3 read the 100 bb cash
  charts, which are below their sanity bands for UTG, HJ and CO. The lessons say so, teach the
  aggregate patterns (who defends more, which sizes get more folds), and avoid edge hands. Every
  chart claim is pinned by `lessonCharts.test.ts`, so regenerating the charts flags any lesson
  text that stops being true.
- **Some chart cells look odd** (e.g. 44 going all-in against a 4-bet). Their EVs are within
  the sampling margin of the alternatives; the chart widget shows each EV with ± two standard
  errors so learners can see this.
- **Chart EVs are sampled and depend on the EQR model**, so small EV differences between actions
  aren't meaningful. Lessons only call one action better when the gap is more than two
  standard errors.
- **Limping isn't covered by data**: the cash tree has no limps, so lesson 1.4 argues from
  arithmetic only.
- **Postflop lessons use small example spots** (narrow ranges, one or two sizes). What they
  show is true for those spots, and the lessons say "in this spot"; other ranges and sizes can
  behave differently.
- **Hand groups in the postflop lessons are simple:** made hand (two pair or better, one pair),
  straight or flush draw (at least four cards complete it), or nothing; on the river, equity
  against the other range. Backdoor draws count as nothing.
- **The placement quiz shows right or wrong after each answer** (it reuses the lesson quiz).
- **The toy game is one small river** (a set or air against one bluff catcher, one size). It
  shows the theory exactly, but real ranges have many hand strengths.
- **The locked-caller view is computed from the game's rules**, not with the solver's
  node-locking (added later, in the workbench).
- **ICM ignores skill, position and future blinds**; bubble factors assume an all-in for the
  smaller stack with no other money in the pot.
- **Variance uses a normal approximation** per 100 hands and the infinite-horizon risk-of-ruin
  formula; the simulated paths are a seeded picture, not a forecast.
- **Multiway:** lessons use sampled equity only; OpenRange doesn't solve multiway postflop spots.
- **Range-building drill:** only exact heads-up push/fold charts are graded; cash opens are
  practice. Painting is one cell at a time (no drag).

## Solver

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
- **Performance budgets are measured on one machine** (Ryzen AI 9 HX 370) with the CPU slowed
  4× as a stand-in for a mid-range laptop (D-081). Slower machines, and phones, can take
  longer.

## Advanced features (M9)

- **Node-locking** locks one decision node at a time; there are no tree-wide "this player
  always…" presets yet. After a lock the solve restarts from scratch, so locking a big flop
  spot costs a full solve.
- **Runout explorer** reads each card's next decision one by one; on flop spots this takes a few
  seconds.
- **Flop report:** one spot (BTN opens, BB calls, 100 bb), 48 flops, a small tree with one size
  per street and no raises (so no check-raises), ranges from the approximate cash charts, each
  flop solved to under 1% of the pot. Without raises the button c-bets close to 100% on many
  boards and the big blind leads far more than in a full game: compare flops with each other,
  don't read the levels as real frequencies.
- **Hand-history import:** PokerStars and GGPoker No-Limit Hold'em text only (no Omaha, no
  tournaments' ICM context, no other sites). Only preflop decisions in the chart tree get a
  reference; postflop decisions are shown as not graded. Hands aren't saved between visits.
- **Hand-history positions** follow the seats clockwise from the button. Seats sitting out are
  treated as in the hand if the history lists them.

## Offline, install and release (M10)

- **The first visit needs the server.** OpenRange saves itself for offline use only after it
  has loaded once (from `npm run dev` it never does: offline is for builds). Home says when it
  is saved.
- **Updates arrive on the next visit.** A new version installs in the background and takes over
  at once; the open tab keeps its old code until you reload. If a page fails right after an
  update, reload.
- **Browser storage can be cleared.** Progress lives in this browser's storage. Clearing site
  data, a private window, or the browser freeing space when the disk is nearly full deletes
  it; OpenRange doesn't ask for persistent storage. Export from Settings → Data to keep a copy.
- **The release needs Node.js.** `serve.mjs` is a small static server that only answers this
  computer (127.0.0.1); there is no stand-alone installer or signed app.
- **"Copy diagnostics"** needs clipboard access; where the browser refuses, the text is shown
  to select and copy.
