# OpenRange — User guide

_The full guide is written in M10. This page covers what exists so far; see README.md for how
to run the app._

## Getting around

The menu is on the left (at the bottom on a phone): **Home** (today's plan and where you left
off), **Learn** (the course and the glossary), **Train** (preflop, postflop and math drills),
**Play** (arrives in M9), **Solve** (solver workbench, charts, equity and push/fold
calculators), **Stats** and **Settings**. The top bar switches between **Guided** mode (hints,
gentler defaults) and **Expert** mode (everything open, quick mode, detailed coaching), and
between dark and light.

**Settings** has a search box, presets (Beginner / Standard / Advanced) and a "Reset to
defaults" button per section. Every setting says in one sentence what it does.

## Course (`Learn` in the menu)

**Placement quiz.** Fifteen questions, three for each of Levels 0–4. It suggests a starting
level (the first level where you got fewer than two of three right). Nothing is locked: you
can open any lesson, and you can retake the quiz.

**Lessons.** All eight levels are available (60 lessons of 5–10 minutes): the rules, preflop
basics, poker math, preflop in depth, postflop fundamentals, GTO concepts, real-game skills
(exploiting, tournaments and ICM, bankroll, tilt, notes) and solver literacy. Every lesson has objectives,
a worked hand, common mistakes, a short quiz and links to the matching drill. Underlined words
open the glossary. Numbers in lessons are computed, never typed; where a lesson describes a
chart or a solve, it is OpenRange's own data and a test checks the description.

**Widgets inside lessons.** Many are interactive: change the cards, ranges, pot or bet and
the numbers update. In chart widgets, click a cell to see how often the hand takes each action
and the EV of each (with its sampling margin). Mini-solvers solve their spot in your browser
when you press "Solve this spot"; the flop one takes about half a minute.

**Level 5–6 widgets.** The *toy game* is a small river that OpenRange's solver plays with real
cards; it shows the solver's frequencies next to the formulas, how they settle as the solve
converges, and the best response when you lock the caller's frequency. The *ICM calculator*
turns stacks into prize equity and shows the bubble factor for a call. The *variance* widget
shows the spread of results, the chance of being behind and the risk of ruin.

## Trainer (`Train` in the menu)

**Preflop.** You get a hand and a situation; answer with the buttons or the keyboard: F
fold, C check/call, R bet/raise/all-in, or the number of the button. Enter or N deals the
next hand. Open "What to drill" to choose chart sets, positions, situations, stack sizes and
difficulty ("Close or mixed" picks the hard decisions).

**Postflop.** Pick a spot and press "Solve this spot" (a few seconds; the flop spot about
30 s). Then you play hands against the solution: the opponent plays the solved strategy with
its real cards, and each of your decisions is graded. Press Enter to continue the hand and
"Deal a hand" when it ends; the opponent's cards are shown at the end.

**Ranges.** Build a range on the 13×13 grid (click cells, or type a range and fill the grid),
then check it against a chart. The score is the number of combos you got wrong, next to the
best possible score (hands the chart mixes always cost something). Heads-up push/fold charts
are exact; the 6-max cash opens are approximate and shown as practice.

**Math.** Generated problems with worked answers: pot odds, MDF, bluff share, outs, preflop
equity, combos, board textures (which description fits a flop) and hand reading (which of two
hands is more likely, counting combos).

**How answers are graded.** By EV loss: how much your choice gives up compared with the best
play, in big blinds preflop and % of the pot postflop. Categories: Best, Acceptable,
Inaccuracy, Mistake, Blunder; thresholds are on the Review tab. If the solution plays your
action at least 10% of the time, the answer is Best ("lower-frequency" if it isn't the main
play). Approximate charts carry sampling error, and differences within it aren't held against
you. After every answer a coaching card says what happened, why (2 to 4 reasons about this hand),
the key idea, what to look for next time and which lesson covers it. "Show the math" opens
the EVs, the solution's mix and the chart with your hand highlighted. In the Solve workbench,
"Explain" next to any hand gives the same card for the solution's main play.

**Review.** Your stats by position, situation, street, stack and hand type, with 95%
intervals. Nothing is shown for a group until it has 30 graded answers, and a group is only
called a leak when its interval clearly separates from the rest of your answers. Spots you get
wrong come back after about 10 minutes; spots you get right come back after 1, then 6 days,
then longer. Your data stays in this browser: export it to keep a copy.

## Play (`Play` in the menu)

**Play.** Press "Deal a hand" to play against bots, heads-up up to 6-handed (set the table size
and stack in Settings → Game; every hand starts with full stacks). Use the buttons or type a
"raise to" amount. Before the flop the bots play from OpenRange's charts when the spot is in
the chart tree; otherwise, and after the flop, they use a simple rule-based strategy. The
history marks each bot action "chart" or "rule-based". With "Coaching after my decisions" on,
each of your decisions gets a reference card. When a hand ends, "Replay this hand" shows every
decision with its reference.

**Hand review.** Paste PokerStars or GGPoker hand histories (or load a .txt file) after a
session. You see a summary, the biggest EV losses and a replay of each hand. Each of your
decisions is either:
- graded against an exact chart (heads-up push/fold);
- given an approximate chart as practice (6-max cash at 20/40/60/100 bb);
- marked "not graded (no solved reference)" with the reason. This includes every decision
  after the flop.

This is for post-session review only: the hands stay in this browser tab and nothing is
uploaded or saved.

## Solve (`Solve` in the menu)

**Workbench.** Enter the board, pot, stacks and ranges (type them, or paint them on the grid),
the bet sizes per street, and press Solve. Run, pause or cancel at any time; the exploitability
shows how close the solve is.

**Browsing a solve.** Walk through the tree from the node browser. At each decision:
- see the strategy per hand (bar height: how much of each hand is still in the range);
- click a hand for its combos, frequencies and EVs;
- switch to the opponent's range at that node;
- download the node as CSV.

At a card being dealt, the runout explorer lists the next decision for every card.

**Node-locking.** At any decision, "Lock this node" fixes that player's strategy and re-solves:
- choose a tendency (folds more, calls more, never raises, bets more, checks more, or always one
  action);
- check the before/after frequencies, then lock;
- the solve becomes the best play against the lock;
- the page shows the EVs before and after, and you can unlock again.

**Flop reports.** One spot (BTN opens, BB calls, 100 bb) solved on 48 flops and grouped by
texture: how often the button c-bets, how often the big blind folds to it, and the button's
equity. It's an approximate study aid; the page lists how it was made.
