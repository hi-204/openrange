---
id: "3.1"
level: 3
title: Defending against opens
minutes: 8
prerequisites: ["1.5", "2.3"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["3-bet", "cold call", "closing the action"]
objectives:
  - Work out the big blind's price against an open.
  - Explain why the big blind defends far more against the button than against UTG.
  - Explain why seats with players behind them mostly 3-bet or fold.
recap:
  - The big blind already has a big blind in and closes the action, so it gets a good price.
  - Against a tight early open, defend tightly; against a wide button open, defend widely.
  - With players still to act behind, calling invites trouble, so those seats mostly 3-bet or fold.
---

Someone opens and the action is on you. You can fold, call or [[3-bet]] (re-raise). Which you
choose depends on who opened, where you sit, and who is still behind you.

## The big blind's discount

The button opens to 2.5 bb and the small blind folds. The big blind already has 1 bb in, so it
calls 1.5 bb to win a pot of {{calc 2.5 + 0.5 + 1 + 1.5 | dec1 | show}} bb. The price is
{{calc 1.5 / 5.5 | pct1 | show}}: cheap. The big blind is also [[closing the action]]: nobody acts
after it before the flop, so a call can't be raised.

## Against the button and against UTG

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BB-vs-BTN"}
```

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BB-vs-UTG"}
```

Compare the legends. Against the button's wide range, the big blind defends (calls or 3-bets)
more than half of its hands. Against UTG's tight range it defends less than half as often, and
it 3-bets only big pairs and A-K.

## Seats with players behind

Now the button facing a cutoff open:

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BTN-vs-CO"}
```

The button almost never calls. A [[cold call]] here leaves both blinds to act: either can
re-raise (a squeeze, lesson 3.6) or call and make the pot three-way. A 3-bet takes the lead and
often wins the pot at once. The small blind facing a button open is similar: it mostly 3-bets
or folds, because it would also be out of position after the flop.

```callout key
Defend wider against wider opens. Call mostly when you close the action; with players behind
you, prefer 3-bet or fold.
```

## Worked hand

You are in the big blind with K♠9♦ (K9o).

- **The button opens.** Its range is wide, the price is good and you close the action: the chart
  calls.
- **UTG opens.** Its range is strong; K9o is often dominated by K-Q, K-J and A-K: the chart folds.

Click K9o on both charts to see the frequencies and EVs.

## Common mistakes

- **Defending the same hands against every seat.** The opener's range sets your defence.
- **Calling from the button with both blinds behind.** It invites squeezes and multiway pots.
- **Folding the big blind too much.** The discount and closing the action make many calls pay.

## Check yourself

```quiz
[
  {"q": "The button opens to 2.5 bb and the small blind folds. What price does the big blind get?", "choices": ["About 27 in 100", "About 50 in 100", "About 10 in 100"], "answer": 0, "explain": "Call 1.5 bb to win a 5.5 bb pot: divide the call by the final pot."},
  {"q": "Why does the big blind defend more against the button than against UTG?", "choices": ["The button's range is wider and weaker", "The button always bluffs", "UTG raises more chips"], "answer": 0, "explain": "UTG opens only strong hands; the button opens many more hands, so more of yours do well against it."},
  {"q": "Why does the button rarely call a cutoff open?", "choices": ["Calling is not allowed", "Both blinds are still to act and can squeeze or join", "The button is out of position"], "answer": 1, "explain": "A call leaves two players behind; a 3-bet takes the lead and can win the pot at once."}
]
```
