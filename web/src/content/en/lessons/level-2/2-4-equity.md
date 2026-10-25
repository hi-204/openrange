---
id: "2.4"
level: 2
title: Equity against hands and ranges
minutes: 8
prerequisites: ["2.2", "2.3"]
drills: ["math:equity"]
glossary: ["equity", "range", "coin flip"]
objectives:
  - Say what equity means and how ties count.
  - Work out equity against a range as an average over its hands.
  - Use equity against a range to make a decision.
recap:
  - Equity is your share of the pot on average if all the cards were dealt with no more betting.
  - Against a range, equity is the average over its hands, weighted by how many combos each has.
  - You rarely know one hand, so think in ranges and compare the equity with the price.
---

[[Equity]] is your share of the pot if all the remaining cards were dealt and nobody bet again.
Win the whole pot and that runout counts as 1; split it and it counts as half.

## Against one hand

Some famous matchups before the flop, computed exactly by the engine over every board:

| Your hand | Against | Your equity |
|---|---|---|
| A♥K♥ | Q♠Q♦ | {{eq AhKh vs QsQd}} |
| A♥K♦ | 7♣7♦ | {{eq AhKd vs 7c7d}} |
| J♠J♦ | A♣K♣ | {{eq JsJd vs AcKc}} |
| K♠K♦ | A♣A♦ | {{eq KsKd vs AcAd}} |

A pair against two higher cards is close to a [[coin flip]]. A pair against a higher pair is
not: the higher pair wins about four times in five.

```widget equity
{"ranges": ["AhKh", "QsQd"]}
```

## Against a range

You almost never know your opponent's exact hand. You can usually say which hands they would
play this way: their [[range]]. Your equity against a range is the average of your equity
against each hand in it, weighted by how many combos each hand has.

Say you hold J♠J♦ and an opponent goes all-in with QQ+ or A-K:

- against QQ+ you have {{eq JsJd vs QQ+}};
- against A-K you have {{eq JsJd vs AKs, AKo}};
- against the whole range: {{eq JsJd vs QQ+, AKs, AKo}}.

A-K has 16 combos and QQ+ has 18, so the average sits between the two.

```widget equity
{"ranges": ["JsJd", "QQ+, AKs, AKo"]}
```

```callout key
Equity against a range is an average. The hands with the most combos count the most.
```

## Equity isn't the whole story

Equity assumes nobody bets again. Before the river, the player who acts last, or who has the
stronger range, often wins more than their equity; others win less. Lesson 4.4 returns to this.
All-in, though, equity is exactly what you get on average.

## Worked hand

You hold J♠J♦. Your opponent goes all-in for 50 bb into a pot of 10 bb, and you think they do it
with QQ+ or A-K.

1. **Price:** you call 50 bb to win 10 + 50 + 50 = 110 bb: {{calc 50 / 110 | pct1 | show}}.
2. **Equity:** {{eq JsJd vs QQ+, AKs, AKo}} against that range.
3. **Decision:** your equity is below the price, so folding loses less on average.

If they also went all-in with smaller pairs, your equity would rise and the call could pay.

## Common mistakes

- **Equity against their best hand only.** They have a range; weigh every part.
- **Ignoring combo counts.** A-K (16 combos) is more likely than AA (6).
- **Using equity as a promise before the river.** Later betting changes what you actually win.

## Check yourself

```quiz
[
  {"q": "You split the pot on a runout. How does it count in equity?", "choices": ["As a win", "As half", "As a loss"], "answer": 1, "explain": "A split gives you half the pot on that runout."},
  {"q": "Your opponent has either AA or AK. Which matters more for your equity?", "choices": ["AA, because it's stronger", "AK, because it has more combos", "Both the same"], "answer": 1, "explain": "AK has 16 combos and AA has 6, so AK carries more weight in the average."},
  {"q": "A pair against two higher cards before the flop is roughly…", "choices": ["A coin flip", "A big favourite", "A big underdog"], "answer": 0, "explain": "See the table: the pair has a small edge, close to half."},
  {"q": "When is equity exactly what you win on average?", "choices": ["On the flop", "When all the money is in", "Always"], "answer": 1, "explain": "With no more betting, the cards decide and equity is your average share."}
]
```
