---
id: "7.2"
level: 7
title: Bet-size theory
minutes: 7
prerequisites: ["4.9", "5.4"]
drills: ["postflop:turn-qj74", "postflop:river-qj742"]
glossary: ["polarized", "merged", "nut advantage"]
objectives:
  - Connect bet sizes with range shape and nut advantage.
  - Explain why solvers use several sizes in one spot.
  - Read which size a solver prefers and why.
recap:
  - Big sizes go with polarized ranges and nut advantage; small sizes with merged ranges and range advantage.
  - Solvers often use several sizes at once, each for a different part of the range.
  - The best size depends on what the other player calls with, not on a fixed rule.
---

Lesson 4.9 tied size to range shape. Solvers go further: they often use several sizes in the
same spot, each one for a different part of the range.

## The two forces

- **[[Nut advantage]] pushes sizes up.** With more of the strongest hands, big bets win more from
  the hands that call, and a bigger bet can carry more bluffs (lesson 5.3).
- **Merged ranges push sizes down.** Medium hands only get called by worse hands when the bet
  is small ([[merged]] ranges, lesson 5.4).

## Several sizes at once

```widget minisolver
{"spot": "river-qj742"}
```

At the first decision the solver bets a third of the pot most often, three quarters less
often and one and a half pots rarely. The third-pot bets carry medium hands; the bigger bets
are [[polarized]].

## In position on the turn

```widget minisolver
{"spot": "turn-qj74"}
```

Take the line where the first player checks. The second player can bet half the pot or the
pot, and uses the pot-sized bet much more often. Its betting range after a check is mostly
strong hands and draws: the shape that a big bet suits. The same happens on K♥T♥6♥3♠.

```callout key
There is no single right size. Ask what each part of your range wants: to be called by worse
hands (small), or to make better hands fold and get paid by strong ones (big).
```

## Worked hand

You are in position on the turn after a check, with a strong hand and the choice of half pot or
pot.

1. **Who calls a pot-sized bet?** Strong hands and good draws.
2. **Who calls half pot?** Those, plus some weaker pairs.
3. **The solver** mostly bets the pot with strong hands here, because its range has the
   strong hands and draws to back the big size, and keeps the smaller size for a few hands.

## Common mistakes

- **One size for everything.** Different hands want different sizes.
- **Copying a size from another board.** The best size depends on both ranges here.
- **Thinking big always means strong.** Big bets also carry the bluffs.

## Check yourself

```quiz
[
  {"q": "What pushes bet sizes up?", "choices": ["Nut advantage", "Having medium hands", "Being out of position"], "answer": 0, "explain": "With more of the strongest hands, big bets win more."},
  {"q": "Why do solvers use several sizes in one spot?", "choices": ["Each size suits a different part of the range", "To confuse the opponent", "Because they can't decide"], "answer": 0, "explain": "Medium hands want small bets; polarized hands want big ones."},
  {"q": "After a check on Q♠J♥7♦4♣, which size does the second player use more?", "choices": ["Half pot", "Pot", "Neither"], "answer": 1, "explain": "Its betting range is strong hands and draws, which suits the pot-sized bet."}
]
```
