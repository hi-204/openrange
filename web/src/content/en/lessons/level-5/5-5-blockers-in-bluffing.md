---
id: "5.5"
level: 5
title: Blockers in bluff selection
minutes: 7
prerequisites: ["2.8", "5.4"]
drills: ["postflop:river-k9472"]
glossary: ["blocker", "showdown value"]
objectives:
  - Explain how a card in your hand changes how often a bluff works.
  - Find good bluffing candidates on a board where a flush came in.
  - Weigh blockers against showdown value.
recap:
  - A bluff works better when your cards remove hands that would call.
  - On a three-heart river, the solver bluffs high-card hands with a heart much more often.
  - Showdown value comes first: hands that can win by checking bluff less, whatever they block.
---

Choosing which weak hands to bluff with is partly about [[blocker|blockers]]: cards in your
hand that make the opponent's calling hands less likely.

## A flush river

The board is K♥9♥4♥7♣2♦. A player with a flush will call almost any bet. If you hold a heart,
your opponent has fewer flushes, and your bluff gets called less often.

```widget minisolver
{"spot": "river-k9472"}
```

Solve it and compare high-card hands at the first decision (no pair, no flush). OpenRange's
tests count them: those holding a heart bet more than twice as often as those without one,
and the same holds for the three-quarter-pot size alone.

## Showdown value comes first

A weak pair can sometimes win by checking: it has [[showdown value]]. Bluffing with it turns a
hand that sometimes wins into one that only wins when the opponent folds. So the solver bluffs
mostly with hands that would lose at showdown anyway, then prefers the ones with good
blockers.

On the dry river Q♠J♥7♦4♣2♠ of lesson 4.9 the effect is weaker and mixed up with showdown
value: there, the weak hands that bluff most are the ones with no chance at showdown.

```callout key
Bluff with hands that can't win by checking, and among those, with the ones that block calls.
```

## Worked hand

On K♥9♥4♥7♣2♦ you hold Q♥J♣ (queen high, one heart) or Q♠J♣ (queen high, no heart).

1. **Showdown value:** both are queen high; both usually lose if you check.
2. **Blockers:** Q♥J♣ removes every flush that needs the queen of hearts, and makes all flushes
   a little less likely.
3. **So:** Q♥J♣ is the better bluff. Look up both in the solved grid.

## Common mistakes

- **Bluffing with medium pairs because they "block" something.** Showdown value matters more.
- **Ignoring the board.** Blockers matter most when the calling range is narrow and specific,
  like flushes.
- **Treating blockers as a reason on their own.** They shift frequencies; they don't decide
  every hand.

## Check yourself

```quiz
[
  {"q": "Three hearts are on the river. Why is a heart in your hand good for bluffing?", "choices": ["It makes your opponent's flushes less likely", "It gives you a flush", "It is never good"], "answer": 0, "explain": "Fewer flushes means fewer calls."},
  {"q": "Which hand makes the better bluff on a three-heart board?", "choices": ["A weak pair that can win at showdown", "Queen high with a heart", "Queen high without a heart"], "answer": 1, "explain": "No showdown value, and a blocker to the calls."},
  {"q": "What comes before blockers when choosing bluffs?", "choices": ["Showdown value", "The colour of the cards", "Nothing"], "answer": 0, "explain": "Hands that can win by checking shouldn't turn into bluffs."}
]
```
