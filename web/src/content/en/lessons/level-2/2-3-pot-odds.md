---
id: "2.3"
level: 2
title: Pot odds
minutes: 7
prerequisites: []
drills: ["math:potodds"]
glossary: ["pot odds", "equity", "showdown", "implied odds", "range"]
objectives:
  - Work out the price of a call as a share of the final pot.
  - Compare that price with your equity to decide whether a call pays.
  - Know when the simple price check is exact and when it is only a first estimate.
recap:
  - The price is what you pay divided by the pot you will have after calling.
  - A call pays when your equity against the hands that bet is at least the price.
  - On the river the check is exact; earlier, future bets change the picture.
---

When someone bets, you are offered a deal: put in a little to win what is already in the pot.
[[Pot odds]] tell you how good that deal is. They don't need any reading of your opponent,
only arithmetic, and they are the first thing strong players check before a call.

## The price of a call

Say the pot is 10 bb and your opponent bets 5 bb. If you call, you pay 5 bb and the pot
becomes 10 + 5 + 5 = 20 bb. Your share of the money you put in is

$$
\text{price} = \frac{C}{P + C}
$$

where $C$ is your call and $P$ is the pot **including the bet** you are facing. Here that is
{{calc 5 / (15 + 5) | pct | show}}.

The price is the [[equity]] you need: the share of the pot you must win on average, if all the
cards were dealt, to break even. With exactly that much equity, calling and folding earn the
same. With more, calling earns more; with less, folding is better.

```callout key
A call needs equity at least equal to the price: what you pay divided by the pot after you call.
```

Bigger bets ask for more equity. Try the slider: a bet of a third of the pot needs much less
than a bet the size of the pot.

```widget potodds
{"pot": 10, "bet": 5, "equity": 0.3}
```

A few prices worth remembering, all computed the same way:

| Bet | Price |
|---|---|
| a third of the pot | {{calc 1 / (1 + 1 + 3) \| pct}} |
| half the pot | {{calc 1 / (1 + 1 + 2) \| pct}} |
| the size of the pot | {{calc 1 / (1 + 1 + 1) \| pct}} |
| twice the pot | {{calc 2 / (2 + 2 + 1) \| pct}} |

## Worked hand

You hold 9♥8♥ on the turn; the board is Q♥ 7♥ 2♣ 4♠, so you have a flush draw. The pot is
10 bb and your opponent, who you think holds a queen, bets 6 bb.

1. **The price.** You call 6 bb to win a pot of 10 + 6 + 6 = 22 bb:
   {{calc 6 / (16 + 6) | pct1 | show}}.
2. **Your equity.** Against A♠Q♦ your hand wins only if a heart comes on the river.
   The engine counts every river card: {{eq 9h8h vs AsQd on Qh7h2c4s}}.
3. **The comparison.** The price is higher than your equity, so on this simple check the
   call loses money, and folding is the better play.

```callout example
The same draw facing a smaller bet of 2 bb has a price of {{calc 2 / (12 + 2) | pct1}}: now
your equity covers it and the call pays.
```

You can check other matchups yourself:

```widget equity
{"ranges": ["9h8h", "AsQd"], "board": "Qh7h2c4s"}
```

## When the simple check is exact

On the river no more cards come and nobody can bet again after your call, so the check is
exact: if your equity against the hands that bet beats the price, the call earns money. Before
the river it is only the first step, for two reasons:

- **More betting can follow.** If you hit, you may win more later; that is [[implied odds]],
  covered in its own lesson. If you miss, you may face another bet and have to fold.
- **Equity assumes a [[showdown]].** Flop equity counts both the turn and the river, but a bet
  on the turn may stop you from seeing the river cheaply.

Equity also has to be measured against the right hands. Your opponent doesn't bet with every
hand they could hold; compare your hand with the [[range]] that bets like this, not with a
random hand.

## Common mistakes

```callout mistake
Dividing by the wrong pot. The price is your call divided by the pot **after** you call, not by
the pot as it stands when you face the bet: facing a pot-sized bet you need {{calc 1 / 3 | pct}},
not {{calc 1 / 2 | pct}}.
```

- **Comparing with equity against a random hand.** People bet strong hands more often; your
  equity against their betting range is usually lower than against any two cards.
- **Treating a flop price as final.** With two cards to come, the opponent can bet again.
  The price check is a starting point, not the whole decision.
- **Calling because "the pot is big".** A big pot only helps if the price is low compared
  with your equity.

```callout try
Open the math drill and work out five prices in a row; aim to get each within one point.
```

## Check yourself

```quiz
[
  {"q": "The pot is 12 bb and your opponent bets 6 bb. What equity do you need to call?", "choices": ["{{calc 6 / (12 + 6) | pct}}", "{{calc 6 / (18 + 6) | pct}}", "{{calc 6 / 12 | pct}}"], "answer": 1, "explain": "You call 6 to win a final pot of 12 + 6 + 6 = 24 bb: {{calc 6 / 24 | pct}}."},
  {"q": "On the river your equity against the hands that bet is above the price. What does that mean?", "choices": ["Calling earns more than folding", "Folding earns more than calling", "It depends on future bets"], "answer": 0, "explain": "On the river nothing else can happen after your call, so equity above the price means the call is profitable."},
  {"q": "Which bet asks you for more equity?", "choices": ["Half the pot", "Twice the pot"], "answer": 1, "explain": "Half the pot needs {{calc 1 / 4 | pct}}; twice the pot needs {{calc 2 / 5 | pct}}."},
  {"q": "Why is the price check only a first estimate on the flop?", "choices": ["Because equity is not defined on the flop", "Because more betting can follow, which can stop you seeing both cards or win you more later", "Because the pot is smaller"], "answer": 1, "explain": "Flop equity assumes you see the turn and the river; bets on later streets change what a call is really worth."}
]
```
