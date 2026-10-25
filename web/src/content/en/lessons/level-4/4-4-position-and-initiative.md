---
id: "4.4"
level: 4
title: Position and initiative
minutes: 7
prerequisites: ["1.1", "4.3"]
drills: ["postflop:turn-qj74"]
glossary: ["equity realization", "initiative", "in position"]
objectives:
  - Say what equity realization means.
  - Explain why the same range wins more in position.
  - Explain what the initiative is and where it comes from.
recap:
  - Equity realization is how much of your equity you actually win once the betting is played out.
  - The same range wins more in position than out of position, in every example below.
  - The initiative belongs to the last aggressor; it comes with the stronger range, not by itself.
---

Equity (lesson 2.4) assumes no more betting. With betting, some hands win more than their
equity and some less. How much you keep is your [[equity realization]].

## An experiment

Take the turn spot below, Q♠J♥7♦4♣ with a 10 bb pot. Solve it, then imagine swapping the two
ranges between the seats. OpenRange's tests do exactly that (you can repeat it on the Solve
page by swapping the ranges):

```widget minisolver
{"spot": "turn-qj74"}
```

- The stronger range wins a little more than its equity **out of position**, and clearly more
  **[[in position]]**.
- The weaker range wins less than its equity either way, but much less out of position.

On K♥T♥6♥3♠ the numbers differ, but again each range wins more in position than out of it.
Same cards, same ranges; the only change is who acts last.

## Why position is worth so much

- **Information:** you see what your opponent does before you decide.
- **Control:** you can check behind to take a free card or to keep the pot small.
- **The last word:** on the river you decide whether there's a final bet.

## The initiative

The player who made the last aggressive action before the flop has the [[initiative]]: they're
expected to bet next. The initiative isn't magic. It's valuable because the aggressor's range is
usually stronger (the caller's is capped, lesson 3.6), so betting again often makes sense.

```callout key
Position lets you realize more of your equity. The initiative is worth something when it comes
with the stronger range.
```

## Worked hand

You hold 9♠8♠ before the flop, facing a raise.

- **On the button:** you'll act last on every street. A hand that needs to see cards and make
  straights realizes its equity well here.
- **In the small blind:** you'll act first on every street, against the opener and maybe the
  big blind. The same hand wins less of its equity.

This is why ranges in lessons 1.5 and 3.1 widen with position.

## Common mistakes

- **Treating equity as what you'll win.** Position changes the answer.
- **Betting just because you have the initiative.** Look at the ranges first.
- **Calling out of position with hands that need to see cards cheaply.**

## Check yourself

```quiz
[
  {"q": "What is equity realization?", "choices": ["Your equity before the flop", "How much of your equity you actually win once betting is played out", "Your share of the blinds"], "answer": 1, "explain": "Betting on later streets changes what each hand wins."},
  {"q": "In the experiment, what changes when the ranges swap seats?", "choices": ["Nothing", "Each range wins more in position than out of position", "Both ranges win the same"], "answer": 1, "explain": "Same cards and ranges; acting last is worth more."},
  {"q": "Why is the initiative valuable?", "choices": ["It forces the opponent to fold", "It usually comes with the stronger range", "It lets you see more cards"], "answer": 1, "explain": "The last aggressor's range is usually stronger than the caller's capped range."}
]
```
