---
id: "7.1"
level: 7
title: Reading solver output
minutes: 7
prerequisites: ["5.6", "5.7"]
drills: ["postflop:river-qj742"]
glossary: ["exploitability", "mixed strategy", "range"]
objectives:
  - Read a solved node: actions, overall frequencies, the grid and per-hand EVs.
  - Check how far a solve can be trusted before reading it.
  - Turn a solve into a few rules you can actually use.
recap:
  - Start with the badge and the exploitability, then the overall frequencies, then hands.
  - Look for patterns across groups of hands, not for single cells.
  - A solve answers the spot you entered; change the inputs and the answer changes.
---

A solved spot is a lot of numbers. Read it in a fixed order, from how much to trust it down to
single hands.

## A reading order

```widget minisolver
{"spot": "river-qj742"}
```

1. **Trust.** The status line says how far the solve got: its [[exploitability]] as a share of
   the pot (lesson 5.7). If it's high, stop here and solve further.
2. **The whole range.** The overall frequency of each action tells you the strategy's shape:
   how often the player checks, bets small, bets big.
3. **Groups of hands.** In the grid, look for patterns: which kinds of hands use each action
   (strong hands, medium hands, bluffs, draws).
4. **Single hands last.** Click a cell to see its frequencies and EVs. Mixed cells
   ([[mixed strategy]]) with nearly equal EVs are a balance, not a preference (lesson 5.6).

```callout key
Read from the outside in: trust, then range, then groups, then hands. Single cells are where
over-reading starts.
```

## What a solve can't tell you

- **Other spots.** The answer depends on the ranges, stacks and sizes you entered. A different
  [[range]] gives a different answer.
- **Opponents.** It assumes both players play the equilibrium.
- **Missing options.** Sizes that aren't in the tree can't be chosen (lesson 7.5).

## Worked hand

You've solved the river spot above.

1. **Trust:** solved to a small share of the pot. Fine for study.
2. **Range:** the first player checks about half the time and mostly bets small when it bets.
3. **Groups:** its biggest bets are strong hands and bluffs; medium hands check or bet small
   (lesson 4.9).
4. **Rule to keep:** "on this kind of river, medium hands bet small or check."

## Common mistakes

- **Reading single cells first.** Start with the whole range.
- **Ignoring exploitability.** A loose solve can be badly off.
- **Treating one spot's answer as a rule for all spots.** Change the inputs and check.

## Check yourself

```quiz
[
  {"q": "What should you check first in a solve?", "choices": ["The EV of your hand", "How converged it is (exploitability)", "The colour of the grid"], "answer": 1, "explain": "If the solve isn't converged, the rest isn't reliable."},
  {"q": "Where should you look for useful rules?", "choices": ["Single cells", "Patterns across groups of hands", "The biggest EV number"], "answer": 1, "explain": "Groups give rules you can remember and use."},
  {"q": "Does a solve tell you how to play a different spot?", "choices": ["Yes, always", "No, it answers the inputs you entered", "Only on the river"], "answer": 1, "explain": "Change the ranges, stacks or sizes and the answer changes."}
]
```
