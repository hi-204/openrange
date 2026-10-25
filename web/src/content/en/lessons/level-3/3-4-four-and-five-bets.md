---
id: "3.4"
level: 3
title: 4-bets and 5-bets
minutes: 8
prerequisites: ["3.3", "2.4"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["4-bet", "5-bet", "stack-to-pot ratio"]
objectives:
  - Follow how fast the pot grows after a 4-bet at 100 bb.
  - Work out the price of calling an all-in 5-bet.
  - Name the hands that get all the money in and why.
recap:
  - After a 4-bet at 100 bb, the money left is less than twice the pot, so most hands are committed.
  - Calling an all-in after you 4-bet needs well under half the equity, but only strong hands have it.
  - At 100 bb the stack-offs are mostly AA, KK, A-K and a few more pairs.
---

At 100 bb, a [[4-bet]] puts so much money in the middle that the next decision is often for
everything. This lesson follows the pot.

## How fast the pot grows

The button opens to 2.5 bb, the big blind 3-bets to 10 bb, and the button 4-bets to 23 bb (the 4-bet size
in OpenRange's tree). If the big blind calls, the pot is {{calc 23 + 23 + 0.5 | dec1 | show}} bb and
each player has 77 bb left.

The [[stack-to-pot ratio]] (lesson 4.5) is {{calc 77 / 46.5 | dec1 | show}}: less than two pots
are left. Any further raise would leave too little behind to fold, which is why the next raise,
the [[5-bet]], is all-in.

## Facing the all-in

Now the big blind goes all-in instead of calling. The button has 23 bb in, calls 77 bb, and the
pot will be {{calc 100 + 100 + 0.5 | dec1 | show}} bb. The price is {{calc 77 / 200.5 | pct1 | show}}.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-5bet-BTN-vs-BB"}
```

Most cells are grey: the button only gets here with the hands it 4-bet. Of those, it calls
with AA through 99 and A-K, and folds its 4-bet bluffs.

## Who goes all-in

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-4bet-BB-vs-BTN"}
```

Facing the 4-bet, the big blind goes all-in with AA, KK and A-K; QQ mixes between calling and
all-in. A few small hands also go all-in in this approximate model. Click 44: its all-in and
call EVs are inside each other's sampling margins, so the model can't tell them apart. Don't
copy edge hands from an approximate chart.

```callout key
At 100 bb, once the pot has been 4-bet, calling means calling for most of your stack. Only
hands that are happy to get it all in should continue.
```

## Worked hand

You 4-bet the button with J♠J♦ and the big blind goes all-in.

1. **Price:** {{calc 77 / 200.5 | pct1}}.
2. **Their range:** mostly AA, KK and A-K, plus a few others.
3. **Your equity:** against QQ+ JJ has {{eq JsJd vs QQ+}}; against A-K {{eq JsJd vs AKs, AKo}}.
   Against only those two, it has {{eq JsJd vs QQ+, AKs, AKo}}: a little short of the price.
4. **The model's range is wider.** The big blind's all-in range in the chart above also has
   some smaller pairs (click 44), which JJ beats. The chart calls with JJ, and its call EV is
   far above the fold EV.

Close calls like this depend on the exact range, so check what the opponent really shoves.

## Common mistakes

- **4-betting a hand you'd fold to a 5-bet, without a plan.** Know before you 4-bet.
- **Calling a 4-bet out of position with weak hands.** Little money is left to play with.
- **Copying odd hands from an approximate chart.** Check the EV margins first.

## Check yourself

```quiz
[
  {"q": "After a 4-bet to 23 bb is called at 100 bb, how many bb are left behind?", "choices": ["77", "100", "23"], "answer": 0, "explain": "100 − 23 = 77 for each player."},
  {"q": "Why are 5-bets at 100 bb usually all-in?", "choices": ["The rules require it", "So little is left behind that any raise commits you", "They are always bluffs"], "answer": 1, "explain": "Less than two pots are left after a 4-bet, so a raise leaves too little behind to fold."},
  {"q": "In the chart, which hands does the button call the all-in with?", "choices": ["Every hand it 4-bet", "AA to 99 and A-K", "Only AA"], "answer": 1, "explain": "Its 4-bet bluffs fold; its strong pairs and A-K call."}
]
```
