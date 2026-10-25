---
id: "7.5"
level: 7
title: Abstraction and its limits
minutes: 7
prerequisites: ["7.2"]
drills: ["postflop:river-qj742"]
glossary: ["abstraction", "game tree"]
objectives:
  - Say what a game tree and an abstraction are.
  - See how a different size menu changes a solution.
  - Know which differences matter and which don't.
recap:
  - A solver solves the tree you give it: only the sizes and raises you allow exist.
  - Removing sizes can change the strategy a lot while changing the EV only a little.
  - Giving a player more options can't lower their equilibrium EV.
---

A solver doesn't solve poker; it solves a [[game tree]]: the actions you allow at each
decision. Limiting the sizes and raises is an [[abstraction]], and every solve uses one.

## Same spot, different menus

OpenRange's tests solve the river spot of lesson 4.9 three times, changing only the first
player's bet sizes (the second player's options stay the same):

- **a third, three quarters and one and a half pots** (the lesson spot);
- **three quarters only**;
- **a third only**.

What changes:

- **The strategy changes a lot.** With only the three-quarter size, the first player bets far
  fewer of its medium hands: they don't want a big bet (lesson 5.4).
- **The EV changes a little.** The first player's EV is highest with all three sizes, but only
  by a small share of the pot.

That ordering isn't an accident: giving a player more options can never lower their
equilibrium EV, because they can always ignore the new ones.

```widget minisolver
{"spot": "river-qj742"}
```

```callout key
Different trees give different strategies. Compare EVs before deciding whether a difference
matters: big strategy changes often cost little.
```

## Automatic simplification

On the Solve page, big trees can be simplified automatically to fit in memory. When that
happens, the result badge and a warning list every simplification, because the answer is for
the simpler tree, not the one you entered.

## Worked hand

You see two solves of the same spot disagree about a hand: one bets it, the other checks it.

1. **Compare the trees:** are the sizes the same?
2. **Compare the EVs:** if both trees give almost the same EV, both lines are fine.
3. **Then decide** which tree is closer to the game you play.

## Common mistakes

- **Thinking a solve covers sizes it didn't include.**
- **Judging trees by strategy alone.** Small EV differences can hide big strategy changes.
- **Ignoring the simplification warning.**

## Check yourself

```quiz
[
  {"q": "What does a solver actually solve?", "choices": ["Poker", "The game tree you give it", "Every possible bet size"], "answer": 1, "explain": "Only the actions you allow exist in the solve."},
  {"q": "You remove a bet size. What usually happens?", "choices": ["The strategy can change a lot while the EV changes a little", "Nothing changes", "The EV doubles"], "answer": 0, "explain": "That's what the three solves above show."},
  {"q": "Can giving a player more options lower their equilibrium EV?", "choices": ["Yes", "No, they can always ignore the new options", "Only on the turn"], "answer": 1, "explain": "More options can only help, or leave the EV the same."}
]
```
