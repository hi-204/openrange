---
id: "2.6"
level: 2
title: Implied and reverse implied odds
minutes: 7
prerequisites: ["2.3", "2.5"]
drills: ["math:potodds"]
glossary: ["implied odds", "reverse implied odds", "set"]
objectives:
  - Work out how much more you must win later to make a call pay.
  - Know when implied odds are real and when they aren't.
  - Spot reverse implied odds: hands that win small pots and lose big ones.
recap:
  - A call that is too expensive now can pay if you win enough extra when you hit.
  - Extra needed = call ÷ chance of hitting, minus the pot after you call.
  - Reverse implied odds are the money you lose later when you hit and still lose.
---

The pot-odds check assumes nothing more is bet. Before the river that's rarely true. If you
hit, you may win more; if you hit a second-best hand, you may lose more.

## Implied odds

[[Implied odds]] are the extra money you expect to win on later streets when you hit. Suppose
your only way to win is to hit, with chance h. Calling C into a pot P (including the bet), and
winning X more on later streets when you hit:

$$
\text{EV} = h \times (P + C + X) - C
$$

This breaks even when

$$
X = \frac{C}{h} - (P + C).
$$

```widget potodds
{"pot": 10, "bet": 5, "equity": 0.09}
```

## Worked hand

Turn. You hold 9♠8♠ on Q♣T♦3♥2♠, a gutshot: only a jack makes your straight. The pot is 10 bb
and your opponent bets 5 bb.

1. **Chance of hitting:** 4 jacks in the 46 cards you haven't seen: {{calc 4 / 46 | pct1}}.
2. **Price:** {{calc 5 / 20 | pct1}}. Far too high for this call on its own.
3. **Extra you need on the river when you hit:** {{calc 5 / (4 / 46) - 20 | bb | show}}.

That's a lot to win with one river bet, from a pot of 20 bb. Unless your opponent will pay off
a big bet often, fold.

## Set mining

With a small pair you flop a [[set]] or better {{calc 1 - (48 * 47 * 46) / (50 * 49 * 48) | pct1}}
of the time (lesson 1.3). Say you call 2.5 bb before the flop and give up whenever you miss.
The call breaks even only if you win, on average, about
{{calc 2.5 / (1 - (48 * 47 * 46) / (50 * 49 * 48)) - 2.5 | bb}} in profit each time you hit.
Sets don't always win and opponents don't always pay, so you need deep stacks and opponents
who will put money in.

## When implied odds are real

They are bigger when:

- **stacks are deep**, so there's money left to win;
- **your hand is well hidden**, so they don't see it coming;
- **your opponent has a strong hand** they will keep betting.

They are small when your hit is obvious (the fourth heart on the board) or the stacks are short.

## Reverse implied odds

[[Reverse implied odds]] work the other way: you hit and still lose, and lose a lot. Examples:

- you make a flush, but a low one, against a higher flush;
- you pair your ace with a weak kicker against a better ace.

These hands win small pots when they're ahead and big pots when they're behind. Count them as
worse than their equity.

```callout key
Implied odds make some calls better than the price says; reverse implied odds make some worse.
Both depend on stack depth and on what your opponent will do next.
```

## Common mistakes

- **Using implied odds to justify any call.** Work out how much extra you need, then ask if it's
  realistic.
- **Forgetting short stacks.** With little behind, there's nothing extra to win.
- **Ignoring reverse implied odds.** Weak flushes and weak kickers lose big pots.

## Check yourself

```quiz
[
  {"q": "What do implied odds count?", "choices": ["Money already in the pot", "Extra money you expect to win later when you hit", "Your chance of hitting"], "answer": 1, "explain": "They are the future winnings that can make a call pay when the price alone doesn't."},
  {"q": "When are implied odds biggest?", "choices": ["Short stacks and an obvious draw", "Deep stacks and a well-hidden hand", "On the river"], "answer": 1, "explain": "You need money left to win and an opponent who doesn't see your hand coming."},
  {"q": "Which hand has reverse implied odds?", "choices": ["The nut flush draw", "A weak ace against a range of strong aces", "A set"], "answer": 1, "explain": "When it hits its ace, a better ace often beats it, and it loses a big pot."}
]
```
