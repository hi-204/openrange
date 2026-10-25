---
id: "4.3"
level: 4
title: Range advantage vs nut advantage
minutes: 7
prerequisites: ["4.2"]
drills: ["postflop"]
glossary: ["range advantage", "nut advantage"]
objectives:
  - Tell range advantage from nut advantage.
  - Find which player has each on a given board.
  - Connect each kind of advantage with how often and how big to bet.
recap:
  - Range advantage is more equity on average; nut advantage is more of the very strongest hands.
  - The two can belong to different players, as on low connected boards.
  - Range advantage supports betting often; nut advantage supports betting or raising big.
---

"Who's ahead on this board?" has two answers. One is about the average hand, the other about
the very best hands.

## Two kinds of advantage

- **[[Range advantage]]:** your range has more equity on average.
- **[[Nut advantage]]:** your range has more of the very strong hands (here, hands with at least
  85 in 100 equity against the other range).

The range-vs-range widget shows both: average equity and the share of very strong hands.

## Same ranges, different boards

The same example ranges as lesson 4.2: an early open (A) and a big-blind call (B).

```widget advantage
{"a": "77+, ATs+, KJs+, QJs, AJo+, KQo", "b": "22-99, A2s-AJs, KTs+, QTs+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo-AQo, KJo+", "board": "As Kd 3c"}
```

On A♠K♦3♣ the opener has both: more equity and more very strong hands (A-A, K-K, A-K).
Now type 7s 6d 5c. The opener still has more equity on average, thanks to its overpairs, but
the caller has more very strong hands: sets of sevens, sixes and fives, and straights with 9-8.
The advantages have split.

```callout key
Check both numbers. A range can be ahead on average and still be behind at the top.
```

## What it means for betting

- **Range advantage without nut advantage:** bet small and often, or check more of your medium
  hands. A big bet would run into the other player's strongest hands.
- **Nut advantage:** big bets and raises become possible, because you have more of the hands
  that want a big pot. Lesson 4.9 shows a solver doing this on the river.

## Worked hand

You opened and hold Q♠Q♦. The flop is 7♠6♦5♣, and the big blind checks.

1. **Your hand:** an overpair, ahead of most of the big blind's hands.
2. **The big blind's range:** more sets and straights than yours.
3. **So:** your overpair is good often, but a big pot is often bad news. A small bet or a
   check suits it better than a large bet.

## Common mistakes

- **Looking only at average equity.** The top of the ranges decides big pots.
- **Assuming the preflop raiser always has the advantage.** Low connected boards favour the
  caller's strong hands.
- **Betting big without the strong hands to back it.**

## Check yourself

```quiz
[
  {"q": "What is nut advantage?", "choices": ["More equity on average", "More of the very strongest hands", "Having position"], "answer": 1, "explain": "It's about the top of the range."},
  {"q": "On 7♠6♦5♣, who has more very strong hands in the example?", "choices": ["The early opener", "The big-blind caller", "Neither"], "answer": 1, "explain": "The caller has more sets and straights there."},
  {"q": "You have range advantage but not nut advantage. Which plan fits?", "choices": ["Bet big with everything", "Bet small or check more", "Always raise"], "answer": 1, "explain": "Big bets would run into the other player's strongest hands."}
]
```
