---
id: "7.7"
level: 7
title: Common over-interpretation mistakes
minutes: 7
prerequisites: ["7.5"]
drills: ["review"]
glossary: ["exploitability", "mixed strategy"]
objectives:
  - Recognise differences that are smaller than a solve's accuracy.
  - Tell noise from signal in sampled EVs and early solves.
  - Keep conclusions in proportion to the evidence.
recap:
  - Differences smaller than the exploitability or the sampling margin may be noise.
  - Odd cells in approximate charts are often within noise of the alternatives.
  - A solve is evidence about one spot; general rules need many spots.
---

Solvers give precise-looking numbers. Many of them are less certain than they look. These are
the most common ways to read too much into them.

## Five mistakes

1. **Reading a tiny frequency difference as a rule.** A hand that bets a little more often
   than it checks is a balance (lesson 5.6).
2. **Ignoring convergence.** Early in a solve, frequencies wander:

```widget toygame
{"bet": 75, "air": 1, "convergence": true}
```

   After a few iterations the call frequency is several points off; it settles as
   [[exploitability]] falls.

3. **Ignoring sampling noise.** Cash-chart EVs are sampled. In lesson 3.4, 44 goes all-in
   against a 4-bet, but its all-in and call EVs are within each other's margins: the model
   can't tell them apart.
4. **Copying approximate charts as exact.** Their badge says "Approximate model" for a reason.
5. **Generalising from one spot.** One board, one set of ranges and sizes, is one data point.

```callout key
Before acting on a difference, ask: is it bigger than the solve's accuracy, and does it hold
in other spots?
```

## Checks that help

- **Exploitability** for solves, **± margins** for sampled EVs.
- **Change the inputs** a little: a real pattern survives; noise doesn't.
- **Look at EV, not frequency**: a big frequency change with a tiny EV change is a detail.

## Worked hand

A chart shows a hand you'd never expect, such as 44 shoving over a 4-bet.

1. **Click the cell:** its EVs for shoving and calling are within their margins.
2. **Check the badge:** approximate model.
3. **Conclusion:** don't change your strategy for this cell.

## Common mistakes

- **Precision is not accuracy.** Four decimals can still be wrong.
- **Treating [[mixed strategy|mixed hands]] as mistakes either way.**
- **Building a rule on a single solve.**

## Check yourself

```quiz
[
  {"q": "A hand bets slightly more often than it checks, with equal EVs. What does it mean?", "choices": ["Always bet it", "It's a balance; either is fine", "Always check it"], "answer": 1, "explain": "At equal EVs, the split doesn't make one action better."},
  {"q": "Two EVs differ by less than their sampling margins. What should you conclude?", "choices": ["The bigger one is better", "The data can't tell them apart", "Both are wrong"], "answer": 1, "explain": "Inside the margin, the difference may be noise."},
  {"q": "How can you check whether a pattern is real?", "choices": ["Look at one cell", "Change the inputs a little and see if it holds", "Trust the first solve"], "answer": 1, "explain": "Real patterns survive small changes; noise doesn't."}
]
```
