---
id: "2.1"
level: 2
title: Counting outs
minutes: 7
prerequisites: ["0.5"]
drills: ["math:outs"]
glossary: ["outs", "draw", "flush draw", "open-ended straight draw", "gutshot", "tainted out"]
objectives:
  - Count the outs of the common draws without double counting.
  - Spot tainted outs that also improve your opponent.
  - Know that outs depend on what your opponent holds.
recap:
  - An out is a card that gives you the best hand. Count cards, not ranks.
  - Flush draw 9, open-ended straight draw 8, gutshot 4; when draws overlap, count each card once.
  - A card that completes your hand but gives your opponent a better one is not a real out.
---

When you are behind with cards to come, you are on a [[draw]]: some cards will save you and
most won't. The cards that give you the best hand are your [[outs]]. Counting them is the
first step of every decision with a draw.

## The common draws

Count cards, not ranks:

- **[[Flush draw]]:** four cards of a suit, needing a fifth. There are 13 cards of each suit, so
  {{calc 13 - 4 | int | show}} are left.
- **[[Open-ended straight draw]]:** four cards in a row, such as 9-8-7-6, that a card at either
  end completes. Two ranks × 4 cards = {{calc 2 * 4 | int}}.
- **[[Gutshot]]:** a straight missing a card in the middle, such as 9-8-_-6-5. One rank:
  {{calc 1 * 4 | int}}.
- **Two overcards:** two cards higher than the board, when pairing either one would win.
  Two ranks × 3 cards left each = {{calc 2 * 3 | int}}.

When you have two draws, the cards that complete both are counted once. A flush draw plus an
open-ended straight draw is {{calc 9 + 8 - 2 | int | show}}: two of the straight cards are of
your suit and already counted.

## Count your outs

The outs counter checks every possible next card with the hand evaluator:

```widget outs
{"hero": "8h 7h", "villain": "As Ad", "board": "9h 6c 2h"}
```

8♥7♥ on 9♥6♣2♥ has a flush draw and an open-ended straight draw. Against A♠A♦ that's 15
outs: the nine hearts, plus the three other fives and the three other tens.

## Tainted outs

Now change the hands: you hold A♥K♥, the board is Q♥7♥2♣, and your opponent has Q♠Q♦ for
three queens.

```widget outs
{"hero": "Ah Kh", "villain": "Qs Qd", "board": "Qh 7h 2c"}
```

Nine hearts are left, but the 2♥ pairs the board and gives your opponent a full house. It
completes your flush and still loses: a [[tainted out]]. You have 8 real outs, not 9. An ace or
a king gives you a pair, but that doesn't beat three queens, so those aren't outs at all.

```callout key
An out has to give you the best hand, not just a better one. Always ask what the card does
for your opponent too.
```

## You don't see their cards

In a real hand you don't know your opponent's cards, so you count outs against the hands they
are likely to have. Against a big pair, your overcards may be outs; against a set, they are
not. Lesson 2.4 turns this into equity against a whole range.

## Worked hand

You hold J♣T♣ on 9♥8♦2♠ and think your opponent has a big pair such as A-A.

1. **Straight cards:** any queen or seven makes a straight: {{calc 2 * 4 | int}} outs.
2. **No flush draw:** the board has no clubs, and two cards to come can't bring the three you
   would need.
3. **Overcards?** A jack or ten gives you a pair, but it's lower than their aces: not an out.

So you have 8 outs against A-A. Against A-K instead, the jacks and tens would win too.

## Common mistakes

- **Counting ranks instead of cards.** "Queens or sevens" is 8 cards, not 2.
- **Double counting.** Cards that complete two of your draws count once.
- **Counting tainted outs.** A flush card that pairs the board is no good against a set.

## Check yourself

```quiz
[
  {"q": "You have four spades after the flop. How many spades are left?", "choices": ["Eight", "Nine", "Thirteen"], "answer": 1, "explain": "13 spades minus the 4 you can see leaves 9."},
  {"q": "You hold 8-7 on a board of 6-5-2. How many outs to a straight?", "choices": ["Four", "Eight", "Twelve"], "answer": 1, "explain": "A nine or a four completes it: two ranks of 4 cards."},
  {"q": "Flush draw plus open-ended straight draw: how many outs?", "choices": ["Fifteen", "Seventeen", "Nine"], "answer": 0, "explain": "Nine flush cards plus eight straight cards, minus the two that are in both."},
  {"q": "Your opponent has three queens. Why isn't a card that pairs the board a clean flush out?", "choices": ["It gives them a full house", "It isn't a heart", "Paired boards can't have flushes"], "answer": 0, "explain": "Three queens plus a pair on the board is a full house, which beats a flush."}
]
```
