---
id: "3.2"
level: 3
title: 3-betting for value and as a bluff
minutes: 8
prerequisites: ["3.1", "2.5"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["3-bet", "value", "bluff"]
objectives:
  - Explain the two reasons to 3-bet.
  - Work out how often a 3-bet bluff must win the pot at once to break even.
  - Recognise value hands and bluffs in a 3-bet range.
recap:
  - Value 3-bets want calls from worse hands; bluff 3-bets want folds and have a backup plan.
  - A pure-bluff 3-bet to 10 bb against a 2.5 bb open needs folds about seven times in ten.
  - Bluffs are usually hands too weak to call well but with something to fall back on.
---

A [[3-bet]] has two jobs. With your best hands it builds a bigger pot while you're ahead: a
[[value]] 3-bet. With some weaker hands it makes the opener fold: a [[bluff]] 3-bet.

## Value: the hands everybody 3-bets

In every OpenRange chart where a player faces an open, AA, KK, QQ and A-K 3-bet. They are ahead
of the hands that call or 4-bet, and they want more money in.

## Bluffs: the math

The big blind 3-bets to 10 bb against a 2.5 bb button open. It has 1 bb in already, so it
risks 9 more to win the {{calc 2.5 + 0.5 + 1 | int | show}} bb in the pot. As a pure bluff, giving up whenever
it's called, it breaks even when the button folds
{{calc 9 / (9 + 4) | pct1 | show}} of the time.

No real hand is a pure bluff: when called, it still has equity and can win after the flop. That
backup plan is why the bluffs in a 3-bet range are suited or connected hands that play well
when called, not the worst hands.

## Two shapes of 3-bet range

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BTN-vs-CO"}
```

The button against a cutoff open almost never calls, so its 3-bets include its value hands and
also hands like A5s, 76s and 65s. Those hands are calls in the big blind's chart below, where
calling is cheap; here they 3-bet or fold.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BB-vs-BTN"}
```

The big blind can call cheaply, so its 3-bets are mostly strong hands. The suited aces from A9s
down are calls here, though the button 3-bets many of them.

```callout key
Where calling is a good option, 3-bets are mostly strong hands. Where calling isn't, the 3-bet
range also takes the hands that would have called, and becomes wider.
```

## Worked hand

You are on the button with 6♠5♠ and the cutoff opens.

1. **Calling is poor:** both blinds are still behind (lesson 3.1).
2. **Folding gives up a playable hand.**
3. **A 3-bet** wins the pot at once when the cutoff folds and, when called, you have position
   and a hand that makes straights and flushes. The chart 3-bets.

## Common mistakes

- **Bluffing with the worst hands.** Choose hands that can still win when called.
- **Only 3-betting the very best hands everywhere.** Where you can't call, a value-only range
  folds too much.
- **Forgetting the price.** A big 3-bet bluff needs many folds; check the math.

## Check yourself

```quiz
[
  {"q": "What does a value 3-bet want?", "choices": ["Folds from better hands", "Calls from worse hands", "To see a cheap flop"], "answer": 1, "explain": "With a strong hand you want worse hands to put more money in."},
  {"q": "A pure-bluff 3-bet risks 9 bb to win 4 bb. How do you find the fold rate it needs?", "choices": ["4 ÷ 9", "9 ÷ (9 + 4)", "9 − 4"], "answer": 1, "explain": "Risk divided by risk plus reward, as in lesson 2.5."},
  {"q": "Why are suited connectors better 3-bet bluffs than very weak offsuit hands?", "choices": ["They are always ahead", "They play well when called", "They block aces"], "answer": 1, "explain": "When the opener calls, they can still make straights and flushes."}
]
```
