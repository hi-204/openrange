---
id: "0.7"
level: 0
title: Game formats
minutes: 5
prerequisites: ["0.2"]
drills: []
glossary: ["cash game", "tournament", "stack", "buy-in", "6-max"]
objectives:
  - Tell cash games and tournaments apart.
  - Know what changes between them for your decisions.
  - Read table sizes and stack depths in big blinds.
recap:
  - In a cash game chips are money and you can leave any time; in a tournament chips only decide who survives.
  - Tournament blinds rise and prizes go by finishing place, which changes risk.
  - Stack depth in big blinds is what matters for strategy, not the chip count.
---

The rules of a hand are the same everywhere, but the games around them differ. The two big
formats change how you should think about risk.

## Cash games

In a [[cash game]] the chips are real money. You sit down with an amount you choose (within the
table's limits), you can top up between hands, and you can leave whenever you like. The blinds
never change. Winning a chip is always worth the same, so decisions are about winning the most
chips on average.

## Tournaments

In a [[tournament]] everyone pays the same [[buy-in]] and gets the same starting chips. The
blinds go up at fixed times, so stacks get shorter compared with the blinds. You can't cash out
your chips: prizes are paid by finishing place, usually only to the top few.

That changes risk. Losing all your chips ends your tournament, while doubling them doesn't
double your prize. Near the prizes, survival can be worth more than chips; Level 6 shows how to
measure that with ICM.

Common kinds: single-table "sit and go" games and large multi-table tournaments.

## Table sizes and stacks

- **Full ring**: nine or ten players. **[[6-max]]**: up to six, the most common online cash
  format and the one this course uses. **Heads-up**: two players.
- Your [[stack]] is the chips in front of you. Strategy depends on stack size *in big blinds*:
  a 100 bb stack plays very differently from a 10 bb stack, whatever the chips are worth.

```callout key
Always think in big blinds. 10,000 chips with blinds of 500/1,000 is a 10 bb stack: short,
whatever the number looks like.
```

## Worked hand

Two situations with the same cards, A♠ J♣ on the button:

1. **Cash game, 100 bb deep.** Everyone folds to you. You raise; if the big blind re-raises,
   you can weigh calling, re-raising or folding purely on chip value.
2. **Tournament, 10 bb, two places from the prizes.** Everyone folds to you. With 10 bb, a raise
   commits much of your stack, so "all-in or fold" decisions dominate (Level 3 and Level 6). And
   being knocked out now costs you the chance of a prize, so you take a little less risk than
   the chips alone would suggest.

## Common mistakes

- **Treating tournament chips like cash.** Near the prizes, the chip you lose hurts more than
  the chip you win helps.
- **Thinking in chip counts.** Convert stacks and bets to big blinds.
- **Copying full-ring ranges at 6-max.** With fewer players, everyone plays more hands.

## Check yourself

```quiz
[
  {"q": "In which format can you leave and take your chips as money at any time?", "choices": ["Cash game", "Tournament"], "answer": 0, "explain": "Cash-game chips are money; tournament chips can't be cashed out."},
  {"q": "Blinds are 200/400 and you have 4,000 chips. How deep are you?", "choices": ["{{calc 4000 / 400 | int}} bb", "{{calc 4000 / 200 | int}} bb", "4,000 bb"], "answer": 0, "explain": "Divide by the big blind: 4,000 ÷ 400 = {{calc 4000 / 400 | int}} bb."},
  {"q": "Why can survival be worth more than chips in a tournament?", "choices": ["Blinds never change", "Prizes are paid by finishing place, so busting out ends your chance of a prize", "You can rebuy any time"], "answer": 1, "explain": "Doubling your chips doesn't double your prize, but losing them all ends your tournament."}
]
```
