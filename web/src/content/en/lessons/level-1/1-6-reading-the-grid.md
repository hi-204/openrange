---
id: "1.6"
level: 1
title: Reading the chart grid
minutes: 6
prerequisites: ["1.5"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["mixed strategy", "range"]
objectives:
  - Read a cell that is split between several actions.
  - Explain why some cells are greyed out.
  - Read the provenance badge and the warnings under a chart.
recap:
  - A split cell means the hand takes more than one action, in the proportions shown.
  - A greyed-out cell is a hand that never reaches this spot.
  - The badge says how the chart was made; approximate charts are guides.
---

The 13 × 13 grid packs a whole [[range]] into one picture. Three things on it are easy to
misread: split cells, grey cells and the badge.

## Split cells

Here is the big blind facing a button open to 2.5 bb, with three actions:

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BB-vs-BTN"}
```

Most cells are one colour: the hand always takes that action. A cell split into colours is a
[[mixed strategy]]: the model plays the hand more than one way, and the width of each colour is
how often. Point at a cell to read the exact numbers.

A mix doesn't mean "it doesn't matter". It means the options are close in value, and mixing
keeps the range hard to read. In practice you can lean towards the bigger part of the mix; the
trainer counts any action that is a real part of the mix as correct.

## Grey cells

Now the button facing a 3-bet from the big blind:

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-3bet-BTN-vs-BB"}
```

Many cells are grey. Those hands never reach this spot: the button folded them before the
flop, so it can't be facing a 3-bet with them. The shares in the legend count only the hands
that do reach it.

## The badge and the warnings

Next to each chart's title is a badge:

- **Exact solver result:** solved without simplifications for the tree shown.
- **Approximate model:** a simplified model (here the cash-game model with estimated play
  after the flop). Click the badge to see what generated it, when, and from which code.

A note under the chart warns when the chart set is outside some of its sanity checks.

```callout key
Colour width is frequency. Grey is "never gets here". The badge says how far to trust it.
```

## Worked hand

You hold T♠9♠ (T9s) in the big blind and the button has raised. Find T9s on the first chart
above: suited hands are above the diagonal.

1. Point at it and read its frequencies: it's split between calling and 3-betting.
2. Both actions are close in value for the model, so either is fine to practise.
3. Check the badge: this is an approximate model, so treat the exact split as a guide.

## Common mistakes

- **Reading a split cell as "random".** It's a frequency, set by the model.
- **Thinking grey means fold.** Grey hands aren't in the range at all at this point.
- **Skipping the badge.** An exact river solve and an approximate preflop model deserve
  different levels of trust.

## Check yourself

```quiz
[
  {"q": "A cell is half one colour and half another. What does it mean?", "choices": ["The hand is played each way about half the time", "The chart is broken", "The hand is always folded"], "answer": 0, "explain": "The width of each colour is how often the hand takes that action."},
  {"q": "Why are some cells grey on the 'facing a 3-bet' chart?", "choices": ["They are folds", "Those hands never reach this spot", "They are all-ins"], "answer": 1, "explain": "The player folded those hands earlier, so they can't be facing a 3-bet with them."},
  {"q": "What does the 'Approximate model' badge tell you?", "choices": ["The chart is exact", "The chart comes from a simplified model and is a guide", "The chart was written by hand"], "answer": 1, "explain": "Approximate charts come from a simplified model; click the badge for how they were made."}
]
```
