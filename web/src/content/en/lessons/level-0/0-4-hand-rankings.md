---
id: "0.4"
level: 0
title: Hand rankings
minutes: 8
prerequisites: ["0.1"]
drills: []
glossary: ["straight", "flush", "full house", "kicker"]
objectives:
  - List the nine hand categories from strongest to weakest.
  - Recognise straights, flushes and full houses, including the special cases.
  - Rank any two five-card hands, including hands of the same category.
recap:
  - Straight flush, four of a kind, full house, flush, straight, three of a kind, two pair, one pair, high card.
  - Suits never rank; an ace can be high or low in a straight, but straights don't wrap around.
  - Same category? Compare the ranks that make it, then the remaining cards in order.
---

Every poker hand is five cards, and it belongs to one of nine categories. A higher category
always beats a lower one; within a category, the cards decide.

## The nine categories, strongest first

1. **Straight flush**: five in a row, all the same suit (e.g. 9♥ 8♥ 7♥ 6♥ 5♥). The best one,
   A-K-Q-J-10 suited, is called a royal flush.
2. **Four of a kind** (quads): four cards of one rank (e.g. 7♠ 7♥ 7♦ 7♣ K♠).
3. **[[Full house]]**: three of one rank and two of another (e.g. Q♠ Q♥ Q♦ 4♣ 4♠).
4. **[[Flush]]**: five of the same suit, not in a row (e.g. A♣ J♣ 8♣ 6♣ 2♣).
5. **[[Straight]]**: five in a row, mixed suits (e.g. T♠ 9♦ 8♣ 7♥ 6♠).
6. **Three of a kind** (trips or a set): three of one rank.
7. **Two pair**.
8. **One pair**.
9. **High card**: none of the above.

The rarer the hand, the higher it ranks.

Compare hands yourself (type five to seven cards; T is a ten):

```widget ranker
{"hands": ["As Ks Qs Js Ts", "9h 9d 9c 4s 4h"]}
```

## Special cases

- **The ace plays high or low in a straight.** A-K-Q-J-T is the highest straight, 5-4-3-2-A
  (the "wheel") the lowest. Straights don't wrap: Q-K-A-2-3 is not a straight.
- **Suits never rank.** A heart flush and a spade flush with the same cards tie.
- **Only five cards count.** Even with seven cards available, your hand is your best five.

## Same category: who wins?

Compare the cards that make the category first, then the rest from the highest down:

- **Pairs:** the higher pair wins; with the same pair, compare the other three cards one by one.
  Those leftover cards are the [[kicker|kickers]].
- **Two pair:** the higher top pair, then the lower pair, then the fifth card.
- **Flushes and high-card hands:** the highest card, then the next, and so on.
- **Straights:** the highest card of the straight.
- **Full houses:** the three of a kind first (Q-Q-Q-4-4 beats J-J-J-A-A).

## Worked hand

Which hand wins?

- **A:** K♠ K♦ 9♣ 9♥ 3♠ (two pair, kings and nines).
- **B:** Q♠ Q♥ J♦ J♣ A♠ (two pair, queens and jacks, ace kicker).

Both are two pair, so compare the top pairs: kings beat queens. **A wins**, even though B has an
ace. The kicker only matters when both pairs are equal.

Try it in the ranker above: type each hand in a box.

## Common mistakes

- **Ranking a flush below a straight.** A flush beats a straight.
- **Counting suits.** No suit is higher than another.
- **Using more than five cards.** A sixth card never breaks a tie.
- **Wrapping straights.** K-A-2-3-4 is just ace-high.

## Check yourself

```quiz
[
  {"q": "Which hand is stronger: a flush or a full house?", "choices": ["Flush", "Full house"], "answer": 1, "explain": "Full house ranks above flush (and below four of a kind)."},
  {"q": "Is Q-K-A-2-3 a straight?", "choices": ["Yes", "No"], "answer": 1, "explain": "The ace can be high (A-K-Q-J-T) or low (5-4-3-2-A), but a straight can't go around the corner."},
  {"q": "A: 8-8-K-7-2. B: 8-8-Q-J-T. Who wins?", "choices": ["A, with the king kicker", "B, with three high cards", "It's a tie"], "answer": 0, "explain": "Both have a pair of eights, so compare kickers from the top: A's king beats B's queen."},
  {"q": "Two players have ace-high flushes: A♥ K♥ 9♥ 5♥ 2♥ and A♠ K♠ 9♠ 5♠ 2♠. Who wins?", "choices": ["Hearts", "Spades", "It's a tie"], "answer": 2, "explain": "Same ranks, and suits never rank, so they split the pot."}
]
```
