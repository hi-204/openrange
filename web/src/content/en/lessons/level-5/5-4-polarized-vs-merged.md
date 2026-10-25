---
id: "5.4"
level: 5
title: Polarized vs merged ranges
minutes: 7
prerequisites: ["4.9", "5.3"]
drills: ["postflop:river-qj742"]
glossary: ["polarized", "merged"]
objectives:
  - Recognise polarized and merged ranges.
  - Explain which bet sizes each goes with.
  - Read range shapes in a solved river spot.
recap:
  - Polarized means strong hands and bluffs with few medium hands; merged includes many medium hands.
  - Big bets go with polarized ranges; small bets can be merged.
  - The shape follows from who calls: big bets are only called by strong hands.
---

A betting range has a shape. A [[polarized]] range holds strong hands and bluffs, with few
in between. A [[merged]] range adds medium hands that are ahead of the hands that call.

## Why the shape follows the size

- **Against a big bet** only strong hands call. A medium hand that bets big gets called only
  when it's behind, so it checks instead. What's left is polarized.
- **Against a small bet** many worse hands call. A medium hand can bet small and get called by
  worse hands: the range becomes merged.

## The river spot

```widget minisolver
{"spot": "river-qj742"}
```

At the first decision the solver uses all three sizes. Its third-of-the-pot bets contain many
medium hands; its bets of three quarters of the pot and more contain almost none (lesson 4.9
checks these numbers).

```callout key
Ask "who calls this size?" If only better hands call, the size needs a polarized range.
```

## Worked hand

On Q♠J♥7♦4♣2♠ you hold J♦T♦ (second pair), first to act.

1. **Against a big bet** your opponent calls with queens, two pairs, sets and straights. You're
   behind almost every time you're called.
2. **Against a small bet** they also call with weaker jacks, sevens and some ace-high hands.
3. **The solver** bets J♦T♦ a third of the pot every time and never bets it big.

Compare K♥Q♦ (top pair, good kicker). Against this opponent's range it is a strong hand,
and the solver bets it three quarters of the pot about two times in three. "Medium" depends on
the opponent's range, not on the hand's name.

## Common mistakes

- **Betting big with medium hands.** Only better hands call.
- **Betting small with a polarized range.** Bluffs need a big enough bet to work, and the
  nuts win more with a bigger one.
- **Thinking polarized means "lots of bluffs".** It's about the gap in the middle.

## Check yourself

```quiz
[
  {"q": "What is a merged range?", "choices": ["Only nuts and bluffs", "Strong hands plus many medium hands", "Only medium hands"], "answer": 1, "explain": "It includes medium hands that are ahead of the calls."},
  {"q": "Which size goes with a polarized range?", "choices": ["A big bet", "A very small bet", "A check"], "answer": 0, "explain": "Big bets are only called by strong hands, so medium hands drop out."},
  {"q": "Why does a medium hand avoid big bets?", "choices": ["It only gets called by better hands", "It can't be called", "It is always ahead"], "answer": 0, "explain": "Worse hands fold to a big bet."}
]
```
