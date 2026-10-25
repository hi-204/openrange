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
otherwise. Every hand quoted at a showdown (worked hands, callouts, quiz answers) is checked
with the engine's hand evaluator in `web/src/features/lessons/lessonHands.test.ts` ("evaluator"
below).

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

## Level 1

Chart claims are checked against the generated 100 bb cash charts in
`web/src/features/lessons/lessonCharts.test.ts` ("charts" below); if the charts are regenerated
and a claim stops holding, that test fails. Chart shares are shown by the chart widget, never
typed.

| Lesson | Key claims | Method |
|---|---|---|
| 1.1 Positions | seat order UTG, HJ, CO, BTN, SB, BB; after the flop the blinds act first and the button last; in/out of position; more players behind means more chances of a strong hand | reasoning |
| 1.2 The 169 hands | 1326 combos; 13 pairs × 6, 78 suited × 4, 78 offsuit × 12; pair ≈ 5.9%, suited ≈ 23.5%, aces once per 221 hands; AK with an ace removed: 16 → 12; quiz KK with two kings out: 1 | calc + reasoning |
| 1.3 Hand categories | set or better on the flop with a pair ≈ 11.8% (one minus C(48,3)/C(50,3)), "one flop in eight or nine"; AhKh vs 7c7d 47.9%, AhKd vs 7c7d 45.0% ("a few points"); Ad7h vs AcKs 26.7% | calc + engine; family descriptions are reasoning |
| 1.4 Raise, don't limp | a limp can't win the blinds at once because the BB may check; worst-case raise to 2.5 bb breaks even at 2.5 ÷ (2.5 + 1.5) = 62.5% folds; EV widget numbers are labelled illustrative assumptions; OpenRange's tree has no limps | calc + reasoning; tree fact from DECISIONS (cash tree) and KNOWN_LIMITS |
| 1.5 Open-raise ranges | raise share grows UTG < HJ < CO < BTN, BTN more than three times UTG; SB between CO and BTN; each seat keeps the previous range; HJ adds 66–44, CO adds A7s–A4s, 76s, 65s, 98s, BTN adds suited kings/queens and many offsuit hands; A9o folds UTG, raises CO and BTN; BTN in its sanity band, UTG/HJ/CO below; charts approximate | charts |
| 1.6 Reading the grid | BB vs BTN has mixed cells; T9s mixes call and 3-bet; BTN facing a 3-bet has greyed hands and every one is a first-in fold; the trainer counts any action in the mix as correct | charts; grading rule from `grading.ts` (MIX_THRESHOLD) |

## Level 2 (2.1, 2.2, 2.4–2.8)

Outs and showdown claims are checked with the engine's `countOuts` and evaluator in
`lessonHands.test.ts`; quoted equities are engine facts (`facts.json`).

| Lesson | Key claims | Method |
|---|---|---|
| 2.1 Counting outs | flush draw 13 − 4 = 9, OESD 8, gutshot 4, two overcards 6, combo draw 9 + 8 − 2 = 15; 8♥7♥ vs A♠A♦ on 9♥6♣2♥ has 15 outs (9 hearts, three 5s, three Ts); A♥K♥ vs Q♠Q♦ on Q♥7♥2♣ has 8 (2♥ fills them up; A/K not outs); J♣T♣ vs A-A on 9♥8♦2♠ has 8 (Qs, 7s), more vs A-K | calc + test (countOuts, evaluator) |
| 2.2 Rule of 2 and 4 | 9/47 = 19.1%, 9/46 = 19.6%; two cards 1 − (47 − o)(46 − o)/(47 × 46): 9 outs 35.0%, 15 outs 54.1%, 8 outs 31.5%; engine 25.6% for A♥K♥ vs Q♠Q♦ (below the formula) and 56.3% for 8♥7♥ vs A♠A♦ (above it: runner-runner, e.g. 8 then 7, checked); the counter divides by 45 because it knows both hands | calc + engine + test |
| 2.4 Equity | AKs vs QQ 46.2%, AKo vs 77 45.0%, JJ vs AKs 53.9%, KK vs AA 18.1% ("about four in five" for the higher pair); JJ vs QQ+ 18.4%, vs AK 56.1%, vs both 36.2% = the 18/16-combo weighted average; worked hand: 36.2% < 50 ÷ 110 = 45.5%, so fold | engine + test (identity and comparisons on the facts) |
| 2.5 Expected value | EV = Σ p·v; 0.5·10 − 0.5·5 = 2.5 bb; EV(call) = e(P + C) − C: 0 at a quarter, 3 bb at two fifths; bluff breaks even at B ÷ (P + B): 7.5 into 10 → 42.9%; worked hand 2 bb with an assumed fold rate (labelled as a guess), break-even 40% | calc + reasoning (same identity as 2.3) |
| 2.6 Implied odds | EV = h(P + C + X) − C, break-even X = C/h − (P + C); gutshot 4/46 = 8.7%, price 25%, X = 37.5 bb; only a jack makes 9♠8♠ a straight on Q♣T♦3♥2♠ (checked); set-mining profit needed 2.5/p − 2.5 with p = 11.8% → 18.75 bb | calc + test + reasoning |
| 2.7 Combinatorics | pair combos k(k − 1)/2, two ranks a × b; on K♠7♦2♣: KK 3, 77 3, K7 9, AK 12, AA 6; sets together 9 < AK 12; holding A♠K♦: KK 1, AK 6 | calc (the combo widget counts the same way) |
| 2.8 Blockers | QQ+/AK = 34 combos, with A♠ 27 (AA 3, AK 12); on K♥9♥4♥7♣2♦ 45 heart combos, 36 with A♥ in hand; the A-high flush is the best hand there | calc + test (evaluator) |

