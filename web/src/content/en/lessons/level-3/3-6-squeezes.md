---
id: "3.6"
level: 3
title: Squeezes
minutes: 7
prerequisites: ["3.2"]
drills: ["preflop:cash-6max-100bb.json"]
glossary: ["squeeze", "capped range", "dead money"]
objectives:
  - Say what a squeeze is and how big it is in OpenRange's tree.
  - Explain why a caller's range makes squeezing attractive.
  - Compare the big blind's play with and without a caller.
recap:
  - A squeeze is a 3-bet after an open and a call; it's bigger because there's more in the pot.
  - The caller rarely has a premium hand, and the call adds dead money.
  - With a caller in, the big blind 3-bets more and calls much less.
---

The button opens, the small blind calls, and you are in the big blind. A 3-bet here is a
[[squeeze]]: you're raising two players at once.

## How big

In OpenRange's tree an out-of-position 3-bet is 4× the open, plus 1× the open for each caller:
{{calc 4 * 2.5 + 2.5 | dec1 | show}} bb. The pot is {{calc 2.5 + 2.5 + 1 | int | show}} bb, so a pure bluff risks 11.5 bb to win
6 bb and needs both players to fold {{calc 11.5 / (11.5 + 6) | pct1 | show}} of the time.

## Why it works

- **The caller's range is [[capped range|capped]].** With AA or KK the small blind would have
  3-bet, not called. Look at its calls against the button:

```widget chart
{"file": "cash-6max-100bb.json", "chart": "vs-open-SB-vs-BTN"}
```

- **[[Dead money]].** The caller's 2.5 bb is in the pot and often folds to the squeeze.
- **Calling is worse.** Calling makes a three-way pot where the big blind is out of position
  against both.

## With and without a caller

```widget chart
{"file": "cash-6max-100bb.json", "chart": "squeeze-BB-vs-BTN-SB"}
```

Compare with the big blind against a button open alone (lesson 3.1): with the small blind in,
the big blind 3-bets more and calls much less.

```callout key
A call in front of you is often an invitation: the caller is capped and their money is dead.
Squeeze more, call less.
```

## Worked hand

The button opens, the small blind calls, and you hold K♦Q♣ (KQo) in the big blind.

1. **Calling** makes a three-way pot out of position with a hand that is often dominated.
2. **Squeezing** to 12.5 bb often wins 6 bb at once, and KQo is ahead of much of what calls.
3. The chart squeezes. Click KQo to compare the EVs.

## Common mistakes

- **Calling behind a caller with hands that should squeeze or fold.**
- **Forgetting the size.** A squeeze must be bigger than a normal 3-bet.
- **Squeezing a tight early opener with weak hands.** The opener's range still matters.

## Check yourself

```quiz
[
  {"q": "What is a squeeze?", "choices": ["A 3-bet after an open and a call", "A small bet on the river", "Calling two players"], "answer": 0, "explain": "It's a re-raise when there's an open and at least one caller."},
  {"q": "Why is the caller's range capped?", "choices": ["They called instead of 3-betting their best hands", "They are in the small blind", "They have a short stack"], "answer": 0, "explain": "With AA or KK they would usually have re-raised."},
  {"q": "With a caller in, what does the big blind do differently in the charts?", "choices": ["Calls more", "3-bets more and calls less", "Nothing"], "answer": 1, "explain": "Compare the squeeze chart with the big blind against the button alone."}
]
```
