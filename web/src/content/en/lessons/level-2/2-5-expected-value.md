---
id: "2.5"
level: 2
title: Expected value
minutes: 7
prerequisites: ["2.3"]
drills: ["math:potodds", "math:bluff"]
glossary: ["expected value", "pot odds"]
objectives:
  - Work out the EV of a decision from its outcomes and their chances.
  - See that the pot-odds check is an EV calculation.
  - Find how often a bluff must work to break even.
recap:
  - EV is the sum over outcomes of chance × result.
  - A call breaks even when equity × final pot equals the call.
  - A bluff of B into a pot P breaks even when they fold B ÷ (P + B) of the time.
---

[[Expected value]] (EV) is what a decision wins or loses on average if you made it many times.
It turns poker decisions into arithmetic: pick the option with the highest EV.

## The formula

List the outcomes, how likely each is, and what you win or lose in each:

$$
\text{EV} = \sum_i p_i \times v_i
$$

A bet that wins 10 bb half the time and loses 5 bb the other half has EV
{{calc 0.5 * 10 + 0.5 * (-5) | bb | show}}. Change the numbers below:

```widget ev
{"outcomes": [
  {"label": "Win", "p": 0.5, "value": 10},
  {"label": "Lose", "p": 0.5, "value": -5}
]}
```

We measure results from the moment of the decision: folding counts as 0, and money already in
the pot isn't yours any more.

## Calling is an EV question

With equity e, calling C to reach a final pot of P + C wins e × (P + C) on average and costs C:

$$
\text{EV(call)} = e \times (P + C) - C
$$

Pot 10 bb, bet 5 bb, so P = 15 and the final pot is 20. If your equity is one quarter:
{{calc 0.25 * 20 - 5 | bb | show}}. That's the break-even price from [[pot odds|lesson 2.3]].
If it is two fifths, the call earns {{calc 0.4 * 20 - 5 | bb}} on average.

## A bluff

On the river you hold a hand that can't win at showdown. You bet B into a pot P. If they fold
you win P; if they call you lose B:

$$
\text{EV(bluff)} = f \times P - (1 - f) \times B
$$

It breaks even when f = B ÷ (P + B). A bet of 7.5 bb into 10 bb needs folds
{{calc 7.5 / (10 + 7.5) | pct1 | show}} of the time.

```callout key
Every decision is a comparison of EVs. Pot odds and break-even bluffs are the same formula
applied to two common spots.
```

## Worked hand

River. The pot is 12 bb, you missed your draw and can't win at showdown. You think a bet of
8 bb gets a fold half the time (your guess, not a solver number).

- **Check:** you lose at showdown, EV 0 from here.
- **Bet:** {{calc 0.5 * 12 - 0.5 * 8 | bb | show}}.

The bet is better if your guess is right. It breaks even at {{calc 8 / (12 + 8) | pct1}} folds, so
even a smaller fold rate would do.

## Common mistakes

- **Counting money you already put in.** It's in the pot; what matters is what you win or lose
  from now.
- **Probabilities that don't add up to 1.** Every outcome needs a place in the list.
- **Treating a guess as a fact.** EV is only as good as the chances you put in.

## Check yourself

```quiz
[
  {"q": "A play wins 6 bb a quarter of the time and loses 2 bb otherwise. What's its EV?", "choices": ["Zero", "Plus 1.5 bb", "Minus 0.5 bb"], "answer": 0, "explain": "A quarter of 6 is 1.5 bb, three quarters of minus 2 is minus 1.5 bb: the sum is zero."},
  {"q": "What is the EV of folding, measured from the decision?", "choices": ["Zero", "Minus what you already put in", "The pot"], "answer": 0, "explain": "Money already in the pot is gone either way; folding wins and loses nothing more."},
  {"q": "You bet the size of the pot as a pure bluff on the river. How often must they fold?", "choices": ["A quarter of the time", "Half the time", "A third of the time"], "answer": 1, "explain": "B ÷ (P + B) with B = P gives one half."}
]
```