## Level 3

Every chart claim is checked against the 100 bb cash charts in `lessonCharts.test.ts`
("charts"): action shares, which hands take which action, and EV comparisons, where "clearly
better" means the EV difference is more than two standard errors of the sampled EVs. Tree sizes
(opens, 3-bet multipliers, 4-bet 2.3×, squeeze +1× per caller) are asserted from the chart
file's tree. Pot arithmetic is `{{calc}}`.

| Lesson | Key claims | Method |
|---|---|---|
| 3.1 Defending | BB price vs a 2.5 bb BTN open 1.5 ÷ 5.5 = 27.3%; BB defends over half vs BTN, under half that vs UTG; BB 3-bets only TT+/AK vs UTG; BTN calls < 2% vs CO, SB < 5% vs BTN; K9o calls vs BTN, folds vs UTG | calc + charts; "calling invites squeezes" is reasoning |
| 3.2 3-betting | AA, KK, QQ, A-K 3-bet in every facing-an-open chart; pure-bluff 3-bet to 10 needs 9 ÷ 13 = 69.2%; BTN vs CO 3-bets A5s, 76s, 65s, which BB vs BTN calls; BB calls A9s–A2s; BTN 3-bets at least four of them | calc + charts |
| 3.3 Facing 3-bets | BTN price vs 3-bet to 10: 7.5 ÷ 20.5 = 36.6%; UTG vs 3-bet to 7.5: 5 ÷ 16.5 = 30.3%; UTG, HJ and CO fold less to the BTN's 3-bet than to the BB's; BTN folds under half to the BB; AA/KK 4-bet; AJo calls | calc + charts |
| 3.4 4-bets and 5-bets | pot 46.5 after a called 4-bet, 77 behind, SPR 1.7; all-in price 77 ÷ 200.5 = 38.4%; BTN calls the all-in with exactly AA–99 and A-K; BB all-in with AA, KK, A-K (over 60% of its all-in combos), QQ mixes, 44 all-in within EV noise; JJ 18.4% vs QQ+, 56.1% vs AK, 36.2% vs both (short of the price), yet the chart calls and call EV is clearly above fold | calc + engine + charts |
| 3.5 Blind vs blind | SB opens 3 bb, over 30% of hands; BB price 2 ÷ 6 = 33.3% vs 27.3% against BTN; BB defends more vs SB and 3-bets 1.7–2.5× as often; K2o calls vs SB, folds vs BTN | calc + charts; position as the reason is reasoning |
| 3.6 Squeezes | squeeze to 12.5 into 6; pure bluff needs 11.5 ÷ 17.5 = 65.7%; SB's calls vs BTN contain no AA, KK, QQ, AK; with a caller BB raises more and calls under half as often; KQo squeezes, clearly above calling | calc + charts |
| 3.7 Calling vs raising | 77, KQo, KJs: 3-bet clearly above call for BTN vs CO; for over 80% of the hands BTN 3-bets there, 3-bet EV > call EV; BB vs BTN: A5s call clearly above 3-bet; BB fold EV −1 bb | charts |

## Level 4

