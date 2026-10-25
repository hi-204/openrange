---
id: "4.2"
level: 4
title: Board textures
minutes: 7
prerequisites: ["2.1", "2.4"]
drills: ["postflop"]
glossary: ["board texture", "dry board", "wet board", "rainbow", "two-tone", "monotone", "paired board"]
objectives:
  - Describe a flop by its suits, pairs and connectedness.
  - Work out how often each kind of flop comes.
  - Explain how texture changes equities and which hands matter.
recap:
  - Suits (rainbow, two-tone, monotone), pairing and connectedness make up a board's texture.
  - On dry boards equities are far apart; on wet boards many hands have something and equities run closer.
  - Paired boards leave the opener far fewer very strong hands.
---

Two flops with the same high card can play completely differently. A board's
[[board texture]] says how many draws and strong hands it allows.

## The parts of a texture

- **Suits:** [[rainbow]] (three suits), [[two-tone]] (two cards of one suit: flush draws) or
  [[monotone]] (all one suit: flushes already possible).
- **Pairing:** a [[paired board]] like 8♠8♦3♣ makes trips and full houses possible and leaves
  fewer other strong hands.
- **Connectedness:** cards close in rank (J-T-9) allow straights and straight draws.

A [[dry board]] has none of these (K♠7♦2♣); a [[wet board]] has several (J♥T♥9♠).

## How often each comes

There are {{calc 52 * 51 * 50 / 6 | int}} possible flops. Counting suits:

- monotone: {{calc 4 * 286 / 22100 | pct1}} (4 suits × 286 sets of three ranks);
- rainbow: {{calc 4 * 13 * 13 * 13 / 22100 | pct1}};
- two-tone: the rest, {{calc 1 - (4 * 286 + 4 * 2197) / 22100 | pct1}}.

A paired flop (two of a rank, not three) comes {{calc 13 * 6 * 48 / 22100 | pct1}} of the time.

## What texture does to equities

Compare the same two example ranges (an early open and a big-blind call) on a dry and a wet
board:

```widget advantage
{"a": "77+, ATs+, KJs+, QJs, AJo+, KQo", "b": "22-99, A2s-AJs, KTs+, QTs+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo-AQo, KJo+", "board": "Ks 7d 2c"}
```

Change the board to Jh Th 9s. On the dry board, most hands are far ahead or far behind. On the
wet board, more of both ranges sit in the middle of the equity spread: pairs, draws and
combinations of both. On 8s 8d 3c, the opener has far fewer very strong hands than on K♠7♦2♣.

```callout key
Dry boards: equities are far apart and the leader can bet freely. Wet boards: equities run
close and hands change value on the next card.
```

## Worked hand

You hold A♠A♦ against the big-blind range above.

- **On K♠7♦2♣:** {{eq AsAd vs 22-99, A2s-AJs, KTs+, QTs+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo-AQo, KJo+ on Ks7d2c}}.
- **On J♥T♥9♠:** {{eq AsAd vs 22-99, A2s-AJs, KTs+, QTs+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo-AQo, KJo+ on JhTh9s}}.

The same overpair is worth much less on the wet board: straights, two pairs and many draws
are already there or coming.

## Common mistakes

- **Judging a board only by its high card.** Suits, pairs and connections matter as much.
- **Treating a two-tone board as dry.** Flush draws are possible.
- **Overvaluing overpairs on wet boards.** Many turn cards hurt them.

## Check yourself

```quiz
[
  {"q": "What is a two-tone flop?", "choices": ["Two cards of one suit", "Two cards of one rank", "Two face cards"], "answer": 0, "explain": "Two cards share a suit, so flush draws are possible."},
  {"q": "Which flop is the driest?", "choices": ["J♥T♥9♠", "K♠7♦2♣", "8♥7♥6♥"], "answer": 1, "explain": "Rainbow, unpaired and unconnected."},
  {"q": "How do equities change on wet boards?", "choices": ["They run closer: more hands have something", "They spread further apart", "They don't change"], "answer": 0, "explain": "Draws and made hands mix, so fewer hands are far ahead or far behind."}
]
```
