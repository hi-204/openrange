---
id: "6.4"
level: 6
title: Bubble and final-table dynamics
minutes: 8
prerequisites: ["6.3"]
drills: ["preflop:pushfold-hu.json"]
glossary: ["bubble", "bubble factor", "ICM"]
objectives:
  - Compute a bubble factor with ICM.
  - Explain why big stacks shove more and short stacks call less near the money.
  - Use OpenRange's push/fold calculator with payouts.
recap:
  - The bubble factor is what losing a call costs in prize equity divided by what winning gains.
  - Above 1, a call needs more than half the equity, even with no other money in the pot.
  - On the bubble, big stacks can shove much wider and short stacks must call much tighter.
---

The [[bubble]] is the moment just before the prizes start: one more elimination and everyone
left is paid. [[ICM]] pressure is at its highest there.

## The bubble factor

When you call an all-in, you risk chips to win chips. In a cash game both are worth the same.
In a tournament, losing costs more prize equity than winning gains. The ratio is the
[[bubble factor]]:

$$
\text{bubble factor} = \frac{\text{prize equity lost if you lose}}{\text{prize equity gained if you win}}
$$

With no other money in the pot, a call needs equity of factor ÷ (factor + 1): with a factor of
1 that's half, with 2 it's {{calc 2 / (2 + 1) | pct1 | show}}.

```widget icm
{"stacks": [12, 20, 8], "payouts": [65, 35], "hero": 2, "villain": 1}
```

Three players are left and two are paid. The short stack (Player 3) facing the big stack's
all-in has a factor of about one and a half: the call needs about 60 in 100 equity instead of
half.

## Shoving and calling on the bubble

The push/fold calculator on the Solve page finds exact heads-up push/fold strategies, with or
without payouts. Its example is this table: the 20 bb stack shoves into the 8 bb stack in the
big blind, the 12 bb stack has folded.

- **Without payouts (chip EV)** the 20 bb stack shoves a bit more than half its hands, and the
  8 bb stack calls a bit under half.
- **With payouts 65 and 35** the big stack shoves almost every hand, and the short stack calls
  with less than a third of its hands.

OpenRange's tests run both solves. Heads-up, ICM is linear, so payouts change nothing there.

```callout key
Near the money, the short stack can't afford to gamble and the big stack knows it. Push the
pressure when you're big; pick your spots when you're short.
```

## Worked hand

You are the 8 bb stack in the example, in the big blind with J♠T♦, and the 20 bb stack goes
all-in.

1. **Chip EV:** J-T offsuit is a call against a wide shoving range.
2. **ICM:** with a bubble factor of about one and a half, you need much more equity, and J-T
   offsuit becomes a fold.
3. **Check it** in the push/fold calculator with and without payouts.

## Common mistakes

- **Calling bubble shoves with chip-EV ranges.** ICM makes calls much tighter.
- **Folding everything as the big stack.** The bubble is when your shoves work best.
- **Forgetting the medium stack.** A third player who folded still affects everyone's equity.

## Check yourself

```quiz
[
  {"q": "What does a bubble factor of 2 mean?", "choices": ["Losing costs twice what winning gains", "You win twice as often", "The blinds doubled"], "answer": 0, "explain": "It's the ratio of prize equity lost to prize equity gained."},
  {"q": "With a bubble factor of 2 and no other money in the pot, how much equity does a call need?", "choices": ["One half", "Two thirds", "One third"], "answer": 1, "explain": "factor ÷ (factor + 1) = 2 ÷ 3."},
  {"q": "On the bubble, what does the big stack do compared with chip EV?", "choices": ["Shoves much wider", "Shoves tighter", "Stops shoving"], "answer": 0, "explain": "The short stack must call tighter, so shoves win more often."}
]
```