Solver claims are checked in `lessonPostflop.test.ts`, which solves the lesson spots with the
engine (river and turn to 0.05% of the pot; the claims were also checked at the drills' own,
looser targets; flop to its 1% target) and groups hands as the lessons do: made hands on the
flop and turn (two pair or better, one pair, a straight or flush draw, nothing), equity against
the other range on the river (strong ≥ 75, medium 35–75, weak < 35). Range-vs-range claims use
exact equities and the widget's "very strong" threshold (85).

| Lesson | Key claims | Method |
|---|---|---|
| 4.1 C-betting | on Q♠J♥4♦ range A has more equity and more very strong hands; OOP bets a third of the pot with over 85% of its range and over 80% of each group; A-K bets; facing the bet IP folds under 30% | engine + solver |
| 4.2 Board textures | 22,100 flops; monotone 5.2%, rainbow 39.8%, two-tone 55.1%, paired 16.9%; more of both ranges in the 35–65 equity middle on J♥T♥9♠ than K♠7♦2♣; the opener's very strong share on 8♠8♦3♣ under half of K♠7♦2♣; A♠A♦ vs the call range 86.9% vs 62.5% | calc + engine |
| 4.3 Range vs nut advantage | A♠K♦3♣: opener ahead on both; 7♠6♦5♣: opener more equity, caller more very strong hands (exactly 77, 66, 55, 98s); QQ over 55% there; betting implications | engine; implications are reasoning |
| 4.4 Position | turn spots solved with the ranges swapped: each range realizes more in position on both boards; on Q♠J♥7♦4♣ the stronger range realizes above 100% OOP and clearly more IP; the weaker range below 100% both ways and much less OOP | solver + engine; "why" is reasoning |
| 4.5 SPR | SRP 5.5 pot, 97.5 behind → 17.7; 3-bet pot 20.5, 90 → 4.4; 4-bet pot 1.7; pot-sized bet and call triples the pot; 90 → 69.5 → 8 after two pot bets | calc; commitment guidance is reasoning |
| 4.6 Check-raising | Q♠J♥7♦4♣ and K♥T♥6♥3♠ facing a pot bet after a check: two pair+ never folds and raises 35–70%; pairs raise under 5%; draws fold over 70% yet some raise; strong hands are the largest raise group; T9s raises over 60%, A-K (a gutshot) folds over 75%; price 10 ÷ 30, 8/46 = 17.4% | solver + calc |
| 4.7 Protecting checks | strong hands check 15–35% on Q-J-7-4 ("about a quarter") and 30–50% on K-T-6-3 ("about two in five"); IP bets over 80% of its strong hands after a check; QJs both checks and bets | solver |
| 4.8 Turn and river | turn draws bet more often than pairs; river bets of 7.5 and 15 have under 5% medium hands; medium hands never bet big; IP folds more to bigger bets; medium hands call the small bet over 95% and fold over half to the overbet; price 15 ÷ 40 | solver + calc |
| 4.9 Sizing | price B ÷ (P + 2B) and MDF P ÷ (P + B) for a third, three quarters and one and a half pots; small bet over 40% medium hands, big bets under 5%; IP defence within 6 points of MDF at each size; strong hands split between check, small and three-quarter bets, overbet under 10% | calc + solver |

## Level 5

The river game (lessons 5.1–5.3, 5.6, 5.7) is solved by OpenRange's real postflop solver on
K♥9♦6♣3♠2♥ (a set of nines or Q-J against A-K). `gamesMath.test.ts` checks the engine against
the theory at 15 bet/air settings (bluff share, air that bets, value that bets, call frequency
within 0.2–0.5 points, bettor EV within 0.01 bb). Other solver claims are in
`lessonPostflop.test.ts`, chart claims in `lessonCharts.test.ts`.

