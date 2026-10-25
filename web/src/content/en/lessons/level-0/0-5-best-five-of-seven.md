---
id: "0.5"
level: 0
title: Best five of seven
minutes: 6
prerequisites: ["0.4"]
drills: []
glossary: ["board", "hole cards", "playing the board"]
objectives:
  - Find the best five-card hand from two hole cards and five board cards.
  - Spot when the board itself is the best hand.
  - Avoid the common mistakes of reading hands at showdown.
recap:
  - Your hand is the best five of your seven cards, using two, one or none of your hole cards.
  - When nobody's hole cards improve the board, everyone plays the board and splits.
  - Read the board first, then ask what your two cards add.
---

At a showdown you have seven cards: your two [[hole cards]] and the five on the [[board]].
Your hand is the strongest five you can pick from those seven.

## How to read a hand

1. **Read the board first.** What does it already make by itself (a pair, a straight, a flush)?
2. **Add your cards.** Does either of your hole cards make a better five?
3. **Pick the best five.** Check from the top of the ranking down: straight flush, quads, full
   house, flush, straight…

Try it: change your two cards or the board, and the explorer shows the best five and what they
make.

```widget board
{"hand": "Ah Kh", "board": "Qh Jh 2c 7d Th"}
```

## When the board plays

Sometimes no hole card improves on the board. Then every player still in has the same five
cards, they are [[playing the board]], and the pot is split.

```callout example
Board: 9♠ T♦ J♣ Q♥ K♠, a king-high straight. You hold 2♣ 2♦; your opponent holds 3♠ 4♥. Neither
pair of hole cards makes anything better, so both of you play the board's straight: split pot.
If your opponent held an ace, they would have the ace-high straight and win.
```

## Worked hand

Board: K♠ K♦ 8♣ 8♥ 4♠. You hold A♣ 7♦; your opponent holds Q♥ J♥.

- The board already has two pair, kings and eights, with a 4 as the fifth card.
- Your ace replaces the 4: **K K 8 8 A**.
- Their best fifth card is the queen: **K K 8 8 Q**.

Same two pair, so the fifth card decides: your ace beats their queen. You win.

## Common mistakes

- **Using both hole cards when one is better.** A pair in your hand doesn't help if the board
  already has two higher pairs and a high kicker.
- **Missing a flush on the board.** Check suits on the board before celebrating a straight.
- **Missing that the board plays.** If your hole cards don't beat any of the five board cards
  that make the hand, you share it with everyone.

## Check yourself

```quiz
[
  {"q": "Board: A♠ A♦ 7♣ 7♥ 2♠. You hold K♣ 3♦. What is your hand?", "choices": ["Aces and sevens with a king", "Aces and sevens with a 3", "Just a pair of aces"], "answer": 0, "explain": "The board gives two pair; your king beats the board's 2 as the fifth card: A A 7 7 K."},
  {"q": "Board: 5♥ 6♥ 7♥ 8♥ 9♥, a straight flush. Can anyone beat it?", "choices": ["Yes, the 10♥ makes a higher straight flush", "No, everyone plays the board"], "answer": 0, "explain": "10♥ makes 6-7-8-9-10 of hearts, a higher straight flush. Without it, everyone plays the board."},
  {"q": "How many of your hole cards can your best hand use?", "choices": ["Exactly two", "One or two", "Zero, one or two"], "answer": 2, "explain": "Any combination: sometimes the board alone is your best five."}
]
```
