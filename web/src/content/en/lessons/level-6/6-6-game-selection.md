---
id: "6.6"
level: 6
title: Game selection
minutes: 6
prerequisites: ["6.5"]
drills: ["review"]
glossary: ["rake", "win rate"]
objectives:
  - Estimate how table choice and rake change your win rate.
  - Compare games by expected winnings per hour, not per hand.
  - Know what you can and can't measure about a game.
recap:
  - Your win rate depends on your opponents as much as on you.
  - Rake comes out of every pot and can turn a small edge into a loss.
  - Compare games by what you expect to earn per hour after rake, with honest uncertainty.
---

You can't control the cards, but you can choose where you play. Your [[win rate]] depends on
your edge over the other players, minus the [[rake]] the room takes.

## Rake matters

Suppose (as an example, not a measurement) you'd win 6 bb per 100 hands before rake at a table
that takes 4 bb per 100 hands in rake from the pots you win. You'd keep
{{calc 6 - 4 | int}} bb per 100. At a table with half the rake you'd keep
{{calc 6 - 2 | int}}: twice as much.

## Per hour, not per hand

If one game deals 60 hands an hour and another 90, a win rate of 4 bb/100 earns
{{calc 4 * 60 / 100 | dec1}} bb an hour in the first and {{calc 4 * 90 / 100 | dec1}} in the
second. Faster games and more tables raise the hourly rate, until your decisions suffer.

```callout key
Compare games by expected winnings per hour after rake. A slightly weaker table with low rake
can beat a softer one with high rake.
```

## What you can't know

Your win rate in a game is an estimate with a wide error (lesson 6.5). A few sessions can't
tell you which table is better; many can. Be honest about the uncertainty before you switch.

## Worked hand

You choose between two games (example numbers):

1. **Game A:** you estimate 5 bb/100 before rake, rake 3 bb/100, 70 hands an hour:
   {{calc (5 - 3) * 70 / 100 | dec1}} bb an hour.
2. **Game B:** 7 bb/100 before rake, rake 5 bb/100, 70 hands an hour:
   {{calc (7 - 5) * 70 / 100 | dec1}} bb an hour.
3. **They're the same**: a softer game isn't better if the rake eats the difference.

## Common mistakes

- **Ignoring rake.** It can be bigger than your edge.
- **Comparing per hand when the speed differs.** Use per hour.
- **Switching games on a few sessions of results.** The noise is too big.

## Check yourself

```quiz
[
  {"q": "You win 6 bb/100 before rake and pay 4 bb/100 in rake. What do you keep?", "choices": ["2 bb/100", "6 bb/100", "10 bb/100"], "answer": 0, "explain": "Rake comes out of your winnings."},
  {"q": "Why compare games per hour?", "choices": ["Games deal at different speeds", "Hours are easier to count", "Rake is charged per hour"], "answer": 0, "explain": "More hands an hour at the same win rate earns more."},
  {"q": "Can a few sessions tell you which table is better?", "choices": ["Yes", "No, the results are too noisy", "Only if you won"], "answer": 1, "explain": "Win rates need large samples (lesson 6.5)."}
]
```
