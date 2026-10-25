---
id: "6.3"
level: 6
title: Tournaments and ICM
minutes: 7
prerequisites: ["2.5"]
drills: ["preflop:pushfold-hu.json"]
glossary: ["ICM", "tournament", "prize equity"]
objectives:
  - Explain why tournament chips aren't worth money in proportion.
  - Compute prize equity with ICM.
  - See that big stacks are worth less, and short stacks more, than their chip share.
recap:
  - In a tournament you play for prizes, not chips; prizes are fixed and paid by finishing place.
  - ICM turns stacks into prize equity by estimating how likely each finishing place is.
  - Each extra chip is worth less than the one before, so losing chips hurts more than winning them helps.
---

In a cash game a chip is worth its face value. In a [[tournament]] you play for prizes paid by
finishing place, and the value of your chips depends on everyone's stacks. The
[[ICM]] (Independent Chip Model) turns stacks into [[prize equity]].

## How ICM works

Your chance of finishing first is your share of the chips. Given who finished first, the chance
of finishing second follows the same rule among the others, and so on. Prize equity adds up
each place's chance times its prize.

With two players left, ICM is just the chip share: 3,000 against 1,000 chips with prizes of 70
and 30 is worth {{calc 0.75 * 70 + 0.25 * 30 | dec1 | show}} to the bigger stack.

## More players

```widget icm
{"stacks": [5000, 3000, 1500, 500], "payouts": [50, 30, 20]}
```

Compare the two share columns. The chip leader's share of the prizes is smaller than its share
of the chips; the short stack's is bigger. Every place pays something, and even a short stack
often outlasts someone.

```callout key
Chips you win are worth less than chips you lose. That's why tournament play is tighter than
chip counting suggests, especially near the money.
```

## Worked hand

Four players are left, three are paid (50, 30, 20). You have 3,000 chips.

1. **Your chip share:** {{calc 3000 / 10000 | pct1}}.
2. **Your prize share:** read it in the calculator above (Player 2).
3. **Now** change your stack to 6,000 (and the leader's to 2,000): your chips double, but your
   prize equity rises by much less.

## Common mistakes

- **Treating tournament chips as cash.** Prizes, not chips, are what you win.
- **Ignoring other stacks.** Your equity depends on everyone's.
- **Applying ICM to cash games.** It's only for fixed-prize events.

## Check yourself

```quiz
[
  {"q": "Two players left, prizes 70 and 30, stacks 3,000 and 1,000. What is the bigger stack's prize equity?", "choices": ["60", "70", "50"], "answer": 0, "explain": "Three quarters of 70 plus a quarter of 30 = 60."},
  {"q": "Is the chip leader's share of the prizes bigger or smaller than its share of the chips?", "choices": ["Bigger", "Smaller", "The same"], "answer": 1, "explain": "Extra chips are worth less and less in prizes."},
  {"q": "Why does losing chips hurt more than winning them helps?", "choices": ["Prizes are fixed and paid by place", "The blinds go up", "Chips can't be lost"], "answer": 0, "explain": "Each extra chip adds less prize equity than the one before."}
]
```
