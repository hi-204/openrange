---
id: "0.1"
level: 0
title: How a hand flows
minutes: 6
prerequisites: []
drills: []
glossary: ["hole cards", "board", "preflop", "flop", "turn", "river", "showdown", "pot"]
objectives:
  - Name the four betting rounds of No-Limit Hold'em.
  - Say which cards are dealt before each round and who can use them.
  - Describe the two ways a hand can end.
recap:
  - Two private cards each, then up to five shared cards in three steps (three, one, one).
  - A betting round happens before the flop and after each new card.
  - The hand ends when everyone else folds, or at a showdown after the last round.
---

No-Limit Texas Hold'em is the most played form of poker, and every hand follows the same
pattern. Once you know the pattern, everything else in this course hangs on it.

## The cards

Each player gets two private cards, their [[hole cards]]. Then up to five shared cards are
dealt face up in the middle of the table, the [[board]]. Everyone can use the board, so your
hand is the best five cards you can make from your two hole cards and the five on the board.

The shared cards arrive in three steps:

- the [[flop]]: three cards at once;
- the [[turn]]: a fourth card;
- the [[river]]: the fifth and last card.

The time before the flop is called [[preflop]].

## The four betting rounds

There is a round of betting at each of the four stages: preflop, after the flop, after the
turn and after the river. In each round players take turns to bet, call, raise, check or
fold (lesson 0.3 explains each one). All the chips bet go into the middle, the [[pot]].

Step through a whole hand:

```widget handflow
{"hero": "Ad Qd", "villain": "Kc Ks", "board": "Qs 7h 2c Qc 9d"}
```

## How a hand ends

A hand ends in one of two ways:

1. **Everyone else folds.** The last player left wins the pot without showing their cards.
2. **A [[showdown]].** If two or more players are still in after the river betting, they show
   their hole cards and the best five-card hand wins. Equal hands split the pot.

```callout key
A hand is a series of decisions, one per betting round, with more information each time: two
cards, then the flop, the turn and the river.
```

## Worked hand

You are dealt A♦Q♦. Before the flop you bet, and one opponent calls.

1. **Flop: Q♠ 7♥ 2♣.** You now have a pair of queens with an ace beside it. You bet again; your
   opponent calls.
2. **Turn: Q♣.** You have three queens. You bet; they call.
3. **River: 9♦.** Your best five cards are Q♦ Q♠ Q♣ A♦ 9♦. You bet, and they fold.

The hand ended before a showdown, so nobody saw your cards. If they had called, you would both
have shown your hands and the stronger one would have won.

```callout example
At a showdown each player uses their best five of seven cards (two hole cards plus five board
cards). They may use both hole cards, one, or none.
```

## Common mistakes

- **Thinking you must use both hole cards.** In Hold'em you can use either, both or neither.
  (Omaha, a different game, forces you to use exactly two.)
- **Forgetting that the board is shared.** A board with three queens gives every player at
  least three queens; what matters is how your hole cards improve on that.
- **Mixing up the streets.** The flop is three cards at once; the turn and river are one each.

## Check yourself

```quiz
[
  {"q": "How many cards are dealt on the flop?", "choices": ["One", "Three", "Five"], "answer": 1, "explain": "The flop is three shared cards dealt together. The turn and the river add one card each."},
  {"q": "How many betting rounds can a hand have?", "choices": ["Two", "Three", "Four"], "answer": 2, "explain": "Preflop, flop, turn and river: four rounds."},
  {"q": "Everyone folds to your bet on the turn. What happens?", "choices": ["The river is still dealt", "You win the pot without showing", "There is a showdown"], "answer": 1, "explain": "When only one player is left, they win the pot at once. No more cards, no showdown."},
  {"q": "At a showdown, how many of your hole cards must you use?", "choices": ["Exactly two", "At least one", "Any number, including none"], "answer": 2, "explain": "Your hand is the best five of your seven cards. Sometimes the five board cards are the best hand, and then they are your hand too."}
]
```
