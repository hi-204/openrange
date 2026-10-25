---
id: "3.5"
level: 3
title: Blind vs blind
minutes: 7
prerequisites: ["3.1"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["small blind", "big blind", "in position"]
objectives:
  - Explain why the small blind opens wide but raises bigger.
  - Explain why the big blind defends more against the small blind than against the button.
  - Defend the big blind against a small-blind open.
recap:
  - With only the big blind behind, the small blind opens wide, to 3 bb because it will be out of position.
  - The big blind pays a worse price against the small blind but has position, so it defends more.
  - Blind vs blind ranges are wide on both sides, and the big blind 3-bets far more often.
---

When everyone folds to the [[small blind]], two players with forced bets fight over the pot.
Both ranges are wide, and position flips: the [[big blind]] acts last after the flop.

## The small blind's open

```widget chart
{"file": "cash-6max-100bb.json", "chart": "first-in-SB"}
```

The small blind has only one player behind, so it opens a wide range. It opens to 3 bb, more
than the 2.5 bb of the other seats, because it will be out of position for the rest of the
hand: a bigger raise makes calling less attractive for the big blind.

## The big blind's defence

The big blind calls 2 bb to win a pot of 3 + 1 + 2 = 6 bb: {{calc 2 / 6 | pct1 | show}}. That's
worse than the {{calc 1.5 / 5.5 | pct1}} it gets against a button open.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BB-vs-SB"}
```

Yet it defends more often than against the button, and 3-bets about twice as often. The reason
is position: against the small blind, the big blind is [[in position]] after the flop.

```callout key
Blind vs blind, position belongs to the big blind. That's worth more than the slightly worse
price.
```

## Worked hand

You are in the big blind with K♠2♦ (K2o).

- **The small blind opens to 3 bb.** You'll have position; the chart calls.
- **The button opens to 2.5 bb.** Better price, but you'll be out of position after the flop:
  the chart folds.

Click K2o on this chart and on the big blind's chart in lesson 3.1.

## Common mistakes

- **Opening the small blind as tight as UTG.** Only one player is left.
- **Folding the big blind too often against the small blind.** Position makes many hands
  playable.
- **Forgetting the size.** The 3 bb open changes the price you get.

## Check yourself

```quiz
[
  {"q": "Who has position after the flop in a small blind vs big blind pot?", "choices": ["The small blind", "The big blind", "Whoever raised"], "answer": 1, "explain": "After the flop the small blind acts first and the big blind last."},
  {"q": "The small blind opens to 3 bb. What does the big blind pay to call?", "choices": ["3 bb", "2 bb", "1 bb"], "answer": 1, "explain": "It already has 1 bb in."},
  {"q": "Why does the big blind defend more against the small blind than against the button?", "choices": ["The price is better", "It has position after the flop", "The small blind can't 4-bet"], "answer": 1, "explain": "The price is worse, but position against the small blind is worth more."}
]
```
