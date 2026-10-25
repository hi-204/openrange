---
id: "1.4"
level: 1
title: Why we raise instead of limp
minutes: 7
prerequisites: ["1.1", "0.3"]
drills: ["preflop"]
glossary: ["limp", "open-raise", "fold equity"]
objectives:
  - Explain the two ways a raise can win and why a limp has only one.
  - Work out how often a raise must win the blinds to break even on its own.
  - Know why OpenRange's charts only fold or raise when first in.
recap:
  - A raise can win the blinds at once; a limp can't, because the big blind may simply check.
  - A raise that never wins when called still breaks even if the blinds fold often enough.
  - Raising also builds a bigger pot with your good hands and keeps the betting lead.
---

When nobody has entered the pot yet, you have three choices: fold, [[limp]] (just call the big
blind) or [[open-raise]]. Most strong players almost never limp in cash games. This lesson
shows why with simple arithmetic.

## Two ways to win

A raise can win in two ways:

1. **Everyone folds** and you take the blinds without seeing a flop. The value of this chance
   is your [[fold equity]].
2. **Someone calls** and you win later, after the flop or at showdown.

A limp gives up the first way completely. The big blind has already paid one big blind, so
when you only call they can check and see the flop for free. You can never win the blinds
right away by limping.

## How often must a raise win the blinds?

Take the worst case: you raise to 2.5 bb from the button with a hand that never wins when
called, and you give up whenever anyone calls or raises. You risk 2.5 bb to win the 1.5 bb in
the blinds, so the raise breaks even when the blinds fold

$$
\frac{\text{risk}}{\text{risk} + \text{reward}}
$$

of the time: {{calc 2.5 / (2.5 + 1.5) | pct1 | show}}.

Try your own guesses below. The numbers are **illustrative assumptions**, not solver output:
change the fold chance and see where the EV crosses zero.

```widget ev
{"outcomes": [
  {"label": "Both blinds fold: you win the blinds", "p": 0.6, "value": 1.5},
  {"label": "Called or raised: you give up the raise (worst case)", "p": 0.4, "value": -2.5}
]}
```

Real hands do better than the worst case: when called, they still win some pots after the
flop. So a real raise needs the blinds to fold less often than this to be worth it.

## What else a raise does

- **Builds a pot with good hands.** With A-A you want the pot big; a limp keeps it small.
- **Keeps the lead.** The player who raised last before the flop is the one expected to bet
  next, and the other player has to respond.
- **Thins the field.** Fewer opponents means your good hands win more often.

```callout key
A raise can win now or win later. A limp can only win later, and it lets the big blind see a
flop for free.
```

## Limping in OpenRange's charts

OpenRange's cash-game model only allows fold or raise when nobody has entered the pot (a
simplification listed in Known limits). Its charts can't tell you how good limping is; they
only show how to play when you raise or fold.

## Worked hand

You are on the button with 9♠7♠, folded to you, 100 bb stacks.

- **Limp 1 bb.** The small blind can complete and the big blind can check: you may be playing
  a three-way pot, out of the lead, with a hand that rarely makes top pair.
- **Raise to 2.5 bb.** Sometimes both blinds fold and you win the blinds straight away. When
  one calls, you have position after the flop and a hand that can make straights and flushes.

Raising gives you every chance the limp gives you, and one more.

## Common mistakes

- **Limping with weak hands "to see a cheap flop".** The big blind sees it for free too, and
  you've given up the chance to win the blinds.
- **Limping with very strong hands to trap.** It keeps the pot small when you most want it
  big, and lets the big blind see a free flop.
- **Forgetting fold equity.** A raise with a weak hand isn't only a bet on your cards.

## Check yourself

```quiz
[
  {"q": "You limp from the button and the small blind folds. What can the big blind do?", "choices": ["Only fold or raise", "Check and see the flop for free", "Must call another big blind"], "answer": 1, "explain": "The big blind has already paid one big blind, so they may check."},
  {"q": "Which is a way a raise can win that a limp can't?", "choices": ["Winning at showdown", "Everyone folding before the flop", "Making a flush"], "answer": 1, "explain": "After a limp the big blind can always check, so you can't win the blinds right away."},
  {"q": "In the worst case, a raise to 2.5 bb risks 2.5 bb to win 1.5 bb. How do you find how often the blinds must fold?", "choices": ["Reward divided by risk", "Risk divided by risk plus reward", "Risk minus reward"], "answer": 1, "explain": "Breaking even means the fold chance times the reward equals the rest of the time times the risk; solving gives risk ÷ (risk + reward)."}
]
```
