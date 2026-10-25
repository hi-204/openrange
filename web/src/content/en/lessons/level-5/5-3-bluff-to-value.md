---
id: "5.3"
level: 5
title: Bluff-to-value ratios
minutes: 7
prerequisites: ["5.1"]
drills: ["math:bluff"]
glossary: ["value", "bluff", "polarized"]
objectives:
  - Derive the share of bluffs in a polarized river betting range.
  - Turn it into a ratio of value bets to bluffs for common sizes.
  - Know why bigger bets allow more bluffs.
recap:
  - Bluffs should be B ÷ (P + 2B) of a polarized river betting range, the caller's price.
  - That's P + B value bets for every B bluffs.
  - Bigger bets give a worse price, so they allow a bigger share of bluffs.
---

A [[polarized]] river bet contains [[value]] hands and [[bluff|bluffs]]. How many bluffs? Enough
to make the opponent's bluff catchers indifferent, and no more.

## The formula

A caller facing B into P pays B to win P + 2B, so their price is B ÷ (P + 2B). If exactly that
share of the bets are bluffs, calling breaks even. That's the bluff share at equilibrium:

$$
\text{bluffs} = \frac{B}{P + 2B}, \qquad \text{value : bluffs} = (P + B) : B.
$$

| Bet | Bluffs among the bets | Value bets per bluff |
|---|---|---|
| a third of the pot | {{calc 1 / (3 + 2) \| pct1}} | {{calc (3 + 1) / 1 \| dec1}} |
| half the pot | {{calc 1 / (2 + 2) \| pct1}} | {{calc (2 + 1) / 1 \| dec1}} |
| the pot | {{calc 1 / (1 + 2) \| pct1}} | {{calc (1 + 1) / 1 \| dec1}} |
| twice the pot | {{calc 2 / (1 + 4) \| pct1}} | {{calc (1 + 2) / 2 \| dec1}} |

## See it solved

```widget toygame
{"bet": 50, "air": 2}
```

Move the bet slider and solve again: the share of bluffs among the engine's bets follows the
formula at every size.

```callout key
The bigger the bet, the worse the caller's price, and the more bluffs your bets can carry.
```

## Worked hand

On the river you bet the pot with a polarized range of 12 value combos.

1. **Bluffs needed:** a third of the bets, so 1 bluff for every 2 value bets.
2. **So:** about {{calc 12 / 2 | int}} bluff combos.
3. **With fewer bluff candidates** than that, bluff with all of them; your opponent should then
   fold their bluff catchers more (lesson 5.2).

## Common mistakes

- **Using river ratios on the flop.** Earlier bluffs have equity, so they can be more.
- **Counting hands instead of combos.** Ratios are about combos.
- **Bluffing a lot with a small bet.** Small bets give a good price, so they allow few bluffs.

## Check yourself

```quiz
[
  {"q": "You bet half the pot on the river with a polarized range. What share of the bets can be bluffs?", "choices": ["One quarter", "One third", "One half"], "answer": 0, "explain": "B ÷ (P + 2B) with B = P ÷ 2 gives one quarter."},
  {"q": "How many value bets per bluff go with a pot-sized bet?", "choices": ["One", "Two", "Three"], "answer": 1, "explain": "(P + B) : B = 2 : 1."},
  {"q": "Why do bigger bets allow more bluffs?", "choices": ["They give the caller a worse price", "They are always called", "They are allowed by the rules"], "answer": 0, "explain": "The caller needs more equity, so more of your bets can be bluffs while calling still only breaks even."}
]
```
