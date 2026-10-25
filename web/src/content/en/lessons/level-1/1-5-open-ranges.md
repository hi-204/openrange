---
id: "1.5"
level: 1
title: Open-raise ranges by position
minutes: 8
prerequisites: ["1.1", "1.3", "1.4"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["open-raise", "range"]
objectives:
  - Read an open-raise chart for each seat.
  - Explain why the range widens from UTG to the button.
  - Know how far OpenRange's early-seat charts can be trusted.
recap:
  - Every seat raises its strongest hands; later seats add more and more hands.
  - The share of hands raised grows from UTG to the button.
  - The early-seat charts are below their sanity bands, so treat them as a rough guide.
---

An open-raise chart answers one question: when everyone has folded to you, which hands do you
[[open-raise]]? This lesson walks through OpenRange's 100 bb cash charts from UTG to the
button. The share next to each action is the part of all starting hands that take it.

## From UTG to the button

```widget chart
{"file": "cash-6max-100bb.json", "chart": "first-in-UTG"}
```

UTG has five players behind, so its [[range]] is the tightest: big and medium pairs, strong
aces and the best broadway hands.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "first-in-HJ"}
```

```widget chart
{"file": "cash-6max-100bb.json", "chart": "first-in-CO"}
```

Each step keeps the previous range and adds hands at its edge. In these charts the hijack adds
smaller pairs, and the cutoff adds suited aces and suited connectors.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "first-in-BTN"}
```

The button raises more than three times as many hands as UTG, adding many suited kings and
queens and a lot of offsuit hands. Only two players are left to act, and the button will have
position on both after the flop.

## The small blind

```widget chart
{"file": "cash-6max-100bb.json", "chart": "first-in-SB"}
```

The small blind has only one player behind, but it will be out of position against the big
blind after the flop, and OpenRange's tree opens it to 3 bb instead of 2.5 bb. Its range is
wide, but not as wide as the button's.

## How much to trust these charts

These charts come from an approximate model (the badge says so). OpenRange checks the share of
hands each seat opens against a sanity band. The button chart is inside its band; the UTG, HJ
and CO charts open a little less often than their bands, so the chart set is marked as a rough
guide (see Known limits). Learn the shape: which families each seat adds. Don't treat the edge
hands as exact.

```callout key
Ranges widen toward the button because there are fewer players left to act behind and a better
chance of acting last after the flop.
```

## Worked hand

You hold A♣9♦, which is A9o. Find it on each chart above: offsuit hands are below the
diagonal, and the offsuit aces fill the first column.

- From **UTG** it's almost always a fold: five players could still wake up with a better ace.
- From the **cutoff** and the **button** it's a raise.

Click a cell (or focus it and press Enter) to see its exact frequencies and EVs below the grid.

## Common mistakes

- **Using the button chart from every seat.** Early seats need tighter ranges.
- **Memorising edge hands.** The edges move with stack size, bet size and model details; the
  core of each range doesn't.
- **Ignoring the badge.** An approximate chart is a guide, not an answer key.

## Check yourself

```quiz
[
  {"q": "Which seat opens the most hands when everyone folds to it?", "choices": ["UTG", "Cutoff", "Button"], "answer": 2, "explain": "The button has the fewest players behind and position after the flop; its chart's raise share is the biggest."},
  {"q": "What does the share next to 'Raise' in a chart's legend mean?", "choices": ["How often you win", "The part of all starting hands that raise", "How many big blinds you raise"], "answer": 1, "explain": "It counts combos, so pairs, suited and offsuit hands are weighted by how often they're dealt."},
  {"q": "Why should you trust the early-seat charts less than the button chart?", "choices": ["They are older", "They open less often than their sanity bands", "They use a different deck"], "answer": 1, "explain": "The UTG, HJ and CO charts fall below their sanity bands, so the set is marked as a rough guide."}
]
```
