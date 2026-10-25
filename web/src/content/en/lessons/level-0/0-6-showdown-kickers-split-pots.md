---
id: "0.6"
level: 0
title: Showdown, kickers and split pots
minutes: 7
prerequisites: ["0.4", "0.5"]
drills: []
glossary: ["showdown", "kicker", "split pot", "muck"]
objectives:
  - Decide who wins a showdown, including close kicker battles.
  - Recognise ties and how a split pot is shared.
  - Know who shows first and when you may hide your cards.
recap:
  - Best five cards win; within a category compare the making cards, then the kickers.
  - A kicker on the board can't help anyone, so it often leads to a split.
  - Equal hands split the pot; odd chips follow the house rule.
---

When the river betting ends with two or more players still in, there is a [[showdown]]: hands
are shown and the best five cards take the pot.

## Kickers decide close hands

When two players make the same pair or the same two pair, the remaining cards, the
[[kicker|kickers]], decide. Compare them from the highest down, and remember: only five cards
count.

Try two hands that share a pair:

```widget ranker
{"hands": ["Ah Kd As 7c 2d", "Ah Qd As 7c 2d"]}
```

**Kickers can be "counterfeited" by the board.** If the board already holds better kickers than
your hole card, your kicker doesn't play.

```callout example
Board: A♠ K♦ Q♣ 9♥ 3♠. You hold A♦ 5♣, your opponent holds A♣ 7♦. Both have a pair of aces, and
the best kickers are the board's K, Q and 9 for both of you. Your 5 and their 7 don't make the
five: it's a split pot.
```

## Split pots

If the best five cards are equal (same ranks, suits don't count), the pot is split equally
between the winners: a [[split pot]]. When the pot doesn't divide evenly, the casino or site
gives the odd chip by its house rule (often to the first winner after the button).

Splits also happen with side pots: each pot is split among the best hands that are eligible for
it.

## Who shows first

The last player to bet or raise on the river shows first. If the river was checked by everyone,
the first player to act shows first. Others may then show to claim the pot or [[muck]] their
cards (fold them face down) to concede without showing. Online, the software shows the winning
hands automatically.

## Worked hand

Board: K♠ 9♦ 9♣ 4♥ 2♠. Three players reach the showdown:

- **A:** K♦ J♣ makes K K 9 9 J (two pair, kings and nines, jack kicker).
- **B:** K♥ Q♥ makes K K 9 9 Q (same two pair, queen kicker).
- **C:** 9♠ 3♦ makes 9 9 9 K 4 (three of a kind).

C wins: three of a kind beats two pair. Between A and B, B's queen would beat A's jack, but that
only matters if C weren't in the hand (or for a side pot C can't win).

## Common mistakes

- **Counting a kicker that doesn't play.** Check whether the board's cards are higher.
- **Thinking suits break ties.** They never do.
- **Mucking a winner.** At a live table, show your hand when you might win; once mucked, a hand
  usually can't be recovered.

## Check yourself

```quiz
[
  {"q": "Board: Q♠ J♦ 8♣ 5♥ 2♠. A holds Q♥ T♣, B holds Q♦ 9♠. Who wins?", "choices": ["A", "B", "Split"], "answer": 0, "explain": "Both have a pair of queens. Kickers from the top: J (both), then A's T beats B's 9."},
  {"q": "Board: A♠ K♦ Q♣ J♥ 3♠. A holds 2♣ 2♦, B holds 4♠ 5♥. Who wins?", "choices": ["A, with a pair", "B", "Split"], "answer": 0, "explain": "A has a pair of twos; B has only ace high. A wins. (Neither has a straight: that needs a ten.)"},
  {"q": "Board: 7♠ 7♦ 7♣ 7♥ K♠. A holds A♣ 2♦, B holds Q♥ J♥. Who wins?", "choices": ["A", "B", "Split"], "answer": 0, "explain": "Everyone has four sevens; the fifth card decides. A's ace beats the board's king; B's best fifth card is the board king. A wins."},
  {"q": "Two winners, and the pot doesn't divide evenly. What happens to the odd chip?", "choices": ["It goes to the house", "It follows the house rule, often the first winner after the button", "The hand is replayed"], "answer": 1, "explain": "Casinos and sites have a fixed rule for odd chips; a common one gives it to the first winner to the left of the button."}
]
```
