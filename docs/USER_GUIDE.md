# OpenRange — User guide

OpenRange is a study suite for No-Limit Texas Hold'em that runs entirely on your computer:
a course from the rules up to solver study, drills graded by expected value, a solver
workbench, and play against bots. See [README.md](../README.md) for how to install and start it.

> **Study tool only.** OpenRange never reads your screen, shows overlays or connects to a poker
> site. Use it before and after you play, not during: real-time assistance is against the
> rules of almost every poker room.

## Contents

- [Your first hour](#your-first-hour)
- [Getting around](#getting-around)
- [Course](#course-learn-in-the-menu)
- [Trainer](#trainer-train-in-the-menu)
- [Play](#play-play-in-the-menu)
- [Solve](#solve-solve-in-the-menu)
- [Stats and your data](#stats-and-your-data)
- [Settings](#settings)
- [Offline and installing](#offline-and-installing)
- [How far to trust the numbers](#how-far-to-trust-the-numbers)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Troubleshooting](#troubleshooting)

## Your first hour

1. **Start.** The first time, a short welcome asks how much poker you know. "I'm new" starts
   in Guided mode; "I'm experienced" starts in Expert mode. You can skip it.
2. **Placement quiz** (Learn → Take the placement quiz): fifteen questions that suggest where to
   start in the course.
3. **Follow the daily plan** on Home: about 10–15 minutes of one lesson step, a drill that fits
   your level, and spots due for review.
4. **Drill what you learned.** Every lesson ends with "Practice this:" links to the matching
   drills.

If you already know the game, try a solve: Solve → Workbench → choose the River preset → Solve,
then walk through the strategy in the node browser.

## Getting around

The menu is on the left on a computer and at the bottom on a phone:

| Menu | What's there |
|---|---|
| Home | Today's plan, your next step, recent progress |
| Learn | The course, the placement quiz and the glossary |
| Train | Preflop, postflop, range-building and math drills |
| Play | Play against bots, and review your own hand histories |
| Solve | Solver workbench, charts, flop reports, equity and push/fold calculators |
| Stats | Course progress, drill results with confidence intervals, review queue |
| Settings | Display, training, coaching, game, solver and data settings |

The top bar switches between **Guided** mode (hints on, gentler coaching, simpler defaults)
and **Expert** mode (everything open, quick mode, detailed coaching), and between the dark and
light themes.

## Course (`Learn` in the menu)

**Placement quiz.** Fifteen questions, three for each of Levels 0–4. It suggests a starting
level: the first level where you got fewer than two of three right. Nothing is locked: you can
open any lesson, and you can retake the quiz.

**Lessons.** 60 lessons of 5–10 minutes in eight levels:

| Level | Topics |
|---|---|
| 0 | How a hand flows, blinds, betting actions, hand rankings, showdowns, formats, etiquette |
| 1 | Positions, the 169 starting hands, hand categories, raising vs limping, open ranges, the chart grid |
| 2 | Outs, the rule of 2 and 4, pot odds, equity, expected value, implied odds, combinatorics, blockers |
| 3 | Defending, 3-bets, facing 3-bets, 4- and 5-bets, blind vs blind, squeezes, calling vs raising |
| 4 | C-bets, board textures, range and nut advantage, position, SPR, check-raises, sizing |
| 5 | Equilibrium, MDF, bluff-to-value ratios, polarized vs merged, blockers, mixing, exploitability |
| 6 | Exploitative play, node-locking, ICM, the bubble, bankroll and variance, game selection, tilt, notes |
| 7 | Reading solver output, bet-size theory, low-SPR pots, multiway caveats, abstraction, study routines |

Every lesson has objectives, a worked hand, common mistakes, a short quiz and links to drills.
Underlined words open the glossary.

**Numbers you can trust.** Numbers in lessons are computed, never typed. When a lesson
describes a chart or a solve, that is OpenRange's own data, and a test checks every description
against it. `docs/LESSON_REVIEW.md` lists each claim and how it is checked.

**Widgets.** Many lessons contain interactive tools:
- change the cards, ranges, pot or bet and the numbers update;
- in chart widgets, click a cell to see how often the hand takes each action and the EV of
  each (with its sampling margin);
- mini-solvers solve their spot in your browser when you press "Solve this spot" (the flop one
  takes about half a minute);
- the toy game is a small river that OpenRange's solver plays with real cards, next to the
  textbook formulas;
- the ICM calculator turns tournament stacks into prize equity and shows bubble factors;
- the variance widget shows the spread of results, the chance of being behind and the risk of
  ruin.

**Glossary.** Every term the course uses, with a plain definition (Learn → Glossary).

## Trainer (`Train` in the menu)

**Preflop.** You get a hand and a situation. Answer with the buttons or the keyboard (see
[Keyboard shortcuts](#keyboard-shortcuts)). Open "What to drill" to choose chart sets,
positions, situations, stack sizes and difficulty ("Close or mixed" picks the hard decisions).

**Postflop.** Pick a spot and press "Solve this spot" (a few seconds; the flop spot about
30 s). Then play hands against the solution: the opponent plays the solved strategy with its
real cards, and each of your decisions is graded. Press Enter to continue and "Deal a hand"
when a hand ends.

**Ranges.** Build a range on the grid (click cells, or type a range and fill the grid), then
check it against a chart. The score is the number of combos you got wrong, next to the best
possible score (hands the chart mixes always cost something). Heads-up push/fold charts are
exact; the 6-max cash opens are approximate and count as practice.

**Math.** Generated problems with worked answers: pot odds, MDF, bluff share, outs, preflop
equity, combos, board textures and hand reading.

**How answers are graded.**
- **By EV loss:** how much your choice gives up compared with the best play, in big blinds
  preflop and % of the pot postflop. Categories: Best, Acceptable, Inaccuracy, Mistake,
  Blunder (the thresholds are in Stats → Review).
- **Mixed strategies:** if the solution plays your action at least 10% of the time, it counts
  as Best.
- **Approximate references:** they carry sampling error, and differences within it aren't held
  against you. Approximate cash charts are practice, not graded.
- **Coaching card:** after every answer, what happened, why (two to four reasons about this
  hand), the key idea, what to look for next time and which lesson covers it. "Show the math"
  opens the EVs, the solution's mix and the chart.

**Spaced repetition.** Spots you get wrong come back after about 10 minutes; spots you get
right come back after 1, then 6 days, then longer.

## Play (`Play` in the menu)

**Play.** Press "Deal a hand" to play against bots, heads-up up to 6-handed (set the table
size and stack in Settings → Game; every hand starts with full stacks).
- **Your actions:** use the buttons, or type a "raise to" amount.
- **The bots:** before the flop they play from OpenRange's charts when the spot is in the chart
  tree. Otherwise, and after the flop, they use a simple rule-based strategy. The history marks
  each bot action "chart" or "rule-based".
- **Coaching and replay:** with "Coaching after my decisions" on, each of your decisions gets a
  reference card. When a hand ends, "Replay this hand" shows every decision with its
  reference.

**Hand review.** After a session, paste PokerStars or GGPoker hand histories (or load a .txt
file). You see a summary, your biggest EV losses and a replay of each hand. Each of your
decisions is:
- graded against an exact chart (heads-up push/fold);
- given an approximate chart as practice (6-max cash at 20/40/60/100 bb);
- or marked "not graded (no solved reference)" with the reason, which includes every decision
  after the flop.

The hands stay in the browser tab and nothing is uploaded or saved.

## Solve (`Solve` in the menu)

**Workbench.**
- **Setting up:** enter the board, pot, stacks and ranges (type them, or paint them on the
  grid), and the bet sizes per street. The presets (River, Turn, Flop) are a quick start.
- **Running:** press Solve. Run, pause or cancel at any time. The live exploitability shows how
  close the solve is, and the memory estimate warns before a spot is too big. "Simplify
  automatically" fits big trees into memory and lists what it simplified.

**Browsing a solve.** Walk the tree from the node browser. At each decision:
- see the strategy per hand (bar height: how much of each hand is still in the range);
- click a hand for its combos, frequencies and EVs, and "Explain" for a coaching card;
- switch to the opponent's range at that node;
- download the node as CSV.

At a card being dealt, the runout explorer lists the next decision for every card.

**Node-locking.** At any decision, "Lock this node" fixes that player's strategy and re-solves:
- choose a tendency (folds more, calls more, never raises, bets more, checks more, or always one
  action);
- check the before/after frequencies, then lock;
- the solve becomes the best play against the lock;
- the page shows the EVs before and after, and you can unlock again.

**Charts.** Preflop charts:
- heads-up push/fold, exact;
- 3–6-handed push/fold, approximate;
- 6-max cash at 20/40/60/100 bb, approximate.

Click a hand to see each action's EV. The badge on each chart says how it was made.

**Flop reports.** One spot (BTN opens, BB calls, 100 bb) solved on 48 flops and grouped by
texture. It is a small tree without raises, so compare flops with each other rather than
reading the frequencies as real.

**Equity calculator.** Hand or range against hand or range (up to six players), with a board
and dead cards; exact when small enough, otherwise sampled with its error.

**Push/fold calculator.** Exact heads-up push/fold for any stacks, with antes and, if you enter
payouts, ICM.

## Stats and your data

**Stats.**
- **What it shows:** course progress, math drills, and your trainer answers by position,
  situation, street, stack and hand type, with 95% confidence intervals.
- **Small samples:** nothing is shown for a group until it has 30 graded answers.
- **Leaks:** a group is only called a leak when its interval clearly separates from the rest of
  your answers.

**Your data** stays in this browser on this computer. Under Settings → Data (or Stats →
Review):
- **Export as JSON:** a backup of your answers, review schedule, lesson progress and settings;
- **Import a JSON export:** restore it, here or on another computer;
- **Delete all trainer data:** start over.

Clearing your browser's site data also deletes it, so export first.

## Settings

Settings has a search box, presets (Beginner / Standard / Advanced), help text for every
setting and a "Reset to defaults" button per section. Sections:

| Section | What you can change |
|---|---|
| Display | Theme, card colours (two- or four-colour deck), card backs, table felt, text size, density, motion, sounds |
| Training | Hints, quick mode, timer, review intensity |
| Coaching | How much detail, show the math, coaching in play mode |
| Game | Table size, stacks, rake and antes for play mode |
| Solver | Algorithm, iteration limit, target accuracy, memory, automatic simplification |
| Data | Export, import, delete |

## Offline and installing

After the first visit, OpenRange works without a network. Home → About says "Saved for offline
use" once everything is cached. To install it as an app, click the install icon at the right of the address bar, or look for "Install" in the browser's menu (Edge and Chrome both offer it). It then opens in its own window like any program, still
entirely on your computer.

Offline works with a release (`start.cmd`) or `npm run preview`, not with `npm run dev`.

## How far to trust the numbers

Every chart, solve and reference carries a badge:
- **Exact solver result.** Solved without approximation for the model shown: heads-up
  push/fold, and postflop solves to the accuracy they report.
- **Approximate model.** For example, the 6-max cash charts use a simplified preflop tree and
  an equity-realization model. The badge opens the details: generator, date, code version and
  model.

Postflop solves report their exploitability (how much a perfect opponent could gain, as a share
of the pot), and the drills widen their grading allowance by it. `docs/KNOWN_LIMITS.md` lists
everything that is approximate or missing; `docs/VALIDATION.md` lists every correctness check.

## Keyboard shortcuts

| Where | Key | Action |
|---|---|---|
| Drills | F | Fold |
| Drills | C | Check or call |
| Drills | R or A | Bet, raise or all-in (the first aggressive action) |
| Drills | 1–9 | The action button with that number |
| Drills | Enter or N | Next hand |
| Everywhere | Tab / Shift+Tab | Move between controls; the first Tab offers "Skip to content" |
| Grids | Enter or Space | Select the focused hand |

## Troubleshooting

- **The page is blank or says it can't load.** Make sure the server is still running (the
  PowerShell window from `npm run dev`), then reload. In the release build, run
  `node serve.mjs` again.
- **A solve says it doesn't fit in memory.** Narrow the ranges, use fewer bet sizes or raises,
  turn on "Simplify automatically", or raise the memory limit in Settings → Solver.
- **A flop solve is slow.** That's expected in the browser (about a minute for a small tree).
  The command-line solver is faster: `cargo run --release -p solver-cli -- solve <spot.json>`
  (needs Rust).
- **Something looks wrong.** Error screens have a "Copy diagnostics" button that copies
  technical details without any personal data.
