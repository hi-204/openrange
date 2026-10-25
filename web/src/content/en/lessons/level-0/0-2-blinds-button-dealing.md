---
id: "0.2"
level: 0
title: Blinds, button and dealing
minutes: 6
prerequisites: ["0.1"]
drills: []
glossary: ["button", "small blind", "big blind", "blinds", "big blind (bb)"]
objectives:
  - Explain what the button is and how it moves.
  - Say who posts the blinds, how much, and why blinds exist.
  - Know who acts first before and after the flop.
recap:
  - The button marks the dealer position and moves one seat clockwise every hand.
  - The two players after it post the small and big blind before any cards are dealt.
  - Preflop, the player after the big blind acts first; after the flop, the first active player after the button does.
---

Before a single card is dealt, two players have to put chips in. These forced bets, the
blinds, are what make every hand worth fighting for.

## The button

A round disc called the [[button]] marks who is "dealer" for the hand, even when a casino
dealer or the software does the actual dealing. After each hand the button moves one seat to
the left (clockwise), so everyone takes turns being in each seat.

```widget table
{"highlight": ["BTN", "SB", "BB"]}
```

## The blinds

The two players to the left of the button post the [[blinds]] before the cards are dealt:

- the [[small blind]] (SB), directly left of the button;
- the [[big blind]] (BB), next to it, usually twice the small blind.

Amounts in this course are measured in [[big blind (bb)|big blinds (bb)]], so they mean the
same at any stakes. A game with blinds of 1 and 2 chips is written as 0.5/1 bb: the small blind
posts half a big blind.

**Why blinds exist:** without them, everyone could wait for perfect cards and fold everything
else for free. The blinds put money in the pot every hand, so there is always something to
win, and folding forever slowly costs you.

## Dealing and the order of play

Cards are dealt one at a time, clockwise, starting with the small blind, until everyone has two.

- **Preflop**, the first player to act is the one to the left of the big blind. The blinds act
  last, because they have already put money in.
- **After the flop** (and on the turn and river), the first player still in the hand to the
  left of the button acts first, and the button acts last if still in.

```callout key
Acting last is an advantage: you see what everyone else did before you decide. The button acts
last on every street after the flop, which is why it is the best seat at the table.
```

**Heads-up** (only two players) is the one exception to the seating: the button posts the
small blind and acts first preflop, then last on every later street.

## Worked hand

Six players, blinds 0.5/1 bb. Seats clockwise: UTG, HJ, CO, BTN (button), SB, BB.

1. Before the deal, SB puts in half a big blind and BB puts in one big blind.
2. Two cards each, starting with SB.
3. **Preflop** action starts with UTG ("under the gun", first to act), then HJ, CO, BTN, SB,
   and finally BB.
4. Suppose CO, BTN and BB stay in. **On the flop**, the first player still in after the button
   acts first: BB (SB has folded), then CO, then BTN last.
5. Next hand, the button moves one seat: the old SB becomes the button.

## Common mistakes

- **Thinking the blinds are optional.** They are posted automatically before the cards; the
  players in those seats can't skip them.
- **Getting the postflop order wrong.** After the flop it is not the player after the big blind
  who starts but the first one still in after the button.
- **Forgetting the heads-up rule.** With two players the button is the small blind.

## Check yourself

```quiz
[
  {"q": "Who posts the big blind?", "choices": ["The player on the button", "The second player to the left of the button", "The player to the left of the big blind"], "answer": 1, "explain": "The small blind sits directly left of the button and the big blind next to it."},
  {"q": "Who acts first preflop at a six-player table?", "choices": ["The small blind", "The player to the left of the big blind", "The button"], "answer": 1, "explain": "Preflop starts with the player after the big blind, often called UTG. The blinds act last preflop."},
  {"q": "After the flop, which seat acts last if it is still in the hand?", "choices": ["The button", "The big blind", "The small blind"], "answer": 0, "explain": "From the flop on, action starts after the button and ends with the button."},
  {"q": "Why do the blinds exist?", "choices": ["To pay the dealer", "To make sure there is something to win in every hand", "To decide who deals"], "answer": 1, "explain": "Forced bets mean waiting for perfect cards costs something, so players have a reason to play."}
]
```
