---
id: "4.6"
level: 4
title: Check-raising
minutes: 7
prerequisites: ["4.4"]
drills: ["postflop:turn-qj74", "postflop:turn-kt63"]
glossary: ["check-raise", "semi-bluff"]
objectives:
  - Say what a check-raise is and why the out-of-position player uses it.
  - Name the two kinds of hands in a check-raising range.
  - Read the solver's response to a bet after a check.
recap:
  - A check-raise is checking, then raising when your opponent bets.
  - Check-raises combine very strong hands with some draws; medium hands mostly call.
  - It's the out-of-position player's main way to punish bets after a check.
---

Out of position, you act first. If you check and your opponent bets, you can raise: a
[[check-raise]]. It's how the player who acts first fights back.

## Solve a spot

```widget minisolver
{"spot": "turn-qj74"}
```

After solving, take the line where the first player checks and the second bets the pot (10 bb).
Click hands in the grid and look at which raise.

In this spot, against a pot-sized bet after a check:

- **Two pair or better** never folds; about half of it raises.
- **One pair** mostly calls or folds, and very rarely raises.
- **Draws** split by strength. Open-ended straight draws such as T♠9♠ mostly raise; weak draws
  such as A-K (only a gutshot) mostly fold. Weak draws are more common, so draws as a group
  mostly fold.

So the raises are very strong hands (the largest group), some big pairs and the best draws. A
draw that raises is a [[semi-bluff]]: it may make the opponent fold now, and if called it can
still improve.

## Why draws, not weak pairs?

A weak pair that raises gets called by better hands and folds out worse ones. A draw that
raises can win at once, and has outs when called. That's why the solver mixes draws, not
medium pairs, into its raises.

## A board with flush draws

```widget minisolver
{"spot": "turn-kt63"}
```

On K♥T♥6♥3♠ the same pattern holds: the strongest hands raise or call, pairs call or fold, and
a few draws raise.

```callout key
Raise with hands that are happy to play a big pot (very strong) or that can win in two ways
(draws). Call with the medium hands.
```

## Worked hand

On Q♠J♥7♦4♣ you hold T♠9♠ out of position: an open-ended straight draw (an eight or a king
makes a straight). You check, and your opponent bets the pot.

1. **Calling** costs 10 bb for a final pot of 30 bb: a price of {{calc 10 / 30 | pct1}}. With 8
   outs among the 46 cards you haven't seen, the river makes your straight
   {{calc 8 / 46 | pct1}} of the time (lesson 2.2). Not enough on its own.
2. **Raising** wins at once when they fold and keeps your outs when they call.
3. **The solver** check-raises T9s most of the time. Eight outs make it the kind of draw that
   can win two ways. Compare A-K, a gutshot with half the outs, which mostly folds.

## Common mistakes

- **Check-raising only monsters.** Your opponent can then fold everything but monsters.
- **Check-raising medium pairs.** They don't want a big pot, and worse hands fold.
- **Never check-raising.** Then betting after your check costs your opponent nothing.

## Check yourself

```quiz
[
  {"q": "What is a check-raise?", "choices": ["Checking, then raising after your opponent bets", "Raising before the flop", "Betting after a check"], "answer": 0, "explain": "You check first, then raise their bet."},
  {"q": "Which hands mostly make up a solver's check-raises in the spot above?", "choices": ["Medium pairs", "Very strong hands plus some draws", "Only bluffs with nothing"], "answer": 1, "explain": "Strong hands want a big pot; draws can win now or improve."},
  {"q": "What do medium pairs mostly do facing a bet after checking?", "choices": ["Raise", "Call or fold", "Go all-in"], "answer": 1, "explain": "They're too weak to raise for value and too strong to bluff with."}
]
```
