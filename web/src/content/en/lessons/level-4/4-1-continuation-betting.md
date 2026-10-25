---
id: "4.1"
level: 4
title: Continuation betting
minutes: 8
prerequisites: ["2.4", "3.1"]
drills: ["postflop:flop-qj4"]
glossary: ["continuation bet", "range bet", "range"]
objectives:
  - Say what a continuation bet is and what it's for.
  - Explain why a player with a much stronger range can bet small with almost everything.
  - Read a solved flop node in the mini solver.
recap:
  - A continuation bet is a bet on the flop by the player who raised last before the flop.
  - When your range is much stronger on the board, a small bet with most of it often works best.
  - How often and how big depend on the board, the ranges and position, not a fixed rule.
---

The player who made the last raise before the flop often bets again on the flop: a
[[continuation bet]] (c-bet). It continues the story told by the raise. Whether it's a good
idea depends on how the board hits both [[range|ranges]].

## Who the board favours

Here is a small example spot (its ranges are inputs, not solver output). The out-of-position
player has the stronger range, as a preflop raiser often does:

```widget advantage
{"a": "TT+, AJs+, KQs, AQo+", "b": "88+, ATs+, KJs+, QJs, JTs, AJo+", "board": "Qs Jh 4d"}
```

On Q♠J♥4♦, range A has more equity and more very strong hands.

## What the solver does

Solve the same spot below (it takes about half a minute in the browser). On the flop each
player may bet a third of the pot, with no raises.

```widget minisolver
{"spot": "flop-qj4"}
```

The out-of-position player bets almost its whole range at that small size: strong hands, pairs
and draws alike. This is a [[range bet]]. When your range is much stronger, a small bet
makes many of your opponent's hands pay or fold, and you lose little when they have something.
Facing the small bet, the other player folds only a small part of its range.

```callout key
A c-bet isn't automatic. Bet often and small when the board favours your range; check more
when it favours your opponent's.
```

## What changes the answer

- **The board.** A board that hits the caller's range (lesson 4.3) calls for fewer c-bets.
- **Position.** In position you can check behind and still act last on the turn.
- **Opponents.** Against two or more callers, someone is more likely to have hit.

## Worked hand

You hold A♣K♦ on Q♠J♥4♦ in the spot above, first to act.

1. **Your hand:** no pair, but two overcards and a gutshot (a ten makes a straight).
2. **Your range:** much stronger than your opponent's on this board.
3. **The solver:** bets A-K almost every time, along with the rest of the range. Click A-K in
   the solved grid to check.

## Common mistakes

- **C-betting every flop because you raised.** Look at how the board hits both ranges.
- **Using a big size with a range bet.** A big bet with your whole range risks too much with
  the weak part.
- **Giving up every time you miss.** Your range, not just your hand, decides.

## Check yourself

```quiz
[
  {"q": "What is a continuation bet?", "choices": ["Any bet on the turn", "A flop bet by the player who raised last before the flop", "A call after a raise"], "answer": 1, "explain": "It continues the aggression from before the flop."},
  {"q": "Your range is much stronger on this flop. What does the solver tend to do?", "choices": ["Bet big with only strong hands", "Bet small with almost everything", "Check everything"], "answer": 1, "explain": "A small range bet works when the board favours you strongly."},
  {"q": "Which flop calls for fewer c-bets?", "choices": ["One that hits the caller's range", "One that hits the raiser's range", "A dry ace-high flop"], "answer": 0, "explain": "When the caller has more strong hands, betting with everything loses value."}
]
```
