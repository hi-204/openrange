---
id: "4.7"
level: 4
title: Protecting your checking range
minutes: 6
prerequisites: ["4.6"]
drills: ["postflop:turn-qj74", "postflop:turn-kt63"]
glossary: ["checking range", "check-raise"]
objectives:
  - Explain what happens when a checking range has no strong hands.
  - See how often the solver checks its strongest hands.
  - Connect strong checks with check-raises.
recap:
  - If you only check weak hands, your opponent can bet anything after your check.
  - Solvers check some of their strongest hands, more on boards where betting is less attractive.
  - Strong hands in your checks make check-raises and calls credible.
---

Your [[checking range]] is every hand you check with. If it holds only weak hands, your
opponent can bet all of their range after you check and you'll have to fold.

## What the solver checks

```widget minisolver
{"spot": "turn-qj74"}
```

At the first decision on Q♠J♥7♦4♣, the out-of-position player bets most of its two-pair-or-
better hands, but checks about a quarter of them. On K♥T♥6♥3♠ it checks a bigger part of
them, about two in five:

```widget minisolver
{"spot": "turn-kt63"}
```

These strong checks are what make the [[check-raise]] in lesson 4.6 work, and they let the
checking range call bets with confidence.

## Why not bet every strong hand?

- **Your opponent bets for you.** In position after a check, the other player bets most of
  their strong hands and some bluffs. Your strong hand gets the money in anyway.
- **Your checks stay strong.** Your opponent can't bet freely after every check.
- **Your bets stay balanced.** Some strong hands still bet, so bets aren't all bluffs.

```callout key
A checking range with some strong hands can defend itself. One with only weak hands invites
your opponent to bet every time.
```

## Worked hand

You hold Q♦J♦ (two pair) on Q♠J♥7♦4♣, first to act.

1. **Betting** builds the pot now.
2. **Checking** keeps your checks strong; when your opponent bets, you can raise or call.
3. **The solver** does both with hands like this. Look at QJs in the root node grid.

## Common mistakes

- **Always betting strong hands and checking weak ones.** Opponents learn to bet every check.
- **Checking strong hands and then only calling.** The check-raise is part of the plan.
- **Thinking a strong check is "slowplaying" to trick someone.** It keeps your range defended.

## Check yourself

```quiz
[
  {"q": "What happens if your checking range has no strong hands?", "choices": ["Nothing", "Your opponent can bet any hand after you check", "You win more"], "answer": 1, "explain": "Without strong hands you can only fold to their bets."},
  {"q": "In the Q-J-7-4 spot, about how often does the first player check its two-pair-or-better hands?", "choices": ["Never", "About a quarter of the time", "Always"], "answer": 1, "explain": "It bets most of them, but checks some to keep its checks strong."},
  {"q": "What does a strong hand in your checking range let you do?", "choices": ["Check-raise and call with confidence", "Fold more", "Bet smaller"], "answer": 0, "explain": "Your opponent's bets now run into strong hands."}
]
```
