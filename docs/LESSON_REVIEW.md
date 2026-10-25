# Lesson review

For every lesson: its key factual claims and how each was checked.

**Methods:**
- **engine:** computed by OpenRange's evaluator or equity engine at build time
  (`facts.json`; a test fails if it is stale).
- **calc:** arithmetic in a `{{calc}}` directive, evaluated when the lesson renders.
- **test:** asserted by a unit test.
- **reasoning:** a definition or a rule that follows from one, checked by hand. These are
  listed so a reviewer can check them too.

The lesson lint (D-059) also guarantees, for every lesson:
- no typed percentage, decimal or `$` in the prose;
- every directive renders;
- every glossary term exists;
- every quiz has 3–5 questions with explanations.

## 2.3 Pot odds

| Claim | Method |
|---|---|
| Price of a call = C ÷ (P + C), with P the pot including the bet faced | reasoning: you put in C and the final pot is P + C; with equity e the call earns e·(P + C) − C, which is zero exactly when e = C ÷ (P + C) |
| Pot 10 bb, bet 5 bb: price 25% | calc |
| Prices of a third / half / full / double pot bet: 20% / 25% / 33% / 40% | calc (B ÷ (P + 2B) with B as a share of P) |
| 9♥8♥ vs A♠Q♦ on Q♥7♥2♣4♠ has 20.5% equity | engine (exact over every river card; equals the 9 remaining hearts out of 44 unseen cards) |
| Facing 6 bb into 10 bb the price is 27.3%, more than the equity, so folding is better on this check | calc + reasoning |
| Facing 2 bb into 10 bb the price is 14.3%: the equity covers it | calc |
| On the river the check is exact | test: the river identity EV(call) − EV(fold) = equity · pot after calling − call holds within 8.1e-5 bb on solved river decisions (D-057) |
| Before the river, later betting changes the value of a call (implied odds, being bet off a draw) | reasoning; the lesson labels the price check "a first estimate" there |
| Common mistake: a pot-sized bet needs 33%, not 50% | calc |
| Quiz: pot 12 bb, bet 6 bb → 25% | calc |

## Level 0

The Level 0 claims are rules of No-Limit Hold'em, checked by hand (reasoning) unless marked
otherwise. Hands quoted at showdown were also checked with the hand evaluator
(`evaluateHand`, tested in solver-wasm and, for 133,784,560 seven-card hands, in solver-core).

| Lesson | Key claims | Method |
|---|---|---|
| 0.1 How a hand flows | 2 hole cards; flop 3, turn 1, river 1; four betting rounds; a hand ends when all but one fold or at showdown; best 5 of 7 using 0–2 hole cards | reasoning; the worked hand's best five (Q♦Q♠Q♣A♦9♦) via the evaluator |
| 0.2 Blinds, button and dealing | button moves clockwise; SB then BB to its left; preflop action starts after the BB, postflop after the button; heads-up the button is the SB | reasoning |
| 0.3 The betting actions | check/bet with no bet, fold/call/raise facing one; minimum raise adds at least the last increment (1 → 2, 3 → 6, 3 → 10 → 17, 2.5 → 4); all-in for less, side pots | reasoning (arithmetic) |
| 0.4 Hand rankings | category order; wheel and no wrap-around; suits don't rank; tie-break order within categories; KK99 beats QQJJA | reasoning + evaluator (ranker widget uses it) |
| 0.5 Best five of seven | reading order; board plays and splits; KK88A beats KK88Q; 10♥ beats a 5–9 heart straight flush | evaluator |
| 0.6 Showdown, kickers, split pots | kickers compared from the top; a board can counterfeit kickers (split); trips beat two pair; who shows first; odd chips by house rule | evaluator for the hands; reasoning for procedures |
| 0.7 Game formats | cash vs tournament differences; think in big blinds (4,000 ÷ 400 = 10 bb) | reasoning + calc |
| 0.8 Table etiquette | act in turn, binding verbal actions, string bets, protecting hands, angle shooting; most sites forbid real-time assistance | reasoning (common house rules; wording kept general because rules vary by room) |
