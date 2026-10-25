---
id: "7.3"
level: 7
title: 3-bet and 4-bet pots
minutes: 7
prerequisites: ["4.5", "3.4"]
drills: ["postflop:river-qj742-short"]
glossary: ["stack-to-pot ratio", "committed"]
objectives:
  - Explain how a low stack-to-pot ratio changes postflop play.
  - Compare the same river with deep and short stacks.
  - Plan a hand when only one bet is left.
recap:
  - In 3-bet and 4-bet pots the stack-to-pot ratio is low, so one or two bets get everything in.
  - With little behind, medium hands bet more often, often all-in, because there's no later bet to fear.
  - Plan for stacks before the flop; after it, decisions are often about getting it in.
---

3-bet and 4-bet pots are big compared with the stacks behind: the [[stack-to-pot ratio]] is
low (lesson 4.5). That changes which hands bet and for how much.

## Same river, short stacks

The river spot of lesson 4.9, with one change: only 5 bb behind instead of 90 bb.

```widget minisolver
{"spot": "river-qj742-short"}
```

Compare it with the deep version:

```widget minisolver
{"spot": "river-qj742"}
```

With half a pot behind, the first player goes all-in often, and it bets its medium hands
noticeably more than with deep stacks. With little behind, a medium hand risks little by
betting: any raise is small, so it can call it at a good price instead of being pushed off its
hand.

```callout key
Low SPR shrinks the game: fewer bets, fewer bluffs needed, more hands [[committed]]. Medium
hands gain value because they can't be bet off their hand.
```

## Planning before the flop

In a 4-bet pot at 100 bb the SPR is under two (lesson 3.4). Decide before the flop which hands
you'll get all-in with on most boards; after the flop it's usually a question of how, not
whether.

## Worked hand

A 3-bet pot: the pot is 20 bb on the flop and you have 45 bb behind, so the SPR is
{{calc 45 / 20 | dec1}}. You flop top pair with a good kicker.

1. **Bets left:** a pot-sized bet and call leaves {{calc 45 - 20 | int}} bb, less than half the
   new pot.
2. **So** you're committed: plan to get the money in over two streets.
3. **Compare** a 100 bb single-raised pot (SPR above seventeen): the same top pair would want a
   smaller pot.

## Common mistakes

- **Playing a 3-bet pot like a deep one.** One pair is often enough to commit.
- **Folding medium hands to small bets at low SPR.** The price is usually good.
- **Not planning before the flop.** At low SPR the plan is made preflop.

## Check yourself

```quiz
[
  {"q": "Why do medium hands bet more at low SPR?", "choices": ["There's little left for the opponent to punish them with", "They become the nuts", "The rules change"], "answer": 0, "explain": "With little behind, a medium hand risks little by betting."},
  {"q": "The pot is 20 bb and 45 bb are behind. Roughly what is the SPR?", "choices": ["About two", "About ten", "About a half"], "answer": 0, "explain": "45 ÷ 20 is a little over two."},
  {"q": "When should you plan which hands to commit with in a 4-bet pot?", "choices": ["Before the flop", "On the river", "Never"], "answer": 0, "explain": "At low SPR, most of the money goes in on the first postflop bets."}
]
```
