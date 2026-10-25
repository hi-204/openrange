# OpenRange — User guide

_The full guide is written in M10. This page covers what exists so far; see README.md for how
to run the app._

## Trainer (`Trainer` in the top menu)

**Preflop.** You get a hand and a situation; answer with the buttons or the keyboard: F
fold, C check/call, R bet/raise/all-in, or the number of the button. Enter or N deals the
next hand. Open "What to drill" to choose chart sets, positions, situations, stack sizes and
difficulty ("Close or mixed" picks the hard decisions).

**Postflop.** Pick a spot and press "Solve this spot" (a few seconds; the flop spot about
30 s). Then you play hands against the solution: the opponent plays the solved strategy with
its real cards, and each of your decisions is graded. Press Enter to continue the hand and
"Deal a hand" when it ends; the opponent's cards are shown at the end.

**How answers are graded.** By EV loss: how much your choice gives up compared with the best
play, in big blinds preflop and % of the pot postflop. Categories: Best, Acceptable,
Inaccuracy, Mistake, Blunder; thresholds are on the Review tab. If the solution plays your
action at least 10% of the time, the answer is Best ("lower-frequency" if it isn't the main
play). Approximate charts carry sampling error, and differences within it aren't held against
you. Every answer explains itself with the numbers behind it.

**Review.** Your stats by position, situation, street, stack and hand type, with 95%
intervals. Nothing is shown for a group until it has 30 graded answers, and a group is only
called a leak when its interval clearly separates from the rest of your answers. Spots you get
wrong come back after about 10 minutes; spots you get right come back after 1, then 6 days,
then longer. Your data stays in this browser: export it to keep a copy.
