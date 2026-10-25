---
id: "3.7"
level: 3
title: Calling vs raising ranges
minutes: 7
prerequisites: ["3.1", "3.2", "2.5"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["cold call", "capped range", "expected value"]
objectives:
  - Explain what calling too wide costs.
  - Read the EVs of calling and raising in a chart.
  - Know when calling is the right default.
recap:
  - Calling gives up the chance to win now and caps your range.
  - In OpenRange's model, for most hands the button plays against a cutoff open, 3-betting is worth more than calling.
  - Calling is the default where you close the action at a good price, as in the big blind.
---

A call feels safe: you keep your hand and see a flop. But a [[cold call]] has costs that a raise
doesn't, and charts show them.

## What a call gives up

- **The pot now.** A 3-bet sometimes wins at once; a call never does.
- **Strength in your range.** If you'd 3-bet your best hands, your calls are [[capped range|capped]],
  and opponents can bet more freely against them later.
- **Control.** With players behind, a call invites squeezes and multiway pots.

## Reading the EVs

Click a cell in any chart to see each action's frequency and its [[expected value]], measured
in bb from the start of the hand (so folding the big blind shows −1 bb). The ± is the sampling
margin; differences inside it are noise.

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BTN-vs-CO"}
```

Click 77, KQo or KJs: 3-betting is worth clearly more than calling. For most hands the button
plays here, the model's 3-bet EV is above its call EV, which is why it almost never calls.

## Where calling is right

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-BB-vs-BTN"}
```

The big blind closes the action and gets a good price (lesson 3.1), so calling is its main
defence. Click A5s: here a call is worth more than a 3-bet.

```callout key
Call where you close the action at a good price. Elsewhere, ask whether a raise or a fold beats
the call, because it often does.
```

## Worked hand

You hold 7♥7♣ on the button, and the cutoff opens.

1. **Call:** you see a flop in position, but the blinds can squeeze, and you never win the pot
   at once.
2. **3-bet:** you often win the pot now, and when called you have a decent hand in position.
3. **The model:** the 3-bet EV is above the call EV by more than the sampling margin. The chart
   3-bets.

## Common mistakes

- **Calling because raising "risks more".** The question is EV, not how much goes in.
- **Calling with players behind.** It invites squeezes.
- **Treating close EVs as different.** Check the margin before you trust a small difference.

## Check yourself

```quiz
[
  {"q": "What does a cold call never do that a 3-bet sometimes does?", "choices": ["Win the pot at once", "See a flop", "Keep position"], "answer": 0, "explain": "After a call the hand goes on; a 3-bet can make everyone fold."},
  {"q": "Why does the big blind call so often against a button open?", "choices": ["It closes the action at a good price", "It can't 3-bet", "Calls are always better"], "answer": 0, "explain": "Nobody can raise behind it, and it already has a big blind in."},
  {"q": "A chart shows call EV and raise EV within each other's sampling margins. What should you conclude?", "choices": ["Raise is clearly better", "The model can't tell them apart", "Call is clearly better"], "answer": 1, "explain": "Inside the margin, the difference may be sampling noise."}
]
```
