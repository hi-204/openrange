---
id: "3.3"
level: 3
title: Facing 3-bets
minutes: 8
prerequisites: ["3.2"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["3-bet", "4-bet", "in position", "out of position"]
objectives:
  - Work out the price of calling a 3-bet.
  - Explain how the 3-bet size changes how much the opener continues.
  - Choose between folding, calling and 4-betting with an opening hand.
recap:
  - Calling a 3-bet usually needs more equity than calling an open, because the price is worse.
  - Smaller 3-bets give a better price, so the opener continues with more hands.
  - The best hands 4-bet; good but not great hands call; the rest of the opening range folds.
---

You open, and someone [[3-bet|3-bets]]. Your opening range was built for an unraised pot; now
you must decide which part of it continues.

## The price

The button opens to 2.5 bb and the big blind 3-bets to 10 bb. The button calls 7.5 bb to win a
pot of {{calc 10 + 2.5 + 0.5 + 7.5 | dec1 | show}} bb: {{calc 7.5 / 20.5 | pct1 | show}}. Worse than the big
blind's price against an open, but the button will be [[in position]] for the rest of the hand.

## Size matters

In OpenRange's tree a 3-bet from [[out of position]] is 4× the open, and from in position 3×.
UTG facing a 3-bet to 7.5 bb from the button calls 5 bb into
{{calc 7.5 + 2.5 + 0.5 + 1 + 5 | dec1 | show}} bb: {{calc 5 / 16.5 | pct1 | show}}.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-3bet-UTG-vs-BTN"}
```

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-3bet-UTG-vs-BB"}
```

The legends count only hands that reach the spot (grey cells don't). UTG folds less of its
opening range to the button's smaller 3-bet than to the big blind's bigger one, even though
against the button it will be out of position. In these charts the same holds for the hijack
and the cutoff: the better price wins.

## The button facing the big blind

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-3bet-BTN-vs-BB"}
```

The button continues with more than half of its opening range. Its best hands [[4-bet]]; many
good hands call, using position; the weakest part of the range folds.

```callout key
Facing a 3-bet, your opening range splits three ways: 4-bet the top, call the hands that play
well at this price, fold the rest.
```

## Worked hand

You open A♦J♣ (AJo) on the button and the big blind 3-bets to 10 bb.

1. **Price:** {{calc 7.5 / 20.5 | pct1}}.
2. **Your hand:** strong against a 3-bet range that includes bluffs, weak against A-K and big
   pairs. Not strong enough to 4-bet for value.
3. **Position:** you act last after the flop.

The chart calls. Click AJo to see how the EVs of calling and folding compare.

## Common mistakes

- **Defending your whole opening range.** Some of it has to fold.
- **Ignoring the size.** A small 3-bet gives a better price than a big one.
- **Calling out of position too freely with hands that are often dominated.**

## Check yourself

```quiz
[
  {"q": "You open to 2.5 bb and face a 3-bet to 10 bb. How much do you call?", "choices": ["10 bb", "7.5 bb", "2.5 bb"], "answer": 1, "explain": "You already have 2.5 bb in, so the call is the difference."},
  {"q": "In OpenRange's charts, does the opener continue more against a small or a big 3-bet?", "choices": ["A small 3-bet", "A big 3-bet", "The same"], "answer": 0, "explain": "A smaller 3-bet gives a better price, so more of the opening range can continue."},
  {"q": "Which part of your opening range should 4-bet?", "choices": ["The weakest hands", "The strongest hands, plus a few bluffs", "Every suited hand"], "answer": 1, "explain": "The top of the range wants more money in; lesson 3.4 covers the bluffs."}
]
```
