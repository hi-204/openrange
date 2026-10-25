---
id: "5.6"
level: 5
title: Why solver strategies mix
minutes: 7
prerequisites: ["5.1"]
drills: ["postflop"]
glossary: ["mixed strategy", "indifference", "exploitability"]
objectives:
  - Explain why an equilibrium mixes some hands.
  - See that frequencies are noisy before a solve has converged.
  - Know how to practise a mixed hand.
recap:
  - A hand mixes when its actions are worth the same; the mix is what keeps the opponent indifferent.
  - Early in a solve the frequencies wander; they settle as exploitability falls.
  - Near equal EVs, the choice costs almost nothing; pick one and stay consistent.
---

Solvers often play a hand two ways: call some of the time and fold the rest. That's a
[[mixed strategy]], and it isn't a sign of doubt.

## Why mixing happens

In the river game of lesson 5.1 the caller holds only bluff catchers. If it always called, the
bettor would stop bluffing; if it always folded, the bettor would bluff everything. The only
stable answer is to mix, at exactly the frequency that keeps the bettor [[indifference|indifferent]].
For the hand that mixes, calling and folding are worth the same.

## Watching a solve converge

```widget toygame
{"bet": 75, "air": 1, "convergence": true}
```

Solve it and look at the table. After a few iterations the call frequency and the bluff share
are off, and the [[exploitability]] (lesson 5.7) is high. As the solve goes on, exploitability
falls and the frequencies settle on the theory.

```callout key
Frequencies from a solve that isn't converged are noisy. Trust them when exploitability is
small, and even then don't read meaning into tiny differences.
```

## What to do with a mixed hand

- **The EVs are equal** (or nearly). Choosing either action costs little.
- **Keep the mix in your range**, not necessarily in each hand: e.g. call with some of these
  hands and fold others of the same kind.
- **The trainer grades every action in the mix as correct**, so you can practise without
  being marked wrong for picking the smaller part.

## Worked hand

In lesson 3.6's chart the big blind squeezes KQo almost always but mixes T9s. In a solved
river spot you see a hand called half the time.

1. **Check the EVs:** if they're within the margin, the mix is noise-level close.
2. **Check convergence:** a low exploitability means the frequencies are meaningful.
3. **Play it** whichever way you choose, and keep your range balanced overall.

## Common mistakes

- **Reading a mix as "the solver doesn't know".** It's an exact answer.
- **Trusting frequencies from an unconverged solve.** Look at exploitability first.
- **Treating a near-even split as a rule.** At equal EV, the split is a balance, not a
  preference.

## Check yourself

```quiz
[
  {"q": "Why does the caller mix in the river game?", "choices": ["Calling and folding are worth the same at equilibrium", "The solver is random", "It's a rule of poker"], "answer": 0, "explain": "Mixing happens at indifference."},
  {"q": "What happens to frequencies early in a solve?", "choices": ["They're already exact", "They wander and settle as the solve converges", "They're always zero"], "answer": 1, "explain": "Look at the convergence table: they approach the theory as exploitability falls."},
  {"q": "A hand calls a little more than half the time and folds the rest, with equal EVs. What should you do?", "choices": ["Always call", "Either is fine; keep your range balanced", "Always fold"], "answer": 1, "explain": "Equal EVs mean the choice costs little."}
]
```
