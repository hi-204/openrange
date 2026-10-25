---
id: "4.8"
level: 4
title: Turn and river basics
minutes: 8
prerequisites: ["4.6", "2.5"]
drills: ["postflop:turn-qj74", "postflop:river-qj742"]
glossary: ["barrel", "semi-bluff", "bluff catcher"]
objectives:
  - Explain why draws bet on the turn more often than medium pairs.
  - Describe a river betting range: strong hands and bluffs.
  - Explain how calling ranges shrink as bets get bigger.
recap:
  - On the turn, draws are good bets (semi-bluffs); medium pairs prefer to check.
  - On the river there are no draws: bets are value hands or bluffs.
  - Bigger bets get more folds; medium hands call small bets and fold more to big ones.
---

Each street narrows the ranges. On the turn, draws still have a card to come. On the river,
every hand is final.

## The turn: who bets

```widget minisolver
{"spot": "turn-qj74"}
```

At the first decision on Q♠J♥7♦4♣, the out-of-position player bets its draws more often than
its one-pair hands. A draw that bets is a [[semi-bluff]]: it can win now, and it can still
improve. A medium pair gains less from betting: worse hands fold, better hands call.

Betting again on a later street is called a [[barrel]].

## The river: value or bluff

```widget minisolver
{"spot": "river-qj742"}
```

On Q♠J♥7♦4♣2♠ the hands are final. In this spot the first player can bet a third, three
quarters or one and a half times the pot. Its bets of three quarters of the pot or more are
almost all strong hands or hands that rarely win at showdown; it checks or bets small with its
medium hands (lesson 4.9).

## Facing a river bet

With a hand that beats bluffs but loses to value bets, a [[bluff catcher]], the question is
the price (lesson 2.3). In the spot above, the second player:

- folds more as the bet gets bigger;
- calls with all of its medium hands against the small bet, and folds more than half of them
  against the biggest.

```callout key
Turn: bet the hands that gain from folds and can improve. River: bet strong hands and bluffs,
and check the medium ones.
```

## Worked hand

River, Q♠J♥7♦4♣2♠. You hold K♠Q♦ (top pair, good kicker) and your opponent bets one and a half
times the pot.

1. **Price:** you call 15 bb to win a pot of {{calc 10 + 15 + 15 | int | show}} bb:
   {{calc 15 / 40 | pct1}}.
2. **Their range:** polarized, strong hands and bluffs only.
3. **Your hand:** beats the bluffs, loses to the strong hands. Click KQo in the node where the
   first player bet 15 to see what the solver does.

## Common mistakes

- **Betting medium hands on the river.** Better hands call and worse hands fold.
- **Barrelling without a reason.** Each bet should gain from folds, from calls by worse hands,
  or from improving.
- **Calling big river bets with every pair.** Big bets are polarized; check the price.

## Check yourself

```quiz
[
  {"q": "What is a semi-bluff?", "choices": ["A bet with a draw that can improve if called", "A small bet", "A bluff on the river"], "answer": 0, "explain": "It can win at once or win later by improving."},
  {"q": "Why does a river betting range have few medium hands?", "choices": ["Better hands call and worse hands fold", "Medium hands are illegal", "They always win anyway"], "answer": 0, "explain": "A bet with a medium hand only gets called when it's behind."},
  {"q": "What happens to the caller's folds as the river bet gets bigger?", "choices": ["They fold less", "They fold more", "No change"], "answer": 1, "explain": "The price gets worse, so more hands fold."}
]
```
