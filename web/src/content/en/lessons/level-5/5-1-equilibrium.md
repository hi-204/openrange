---
id: "5.1"
level: 5
title: Equilibrium and indifference
minutes: 8
prerequisites: ["2.5", "4.8"]
drills: ["math:bluff", "math:mdf"]
glossary: ["equilibrium", "indifference", "game theory optimal", "bluff catcher"]
objectives:
  - Say what an equilibrium is in plain words.
  - Use the indifference principle to find the frequencies of a simple river game.
  - Check those frequencies against OpenRange's solver.
recap:
  - At an equilibrium neither player can gain by changing their strategy alone.
  - A player mixes only between actions that are worth exactly the same; the opponent's frequencies make it so.
  - In the river game the bettor's bluffs make the caller indifferent, and the caller's calls make the bluffs indifferent.
---

Solvers look for an [[equilibrium]]: a pair of strategies where neither player can win more by
changing theirs while the other keeps theirs. Strategies close to one are called
[[game theory optimal|game theory optimal (GTO)]]. A small river game shows how it works.

## The river game

The bettor holds either a very strong hand (value) or a hand that never wins at showdown (air).
The caller holds a [[bluff catcher]]: it beats the air and loses to the value. The bettor
checks or bets; the caller calls or folds.

```widget toygame
{"bet": 100, "air": 1}
```

Press Solve. OpenRange's solver plays this game with real cards and finds the frequencies in
the Engine column. The Theory column comes from two short arguments.

## Indifference

If the caller always called, the bettor would never bluff; if the caller always folded, the
bettor would bluff every air hand. At the equilibrium the caller mixes, and that's only
possible if calling and folding are worth exactly the same: the caller is at
[[indifference]].

- **The caller is indifferent** when the bluffs in the betting range equal the caller's price:
  B ÷ (P + 2B) of the bets (lesson 2.3).
- **The bettor's bluffs are indifferent** when the caller calls just often enough that a bluff
  breaks even: P ÷ (P + B) of the time, the minimum defence frequency (lesson 5.2).

With a pot-sized bet, bluffs are {{calc 10 / (10 + 2 * 10) | pct1 | show}} of the bets and the
caller calls {{calc 10 / (10 + 10) | pct1 | show}} of the time. The solver lands on the same
numbers.

```callout key
In an equilibrium, each player's mix keeps the other indifferent. That's why the exact
frequencies depend on the pot and the bet, not on guesswork.
```

## Worked hand

Bet three quarters of the pot (move the slider to 75).

1. **Price for the caller:** {{calc 7.5 / (10 + 15) | pct1 | show}}. So bluffs make up that
   share of the bets.
2. **Calls:** {{calc 10 / (10 + 7.5) | pct1 | show}}.
3. **Solve again** and compare: the engine matches both, and the value hands always bet.

## Common mistakes

- **Thinking GTO means "never exploitable, always best".** It's the best guaranteed result,
  not the most profitable play against a particular opponent (lesson 6.1).
- **Thinking mixing is random play.** The frequencies are set exactly by indifference.
- **Applying the river game to every street.** Earlier, bluffs have equity and the numbers
  change.

## Check yourself

```quiz
[
  {"q": "What defines an equilibrium?", "choices": ["Both players win the same", "Neither player can gain by changing their strategy alone", "Both players always bet"], "answer": 1, "explain": "Each strategy is a best response to the other."},
  {"q": "Why can the caller mix between calling and folding?", "choices": ["Because both actions are worth the same at equilibrium", "Because the solver is unsure", "Because calling is illegal half the time"], "answer": 0, "explain": "A player only mixes between actions of equal value: indifference."},
  {"q": "With a pot-sized bet, what share of the bets are bluffs in the river game?", "choices": ["One half", "One third", "One quarter"], "answer": 1, "explain": "B ÷ (P + 2B) with B = P gives one third."}
]
```
