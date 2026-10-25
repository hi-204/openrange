---
id: "4.5"
level: 4
title: Stack-to-pot ratio
minutes: 6
prerequisites: ["3.4"]
drills: ["postflop"]
glossary: ["stack-to-pot ratio", "committed"]
objectives:
  - Work out the stack-to-pot ratio after the flop.
  - Count how many pot-sized bets get the stacks in.
  - Use the ratio to judge which hands can play for all the money.
recap:
  - SPR is the smaller stack behind divided by the pot at the start of the flop.
  - Each pot-sized bet and call triples the pot, so SPR tells you how many streets of betting are left.
  - The lower the SPR, the weaker the hand you can be happy to get all in with.
---

The [[stack-to-pot ratio]] (SPR) compares the money left to play for with the money already in
the pot. It changes which hands are worth getting all in with.

## Computing it

SPR is the smaller stack behind, divided by the pot when the flop comes. At 100 bb:

- **Single-raised pot** (button opens to 2.5 bb, big blind calls): pot
  {{calc 2.5 + 2.5 + 0.5 | dec1 | show}} bb, stacks 97.5 bb, SPR {{calc 97.5 / 5.5 | dec1}}.
- **3-bet pot** (big blind 3-bets to 10 bb, button calls): pot
  {{calc 10 + 10 + 0.5 | dec1 | show}} bb, stacks 90 bb, SPR {{calc 90 / 20.5 | dec1}}.
- **4-bet pot** (lesson 3.4): SPR {{calc 77 / 46.5 | dec1}}.

```widget spr
{"stack": 90, "pot": 20.5}
```

## How fast the money goes in

A pot-sized bet and a call triple the pot. In the 3-bet pot above:

1. Flop: bet 20.5 bb, call: the pot is {{calc 20.5 * 3 | dec1}} bb and {{calc 90 - 20.5 | dec1}} bb are left.
2. Turn: a pot-sized bet would be 61.5 bb, leaving only {{calc 90 - 20.5 - 61.5 | dec1}} bb.

So two pot-sized bets get almost everything in. In the single-raised pot, the same takes three
streets and then some.

```callout key
Low SPR: few bets left, and one good pair can be worth all the money. High SPR: many bets left,
and you need a stronger hand to play for stacks.
```

## Worked hand

You hold A♠K♦ and the flop is K♣8♥3♦: top pair, top kicker.

- **In the 3-bet pot** (SPR about four and a half), two bets get it all in. Top pair top kicker is
  strong against a 3-bet calling range; you are usually [[committed]] and happy to get it in.
- **In the single-raised pot** (SPR above seventeen), getting it all in takes three or four
  bets. When your opponent puts that much in, they often have two pair or better.

Same hand, same flop; the SPR changes how much you should be willing to put in.

## Common mistakes

- **Playing every pot as if SPR were high.** In 3-bet and 4-bet pots, one pair is often enough.
- **Stacking off with one pair at high SPR.** Big pots there usually need big hands.
- **Forgetting it's the smaller stack that counts.**

## Check yourself

```quiz
[
  {"q": "The pot is 20 bb on the flop and the smaller stack behind is 80 bb. What is the SPR?", "choices": ["Four", "Eighty", "One quarter"], "answer": 0, "explain": "80 ÷ 20 = 4."},
  {"q": "What does a pot-sized bet and a call do to the pot?", "choices": ["Doubles it", "Triples it", "Adds one big blind"], "answer": 1, "explain": "The pot P plus a bet P plus a call P makes 3P."},
  {"q": "At a low SPR, what happens to one-pair hands?", "choices": ["They should always fold", "They can often be happy to get all in", "Nothing changes"], "answer": 1, "explain": "Few bets are left, so a strong pair is often worth all the money."}
]
```
