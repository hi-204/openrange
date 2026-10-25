---
id: "1.3"
level: 1
title: Hand categories
minutes: 7
prerequisites: ["1.2"]
drills: ["preflop"]
glossary: ["broadway", "suited connector", "set", "dominated"]
objectives:
  - Group starting hands into categories that play alike.
  - Explain what each category hopes to make after the flop.
  - See why being suited and being connected add value.
recap:
  - Big pairs and big aces want big pots; small pairs mostly hope to flop a set.
  - Suited and connected hands make flushes and straights, so they play well after the flop.
  - Offsuit hands with a weak kicker are often dominated by better versions of themselves.
---

Grouping the 169 hands into a few families makes them easier to remember and to play. Each
family has its own way of winning.

## The families

| Family | Examples | What it wants |
|---|---|---|
| Big pairs | AA–JJ | build a big pot; often ahead already |
| Medium and small pairs | TT–22 | flop a [[set]] (three of a kind) and win a big pot |
| Big aces and [[broadway]] cards | AK, AQ, KQ, KJ | make top pair with a good kicker |
| Suited aces | A5s, A4s | flushes, wheel straights, and good blockers |
| [[Suited connector\|Suited connectors]] | T9s, 87s, 65s | straights and flushes; disguised strong hands |
| Weak offsuit hands | K7o, J4o, 92o | mostly fold, especially early |

See a family on the grid:

```widget grid
{"range": "T9s, 98s, 87s, 76s, 65s, 54s"}
```

## Small pairs: flopping a set

A small pair rarely improves, but when it does it's often strong and well hidden. The chance of
flopping at least a set with a pocket pair is {{calc 1 - (48 * 47 * 46) / (50 * 49 * 48) | pct1}}:
one minus the chance that none of the three flop cards is one of the two cards left of your rank.

## Suited is worth more, but not a lot more

Being suited adds flush chances. Against a pair of sevens, A♥K♥ has {{eq AhKh vs 7c7d}} equity
all-in before the flop, and A♥K♦ has {{eq AhKd vs 7c7d}}. A real difference, but smaller than
most beginners think: a hand isn't good just because it is suited.

## Dominated hands

A hand is [[dominated]] when an opponent holds one of your cards with a better kicker: A7
against AK, K9 against KQ. When both players pair the shared card, the better kicker usually
wins, so hitting your hand often costs you money. Against A♣K♠, A♦7♥ has only {{eq Ad7h vs AcKs}}.

```callout key
Hands that can make strong hands (sets, flushes, straights, top pair with a top kicker) are
worth more than hands that make weak pairs with weak kickers.
```

## Worked hand

Three hands from the button, nobody in the pot yet: 6♠6♥, 8♣7♣ and Q♦4♠.

- **6♠6♥:** a small pair. It can win small pots unimproved and big ones when it flops a set.
- **8♣7♣:** a suited connector. It rarely flops top pair, but it makes straights and flushes
  that are hard to see coming.
- **Q♦4♠:** an offsuit queen with a weak kicker. When it pairs the queen, better queens often
  dominate it. The weakest of the three.

## Common mistakes

- **Overvaluing any ace.** A9o and below are often dominated.
- **Overvaluing suited.** Suitedness adds a few points of equity, not a whole new hand.
- **Calling big bets with small pairs hoping for a set.** The chance above is roughly one flop
  in eight or nine; the price has to be right (implied odds, lesson 2.6).

## Check yourself

```quiz
[
  {"q": "What does a small pocket pair mostly hope to flop?", "choices": ["Top pair", "A set", "A flush draw"], "answer": 1, "explain": "A set (three of a kind) turns a weak pair into a strong, well-hidden hand."},
  {"q": "Why is A7o often a problem against an opponent who raised?", "choices": ["It's offsuit", "It is often dominated by better aces", "It can't make straights"], "answer": 1, "explain": "When you both have an ace, their better kicker wins; you are dominated."},
  {"q": "How much does being suited add, roughly?", "choices": ["A few points of equity", "It doubles your equity", "Nothing at all"], "answer": 0, "explain": "Compare the two AK equities in the lesson: suited helps, but only a little."}
]
```
