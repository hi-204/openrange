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
