---
id: "1.2"
level: 1
title: The 169 starting hands
minutes: 6
prerequisites: ["0.1"]
drills: ["math:combos"]
glossary: ["combo", "suited", "offsuit", "pocket pair"]
objectives:
  - Explain why there are 169 different starting hands but 1326 combos.
  - Count the combos of any pair, suited hand and offsuit hand.
  - Work out how often you are dealt a pair or a specific hand.
recap:
  - 13 pairs, 78 suited hands and 78 offsuit hands make 169 starting hands.
  - A pair has 6 combos, a suited hand 4, an offsuit hand 12.
  - All 1326 combos are equally likely, so a hand's chance is its combos divided by 1326.
---

There are 1326 ways to be dealt two cards from a deck of 52. Because suits matter only for
flushes, most of them play alike, and poker players group them into 169 starting hands.

## From 1326 combos to 169 hands

Each specific pair of cards, such as A♠K♦, is a [[combo]]. Choosing 2 cards from 52 gives
{{calc 52 * 51 / 2 | int | show}} combos.

Grouping by ranks and by whether the suits match:

- **13 [[pocket pair|pocket pairs]]** (AA, KK, …, 22), each with 6 combos (choose 2 of the 4
  suits);
- **78 [[suited]] hands** (AKs, AQs, …, 32s), each with 4 combos (one per suit);
- **78 [[offsuit]] hands** (AKo, …, 32o), each with 12 combos (4 × 3 suit pairs).

Check: {{calc 13 * 6 + 78 * 4 + 78 * 12 | int | show}}. And 13 + 78 + 78 = 169.

```widget combos
{"hand": "AK"}
```

## The grid

Charts show the 169 hands on a 13 × 13 grid: pairs on the diagonal, suited hands above it,
offsuit hands below it. Type a range to see it:

```widget grid
{"range": "22+, AKs, AKo"}
```

## How often?

Every combo is equally likely, so:

- a pocket pair: {{calc 78 / 1326 | pct1}} of hands (78 combos out of 1326);
- a suited hand: {{calc 312 / 1326 | pct1}};
- one specific pair, such as aces: 6 combos, about once every {{calc 1326 / 6 | int}} hands.

## Worked hand

You hold A♥ 7♣. How many A-K combos could your opponent have?

1. A-K has {{calc 4 * 4 | int}} combos with no cards known (4 aces × 4 kings).
2. You hold an ace, so only 3 aces are left: {{calc 3 * 4 | int}} combos remain.

Try it in the combo counter above: keep AK as the hand and type Ah as a card you can see.

## Common mistakes

- **Treating every hand as equally likely.** AKo (12 combos) is three times as common as AKs (4).
- **Forgetting your own cards.** Cards in your hand or on the board remove combos from your
  opponent's range.
- **Reading the grid upside down.** Suited is above the diagonal, offsuit below.

## Check yourself

```quiz
[
  {"q": "How many combos does a pocket pair like 99 have?", "choices": ["4", "6", "12"], "answer": 1, "explain": "Choose 2 of the 4 nines: 6 combos."},
  {"q": "How many combos does KQo have?", "choices": ["4", "12", "16"], "answer": 1, "explain": "4 kings × 3 queens of a different suit = 12."},
  {"q": "The board shows K♠ and you hold K♦. How many KK combos are left for your opponent?", "choices": ["1", "3", "6"], "answer": 0, "explain": "Two kings are out of the deck, leaving 2: one combo."},
  {"q": "Which is more common to be dealt: a pocket pair or AKs?", "choices": ["A pocket pair", "AKs"], "answer": 0, "explain": "78 pair combos against 4 AKs combos."}
]
```