| Lesson | Key claims | Method |
|---|---|---|
| 5.1 Equilibrium | definitions; bluffs B ÷ (P + 2B) of bets, calls P ÷ (P + B); pot bet → a third bluffs, half calls; three-quarter pot → 30% bluffs, 57.1% calls; the engine matches | reasoning + calc + test (engine vs theory) |
| 5.2 MDF | MDF = P ÷ (P + B); half pot 66.7%, pot 50%, twice pot 33.3%; with a quarter air hand per value hand at a pot bet the caller folds every time (engine too); 12 into 6 → 66.7% | calc + test |
| 5.3 Bluff-to-value | bluff share and value : bluff ratio for a third, half, pot, twice pot (20%/4.0, 25%/3.0, 33.3%/2.0, 40%/1.5); with 2 air per value the engine follows the formula at every slider size; 12 value combos → 6 bluffs at a pot bet | calc + test |
| 5.4 Polarized vs merged | small river bets merged, big polarized (4.9 tests); J♦T♦ is medium, bets a third every time and never big; K♥Q♦ is strong against this range and bets three quarters 50–80% | test (solver) |
| 5.5 Blockers | on K♥9♥4♥7♣2♦ high-card hands with a heart bet over twice as often as those without, also at three quarters alone; Q♥J♣ bets more than Q♠J♣; on the dry river, zero-equity weak hands bluff more than weak hands with some showdown value | test (solver) |
| 5.6 Mixing | mixing at indifference; frequencies far from theory after few iterations and settled after 3,000; the BB squeezes KQo over 90% and mixes T9s; the trainer counts any action in the mix as correct | test (engine, chart) + grading rule |
| 5.7 Exploitability | definition; the postflop drills widen the grading allowance by the solve's exploitability (`noiseFloorPct`); a caller locked at 40% (below the MDF) makes bluffing all air the best response; 1% of a 20 bb pot = 0.2 bb | test + code + calc |

## Level 6

`lessonLevel6.test.ts` checks the ICM, push/fold and variance claims with the engine (ICM is
solver-core's Malmuth–Harville implementation, validated in VALIDATION; push/fold is the exact
heads-up solver).

| Lesson | Key claims | Method |
|---|---|---|
| 6.1 Exploitative play | below the MDF bluff all air, above it none; the Stats page waits for 30 answers per group | test (best response) + `MIN_SAMPLE` |
| 6.2 Node-locking | a caller locked above the MDF of a pot bet: no bluffs, value earns more than at equilibrium; the workbench has no node-locking yet (planned) | test + reasoning |
| 6.3 ICM | two players: 0.75 × 70 + 0.25 × 30 = 60; with 5,000/3,000/1,500/500 and 50/30/20 the leader's prize share is below its chip share and the short stack's above; doubling the 3,000 stack raises its equity by under 1.6× | calc + test |
| 6.4 Bubble | factor ÷ (factor + 1): factor 2 → 66.7%; 8 bb calling 20 bb at 12/20/8 with 65/35: factor 1.4–1.65, needs 57–63%; push/fold 20 bb into 8 bb: chip EV shove 50–70% and call 40–50%, ICM shove over 90% and call under a third; JTo calls in chip EV and folds with payouts; heads-up payouts change ranges by under 1 point | calc + test |
| 6.5 Variance | 10,000 hands at 5 bb/100, SD 100: mean 500, spread 1,000, behind 28–33% ("three times in ten"); risk of ruin with 2,000 bb about 1 in 7, with 4,000 bb its square, about 1 in 55; 20,000 hands spread about 1,400 | test (formulas) |
| 6.6 Game selection | example numbers only, labelled as examples; per-hour arithmetic | calc + reasoning |
| 6.7 Tilt | Q9o is not in the UTG range; A-A against K-K is over 80% | test (chart, facts) + reasoning |
| 6.8 Notes | most rooms forbid real-time assistance; OpenRange has no live overlay | reasoning; product fact |

## Level 7

| Lesson | Key claims | Method |
|---|---|---|
| 7.1 Reading output | on the river spot the first player checks 40–60% and bets small more than big | test (solver) |
| 7.2 Bet-size theory | river: a third > three quarters > one and a half pots, the last under 5%; on both turn spots after a check, the pot bet is used over twice as often as half pot, over 60% of it strong hands and draws, and strong hands bet the pot over 70% | test (solver) |
| 7.3 Low SPR | with 5 bb behind, all-in is used over 30% and medium hands bet over 10 points more often than with 90 bb; SPR 45 ÷ 20 | test + calc |
| 7.4 Multiway | A-A loses over 8 points of equity to a second random hand and stays above 60%; 8♥7♥ is 45–50% heads-up and within 2 points of a third three-way (Monte Carlo, 400,000 samples); OpenRange solves postflop heads-up only | test (sampled equity) + KNOWN_LIMITS; implied-odds point is reasoning |
| 7.5 Abstraction | with only the three-quarter size, medium hands bet over 20 points less often; the bettor's EV with all sizes is at least that of either single size (within exploitability), and less than 2% of the pot apart; adding options can't lower equilibrium EV | test (solver) + reasoning (theorem) |
| 7.6 Studying | product features as described (grading, Stats sample size, review queue); reports are planned | reasoning |
| 7.7 Over-interpretation | after 10 iterations the toy call frequency is over 3 points from the MDF, after 3,000 within 0.2; 44's EVs in the 4-bet chart are within their margins | test |
