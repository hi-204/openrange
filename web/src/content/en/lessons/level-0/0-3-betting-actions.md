---
id: "0.3"
level: 0
title: The betting actions
minutes: 7
prerequisites: ["0.2"]
drills: []
glossary: ["check", "bet", "call", "raise", "fold", "all-in", "no-limit", "side pot"]
objectives:
  - Choose between check, bet, call, raise and fold, and know when each is allowed.
  - Work out the smallest legal raise.
  - Understand going all-in and why side pots exist.
recap:
  - With no bet to match you can check or bet; facing a bet you can fold, call or raise.
  - A raise must be at least as big as the previous bet or raise it re-raises.
  - In no-limit you can bet up to your whole stack; players who can't match an all-in play for a side pot.
---

When it is your turn you have at most three options, and which three depends on one thing:
has someone already put in a bet you would have to match?

## Nobody has bet yet

- **[[Check]]**: pass without putting chips in. You stay in the hand. (Preflop you can't
  check unless you are the big blind and nobody raised: the blind counts as a bet.)
- **[[Bet]]**: put chips in. Everyone after you must now match it, raise or fold.

## Someone has bet

- **[[Fold]]**: give up the hand and any chips you already put in.
- **[[Call]]**: put in exactly enough to match the bet.
- **[[Raise]]**: put in more than the bet, so the others must match your larger amount.

You can't check once there is a bet to match. Folding is always allowed, but folding when you
could check for free only throws a hand away.

## How much can you bet or raise?

In [[no-limit]] Hold'em you may bet any amount from one big blind up to all your chips. A raise
must be at least as large as the last bet or raise in that round:

- the big blind is 1 bb, so the smallest preflop raise is to 2 bb;
- if someone bets 3 bb, the smallest raise is to 6 bb (3 more than their bet);
- if they bet 3 bb and you raise to 10 bb, the next raise must be to at least 17 bb (another 7).

## All-in and side pots

Betting all your chips is going [[all-in]]. You can never be forced out of a hand because you
can't match a bet: you call with what you have. You can only win from each opponent as much as
you put in, so any extra chips between bigger stacks form a [[side pot]] that only they can win.

```callout example
You have 20 bb and go all-in. Two players with 100 bb each call, and one of them later bets
again. The main pot holds 20 bb from each of you three; the later bet goes into a side pot
between the two big stacks. You can win the main pot but not the side pot.
```

```widget table
{"highlight": ["CO", "BTN"]}
```

## Worked hand

Blinds 0.5/1 bb, six players. You are on the button.

1. UTG folds, HJ folds. CO **raises** to 2.5 bb.
2. You can fold, call 2.5 bb, or raise. The smallest raise is to 4 bb: CO's 2.5 bb plus the
   1.5 bb CO raised by. You **call**.
3. SB folds, BB folds. The flop comes. CO acts first and **checks**.
4. Nobody has bet, so you can check or bet. You **bet** 3 bb.
5. CO can now fold, call 3 bb, or raise to at least 6 bb. CO **folds**: you win the pot.

## Common mistakes

- **Folding when you could check.** If nobody has bet, checking costs nothing.
- **Making a raise that's too small.** It must add at least as much as the last raise did.
- **Thinking a short stack must fold to a big bet.** You can always call all-in for less and
  play for the part of the pot you matched.

## Check yourself

```quiz
[
  {"q": "Nobody has bet on the flop and it is your turn. What can you do?", "choices": ["Check or bet", "Call or raise", "Only fold"], "answer": 0, "explain": "With no bet to match, you can check (free) or bet."},
  {"q": "Your opponent bets 4 bb. What is the smallest legal raise?", "choices": ["To 5 bb", "To 8 bb", "To 12 bb"], "answer": 1, "explain": "A raise must add at least the size of the bet: 4 more, so to 8 bb."},
  {"q": "You have 15 bb left and face a bet of 40 bb. Can you call?", "choices": ["No, you must fold", "Yes, all-in for 15 bb", "Only if you raise"], "answer": 1, "explain": "You can call all-in for what you have. You can only win the part of the pot you matched."},
  {"q": "What is a side pot?", "choices": ["A pot for the blinds", "Chips that only players who put them in can win, after someone else is all-in", "A second hand played at the same time"], "answer": 1, "explain": "Once a player is all-in, extra bets between the others go to a side pot the all-in player can't win."}
]
```
