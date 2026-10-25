---
id: "4.9"
level: 4
title: Sizing basics
minutes: 7
prerequisites: ["4.8", "4.3"]
drills: ["math:mdf", "postflop:river-qj742"]
glossary: ["polarized", "merged", "minimum defence frequency", "overbet"]
objectives:
  - Connect bet size with the shape of the betting range.
  - Work out the price and the minimum defence frequency for any size.
  - Compare a solver's defence with the minimum defence frequency.
recap:
  - Small bets go with merged ranges (many medium hands); big bets with polarized ones.
  - A bet of B into P gives the caller a price of B ÷ (P + 2B) and an MDF of P ÷ (P + B).
  - In the river example, the defender stays close to MDF at every size.
---

Bet size isn't just "how much". Different sizes suit different ranges, and each size gives the
opponent a different price.

## The numbers behind a size

For a bet B into a pot P:

- the caller's price is B ÷ (P + 2B) (lesson 2.3);
- the [[minimum defence frequency]] (MDF) is P ÷ (P + B): if the defender folds more than
  1 − MDF, a pure bluff profits at once (lesson 2.5).

```widget sizing
{"pot": 10, "bet": 7.5}
```

| Bet | Price | MDF |
|---|---|---|
| a third of the pot | {{calc 1 / (3 + 2) \| pct1}} | {{calc 3 / (3 + 1) \| pct1}} |
| three quarters | {{calc 3 / (4 + 6) \| pct1}} | {{calc 4 / (4 + 3) \| pct1}} |
| one and a half pots ([[overbet]]) | {{calc 3 / (2 + 6) \| pct1}} | {{calc 2 / (2 + 3) \| pct1}} |

## Range shape and size

```widget minisolver
{"spot": "river-qj742"}
```

In this river spot, the first player's bets sort hands by strength against the other range:

- **The small bet** (a third of the pot) contains many medium hands, along with strong hands and
  bluffs: a [[merged]] range.
- **The bigger bets** (three quarters and one and a half pots) contain almost no medium hands:
  strong hands and bluffs only, a [[polarized]] range.

A medium hand can bet small because worse hands still call a small bet. Against a big bet,
only better hands call, so medium hands check instead.

```callout key
Small size, merged range. Big size, polarized range. Size follows what you hold.
```

## Defending against each size

The second player's defence (calling or raising) in this spot shrinks as the bet grows, and at
each size it stays within a few points of the MDF in the table above.

## Worked hand

On the river you have a strong hand and want to be called. Which size?

1. **A third of the pot:** called often, wins a little each time.
2. **One and a half pots:** called less often, wins a lot when called.
3. **The solver** splits its strong hands between the small bet, the three-quarter-pot bet and
   checking, and overbets them only rarely. With medium hands it only bets small or checks.
   Compare a few strong hands in the root node.

## Common mistakes

- **Always betting the same size.** Size should fit the range.
- **Overbetting medium hands.** Only better hands call a big bet.
- **Defending far below MDF against small bets.** Your opponent's bluffs profit at once.

## Check yourself

```quiz
[
  {"q": "What range shape goes with a big bet?", "choices": ["Merged", "Polarized", "Only medium hands"], "answer": 1, "explain": "Big bets are made with strong hands and bluffs."},
  {"q": "A bet of half the pot: what is the MDF?", "choices": ["Two thirds", "One half", "One third"], "answer": 0, "explain": "P ÷ (P + B) with B = P ÷ 2 gives two thirds."},
  {"q": "Why can a medium hand bet small but not big on the river?", "choices": ["Worse hands still call a small bet", "Small bets are always bluffs", "Big bets are not allowed"], "answer": 0, "explain": "Against a big bet only better hands call."}
]
```
