---
id: "2.7"
level: 2
title: Combinatorics
minutes: 7
prerequisites: ["1.2"]
drills: ["math:combos"]
glossary: ["combo", "card removal", "set"]
objectives:
  - Count the combos of a hand when some cards are known.
  - Compare how likely different hands are in an opponent's range.
  - Use combos to judge whether a bet is more often value or a bluff.
recap:
  - Without known cards, a pair has 6 combos, a suited hand 4 and an offsuit hand 12.
  - Each known card of a rank removes combos; count the cards that are left.
  - Hands with more combos are more likely, even if a scarier hand is possible.
---

Lesson 1.2 counted [[combo|combos]] in a full deck. After the flop, cards on the board and in
your hand are gone, and that changes which hands your opponent can hold. This is
[[card removal]].

## Counting with known cards

- **Pairs:** with k cards of the rank left, there are k × (k − 1) ÷ 2 combos.
- **Two different ranks:** (cards of the first rank left) × (cards of the second rank left).

On a board of K♠7♦2♣:

| Hand | Cards left | Combos |
|---|---|---|
| KK (a [[set]]) | 3 kings | {{calc 3 * 2 / 2 \| int}} |
| 77 | 3 sevens | {{calc 3 * 2 / 2 \| int}} |
| K7 (two pair) | 3 kings, 3 sevens | {{calc 3 * 3 \| int}} |
| AK (top pair) | 4 aces, 3 kings | {{calc 4 * 3 \| int}} |
| AA | 4 aces | {{calc 4 * 3 / 2 \| int}} |

Check any of them:

```widget combos
{"hand": "KK", "dead": "Ks 7d 2c"}
```

## What it tells you

Your opponent bets big on K♠7♦2♣. Sets of kings, sevens and deuces together are
{{calc 3 + 3 + 3 | int}} combos; A-K alone is {{calc 4 * 3 | int}}. So if they would bet both
big, A-K is more likely than any set.

```callout key
Count combos before you get scared of a hand. A monster with few combos can be less likely
than a medium hand with many.
```

## Worked hand

You hold A♠K♦ on K♠7♦2♣. How many combos of KK and AK can your opponent have?

1. **Kings left:** one is on the board and one is in your hand, so 2 remain. KK: {{calc 2 * 1 / 2 | int}} combo.
2. **Aces left:** you hold one, so 3 remain. AK: {{calc 3 * 2 | int | show}}.

Your own cards cut AK in half and leave only one KK. Type your hand and the board into the
counter above to check.

## Common mistakes

- **Forgetting your own cards.** They're gone from your opponent's range too.
- **Counting suited combos with a board card.** A♠K♠ is impossible when K♠ is on the board.
- **Judging by how scary a hand is.** Count how many ways they can have it.

## Check yourself

```quiz
[
  {"q": "The board has one queen. How many QQ combos are possible?", "choices": ["Three", "Six", "One"], "answer": 0, "explain": "Three queens are left: 3 × 2 ÷ 2 = 3 combos."},
  {"q": "The board has one king and you hold no ace or king. How many AK combos are there?", "choices": ["Twelve", "Sixteen", "Nine"], "answer": 0, "explain": "Four aces times three kings left."},
  {"q": "You hold an ace and the board has a king. How many AK combos are left?", "choices": ["Nine", "Twelve", "Six"], "answer": 0, "explain": "Three aces times three kings."},
  {"q": "On K-7-2, which is more likely: one of the three sets, or AK?", "choices": ["A set", "AK", "The same"], "answer": 1, "explain": "The three sets have 9 combos together; AK has 12."}
]
```
