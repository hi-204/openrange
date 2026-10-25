---
id: "6.2"
level: 6
title: Node-locking
minutes: 6
prerequisites: ["6.1"]
drills: ["postflop"]
glossary: ["node-locking", "best response", "exploitative play"]
objectives:
  - Say what node-locking is.
  - Lock one decision and read the best response to it.
  - Know how far a single lock can be trusted.
recap:
  - Node-locking fixes one player's strategy at a decision and re-solves everything else.
  - The answer is the best response to that tendency, holding the rest at equilibrium.
  - Locks are only as good as the tendency you put in.
---

[[Node-locking]] answers "what if?": what if my opponent always folds here, or always bets
small there? You fix (lock) their strategy at that decision and let the solver find the
[[best response]] to it: [[exploitative play]] worked out by the solver.

## The simplest lock

In the river game there is one decision for the caller. Locking it at a frequency and finding
the bettor's best response is a node-lock with one node:

```widget toygame
{"bet": 100, "air": 1, "lock": true, "call": 0.7}
```

Here the caller is locked at calling more than the MDF of a pot-sized bet. The best response
stops bluffing and earns more with its value hands than at equilibrium.

## In bigger trees

In a full tree a lock at one node can change play elsewhere too, because earlier decisions
lead into the locked one: the solver re-solves every other decision with the lock in place.
OpenRange's workbench doesn't have node-locking yet; it is planned for a later version. The
idea is the same as the one-node lock above.

```callout key
A lock turns a read into a strategy. The quality of the answer can't be better than the read.
```

## Worked hand

You believe a player calls river bets too often.

1. **Lock** their river response to call more than equilibrium.
2. **Read the best response:** fewer bluffs, more thin value bets.
3. **Check the size of the gain:** if it is small, the read barely matters; if it is large,
   make sure the read is solid before acting on it.

## Common mistakes

- **Locking based on one hand.** Use tendencies you've seen many times.
- **Locking too many nodes.** Each lock adds a guess.
- **Reading a locked solve as "GTO".** It's a best response, deliberately exploitable.

## Check yourself

```quiz
[
  {"q": "What does node-locking do?", "choices": ["Fixes one player's strategy at a decision and re-solves the rest", "Makes the solver faster", "Removes a bet size"], "answer": 0, "explain": "It finds the best play against a fixed tendency."},
  {"q": "The caller is locked at calling more than the MDF. What does the bettor do?", "choices": ["Bluff with every air hand", "Stop bluffing and bet value", "Check everything"], "answer": 1, "explain": "Bluffs lose against too many calls."},
  {"q": "What limits the value of a node-lock?", "choices": ["The quality of the read", "The bet size", "Nothing"], "answer": 0, "explain": "A lock is only as good as the tendency you put in."}
]
```
