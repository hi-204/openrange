---
id: "6.5"
level: 6
title: Bankroll and variance
minutes: 8
prerequisites: ["2.5"]
drills: ["review"]
glossary: ["win rate", "standard deviation", "bankroll", "risk of ruin"]
objectives:
  - Describe results over a sample of hands with a win rate and a standard deviation.
  - Work out how often a winning player is behind after a given number of hands.
  - Use risk of ruin to size a bankroll.
recap:
  - Results spread with the square root of the number of hands, while the expected result grows with the number itself.
  - A winning player can easily be behind over tens of thousands of hands.
  - Risk of ruin falls fast as the bankroll grows: double the bankroll and the risk is squared.
---

Poker results are noisy. Two numbers describe them: your [[win rate]] (average result per 100
hands) and the [[standard deviation]] (how widely 100-hand results spread). Your
[[bankroll]] is the money set aside to play.

## How results spread

After N hands, the expected result is win rate × N ÷ 100, and the typical spread is the
standard deviation × √(N ÷ 100). The spread grows more slowly than the expected result, so
skill shows through only over large samples.

```widget variance
{"winrate": 5, "sd": 100, "hands": 100000, "bankroll": 2000}
```

The chart shows 20 simulated players with the same win rate and standard deviation. They all
have the same skill; the differences are luck.

## Behind after 10,000 hands

Take a win rate of 5 bb per 100 hands and a standard deviation of 100 bb per 100 hands. After
10,000 hands:

- expected result: {{calc 5 * 10000 / 100 | int}} bb;
- spread: {{calc 100 * 10 | int}} bb (because √100 = 10).

The expected result is half a spread above zero, so this winning player is behind after 10,000
hands about three times in ten. Set the sliders to check.

## Risk of ruin

The [[risk of ruin]] is the chance of ever losing the whole bankroll. For a winning player it
is about exp(−2 × win rate × bankroll ÷ SD²). With the numbers above and 2,000 bb, it's about
one in seven. Doubling the bankroll squares the risk: from about one in seven to about one in
fifty-five.

```callout key
Variance doesn't go away; it just becomes small compared with your expected winnings over
enough hands. Size your bankroll so that the bad runs you will have don't end your game.
```

## Worked hand

You've played 20,000 hands and you're down. Are you a losing player?

1. **Spread over 20,000 hands** at a standard deviation of 100: 100 × √200, about 1,400 bb.
2. **A true win rate of 5 bb/100** would give an expected +1,000 bb.
3. **Being down** is well within one spread of that: the sample can't tell you much yet.

## Common mistakes

- **Judging your skill from a short sample.** Tens of thousands of hands are still noisy.
- **Playing with your whole bankroll in one game.** Risk of ruin explodes when the bankroll is
  small.
- **Thinking a downswing means you're playing badly.** Check your decisions, not your results.

## Check yourself

```quiz
[
  {"q": "How does the spread of results grow with the number of hands?", "choices": ["In proportion", "With the square root", "It doesn't grow"], "answer": 1, "explain": "Four times the hands, twice the spread; while the expected result grows four times."},
  {"q": "What happens to risk of ruin when you double your bankroll?", "choices": ["It halves", "It's squared, so it falls a lot", "Nothing"], "answer": 1, "explain": "The formula has the bankroll in the exponent."},
  {"q": "A winning player can be behind after 10,000 hands…", "choices": ["Never", "Quite often", "Only if they play badly"], "answer": 1, "explain": "With typical numbers it happens about three times in ten."}
]
```
