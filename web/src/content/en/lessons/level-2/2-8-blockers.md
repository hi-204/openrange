---
id: "2.8"
level: 2
title: Blockers
minutes: 6
prerequisites: ["2.7"]
drills: ["math:combos"]
glossary: ["blocker", "card removal", "range"]
objectives:
  - Say what a blocker is and count its effect.
  - Use blockers to judge an opponent's range before the flop and on the river.
  - Know why blockers are a tie-breaker, not a reason on their own.
recap:
  - A card in your hand is a card your opponent can't have.
  - Blocking their strong hands makes a bluff more likely; blocking their bluffs does the opposite.
  - Blockers shift combos a little; they rarely decide a hand on their own.
---

A [[blocker]] is a card in your hand that makes some of your opponent's hands impossible or
less likely. It's [[card removal]] (lesson 2.7) used on purpose.

## Before the flop

An opponent 4-bets with QQ+ or A-K. Without blockers that [[range]] is
{{calc 6 + 6 + 6 + 16 | int | show}} combos. Holding A♠:

- AA drops from 6 combos to {{calc 3 * 2 / 2 | int}};
- AK drops from 16 to {{calc 3 * 4 | int}};
- KK and QQ stay at 6.

The range shrinks to {{calc 3 + 6 + 6 + 12 | int | show}} combos, and the share that is AA or AK
falls. Try other cards:

```widget combos
{"hand": "AK", "dead": "As"}
```

## On the river

The board is K♥9♥4♥7♣2♦. Your opponent bets big. If they have a flush, they hold two hearts.
Hearts you can't see: 13 − 3 on the board = 10, so they could have {{calc 10 * 9 / 2 | int}}
heart combos. Holding A♥:

- 9 hearts are left: {{calc 9 * 8 / 2 | int}} combos;
- none of them is the A♥ flush, the best possible hand.

You block the nuts and some of the flushes, so a bluff is a little more likely. Holding no
heart, every flush stays possible.

```callout key
Blocking their value hands makes a bluff more likely; blocking their bluffs makes value more
likely. Both effects are usually small.
```

## Worked hand

On the river above you hold A♥J♣, a pair-less hand with the A♥. Your opponent bets.

1. **Your hand can only beat a bluff.** Ace-high wins against busted draws and nothing else.
2. **Blockers:** you remove the nut flush and 9 heart combos.
3. **Decision:** blockers make calling a little better than with a hand without the A♥, but the
   main question is still the price against their whole range (lesson 2.3).

## Common mistakes

- **Calling just because you hold a blocker.** It shifts a few combos; the price still matters.
- **Forgetting the board.** Board cards block too, for both players.
- **Only thinking about value hands.** Your cards can also block the bluffs you hope they have.

## Check yourself

```quiz
[
  {"q": "You hold a king. How many KK combos can your opponent have?", "choices": ["Three", "Six", "One"], "answer": 0, "explain": "Three kings are left: 3 × 2 ÷ 2 = 3."},
  {"q": "Three hearts are on the board and you hold the ace of hearts. What can't your opponent have?", "choices": ["Any flush", "The ace-high flush", "Two pair"], "answer": 1, "explain": "The ace-high flush needs the ace of hearts, which is in your hand."},
  {"q": "What's the right role for blockers in a decision?", "choices": ["The main reason to call", "A tie-breaker between close options", "Irrelevant"], "answer": 1, "explain": "They shift a few combos; use them when the other factors are close."}
]
```
