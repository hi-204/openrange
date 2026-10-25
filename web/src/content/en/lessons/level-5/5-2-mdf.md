---
id: "5.2"
level: 5
title: Minimum defence frequency
minutes: 7
prerequisites: ["5.1"]
drills: ["math:mdf"]
glossary: ["minimum defence frequency", "bluff catcher"]
objectives:
  - Derive the minimum defence frequency from a bluff's break-even point.
  - Work it out for common bet sizes.
  - Know when the MDF doesn't apply.
recap:
  - A pure bluff of B into P breaks even when it gets folds B ÷ (P + B) of the time.
  - Continuing with at least P ÷ (P + B) of your range stops any bluff from profiting at once.
  - When the bettor can't have enough bluffs, or before the river, defending the full MDF is wrong.
---

Facing a bet, how much of your range must you keep? The [[minimum defence frequency]] (MDF)
answers that for one specific threat: a bettor who could bet any hand as a bluff.

## Where it comes from

A pure bluff of B into a pot P wins P when you fold and loses B when you call. It breaks even
when you fold B ÷ (P + B) of the time (lesson 2.5). Continue more than the rest,

$$
\text{MDF} = \frac{P}{P + B},
$$

and no bluff can profit at once.

| Bet | MDF |
|---|---|
| half the pot | {{calc 1 / (1 + 0.5) \| pct1}} |
| the pot | {{calc 1 / (1 + 1) \| pct1}} |
| twice the pot | {{calc 1 / (1 + 2) \| pct1}} |

```widget sizing
{"pot": 10, "bet": 10}
```

In the river game of lesson 5.1, the caller calls exactly the MDF. In the river spot of
lesson 4.9, the defender stays within a few points of it at every size.

## When it doesn't apply

The MDF assumes the bettor has enough bluffs to punish you for folding. Sometimes they don't:

```widget toygame
{"bet": 100, "air": 0.25}
```

Here the bettor has only a quarter of an air hand per value hand, fewer than the bluffs that
would make the caller indifferent. Every air hand bluffs, the bets are still mostly value,
and the caller's best play is to fold every time, far below the MDF. Solve it to see the engine
agree.

Other limits:

- **Before the river** the bettor's bluffs have equity, and your folds cost you future
  streets too. The MDF is only a rough guide there.
- **Raises** change everything: the MDF ignores them.
- **It's about your whole range**, not a rule to call with this hand.

```callout mistake
Calling with your worst hands to "reach MDF" against an opponent whose bets are almost always
value. Against a range with too few bluffs, folding more is right.
```

## Worked hand

The pot is 12 bb and your opponent bets 6 bb on the river.

1. **MDF:** {{calc 12 / (12 + 6) | pct1 | show}}.
2. **Your range:** suppose half of it is a [[bluff catcher]] (beats a bluff, loses to value)
   and the rest is weaker.
   To defend the MDF you'd call with the best bluff catchers and some weaker ones.
3. **But** if this opponent rarely bluffs, defend less: the MDF protects you from bluffs that
   aren't there.

## Common mistakes

- **Using the pot after the bet.** P is the pot before the bet.
- **Treating MDF as a rule for every hand.** It's a share of your range.
- **Defending MDF before the river without thinking about equity and later streets.**

## Check yourself

```quiz
[
  {"q": "The pot is 10 bb and the bet is 5 bb. What is the MDF?", "choices": ["Two thirds", "One half", "One third"], "answer": 0, "explain": "10 ÷ (10 + 5) = two thirds."},
  {"q": "What does defending the MDF protect against?", "choices": ["Value bets", "A bettor who could bluff with any hand", "Raises"], "answer": 1, "explain": "It stops a pure bluff from profiting at once."},
  {"q": "In the river game with very little air, what does the caller do?", "choices": ["Calls the MDF", "Folds every time", "Raises"], "answer": 1, "explain": "The bettor can't have enough bluffs, so calling always loses."}
]
```
