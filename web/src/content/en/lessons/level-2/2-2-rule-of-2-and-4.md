---
id: "2.2"
level: 2
title: The rule of 2 and 4
minutes: 7
prerequisites: ["2.1"]
drills: ["math:outs", "math:equity"]
glossary: ["outs", "equity", "runner-runner"]
objectives:
  - Turn outs into a chance of hitting with the rule of 2 and 4.
  - Work out the exact chance when you need it.
  - Know when the rule is off and why.
recap:
  - One card to come, outs × 2 is close to the percentage; two cards, outs × 4.
  - The rule of 4 only applies when you will see both cards without another bet.
  - With many outs it overestimates; when your outs can still lose, the true equity is lower.
---

Counting [[outs]] tells you how many cards help. To compare with a price you need a chance,
and the rule of 2 and 4 gets you close in a few seconds.

## Exact chance with one card to come

After the flop you have seen 5 cards: your 2 and the 3 on the board. That leaves 47 cards you
haven't seen. With 9 outs, the chance the turn is one of them is
{{calc 9 / 47 | pct1 | show}}. On the turn there are 46 unseen cards: {{calc 9 / 46 | pct1 | show}}.

**Rule of 2:** outs × 2 is close to this percentage. 9 outs × 2 = 18.

## Two cards to come

If you are all-in on the flop you'll see both the turn and the river. You miss only when both
cards miss:

$$
P(\text{hit}) = 1 - \frac{(47 - \text{outs})(46 - \text{outs})}{47 \times 46}
$$

With 9 outs: {{calc 1 - (38 * 37) / (47 * 46) | pct1}}. **Rule of 4:** 9 × 4 = 36, close again.

Try different hands below: the counter shows the rule's estimate next to the engine's exact
[[equity]]. It knows your opponent's cards too, so it divides by 45 unseen cards, not 47.

```widget outs
{"hero": "Ah Kh", "villain": "Qs Qd", "board": "Qh 7h 2c"}
```

## Where the rule is off

- **Many outs.** With 15 outs the rule of 4 says 60, but the exact chance is
  {{calc 1 - (32 * 31) / (47 * 46) | pct1}}. The more outs, the more it overestimates.
- **Outs that can still lose.** Above, A♥K♥ has 8 outs against three queens. The formula gives
  {{calc 1 - (39 * 38) / (47 * 46) | pct1}}, but the engine's equity is
  {{eq AhKh vs QsQd on Qh7h2c}}: some flushes lose when the board pairs on the river.
- **Facing a bet with more to come.** If you call on the flop and may face another bet on the
  turn, you have paid for one card only. Use the rule of 2 for this call.

```callout mistake
Using the rule of 4 to call a flop bet when you aren't all-in. You only get one card for that
price; the turn may bring another bet.
```

## Two cards that win together

Sometimes two cards that aren't outs on their own win together. With two clubs in your hand
and one on the flop, a club on the turn and another on the river make a flush. These [[runner-runner]] draws add a little equity that the rule of 4 leaves
out.

## Worked hand

You hold 8♥7♥ on 9♥6♣2♥, all-in against A♠A♦.

1. **Outs:** 15 (lesson 2.1).
2. **Rule of 4:** 15 × 4 = 60.
3. **Exact, outs only:** {{calc 1 - (32 * 31) / (47 * 46) | pct1}}.
4. **Engine:** {{eq 8h7h vs AsAd on 9h6c2h}}. A little more than the formula: some runouts with
   no out, such as an eight and then a seven, also give you the best hand.

You are a favourite, but by less than the rule of 4 suggests.

## Common mistakes

- **Rule of 4 when only one card is paid for.** It doubles your chance.
- **Trusting the rule with big draws.** With many outs, take a few points off.
- **Forgetting tainted outs.** Outs that can lose make the rule look better than it is.

## Check yourself

```quiz
[
  {"q": "You have 8 outs on the turn. Roughly how likely is the river to hit?", "choices": ["About 16 in 100", "About 32 in 100", "About 8 in 100"], "answer": 0, "explain": "One card to come: 8 × 2 = 16."},
  {"q": "When does the rule of 4 apply?", "choices": ["Whenever you are on the flop", "When you will see both the turn and the river without another bet", "Only on the turn"], "answer": 1, "explain": "It counts two cards, so you must be sure to see both, for example when you are all-in."},
  {"q": "With 15 outs, how does the rule of 4 compare with the exact chance?", "choices": ["It overestimates", "It's exact", "It underestimates"], "answer": 0, "explain": "The rule says 60, the exact chance with outs only is about 54 in 100."}
]
```
