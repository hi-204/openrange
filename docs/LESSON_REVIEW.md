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
