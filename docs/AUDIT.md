# OpenRange audit (expansion Phase 0)

Written 2026-11-21 at the start of the expansion pass, from the code and docs at `768311d`
(version 1.0.0). It records what exists, how solid it is, and what the expansion prompt asks
for that isn't there yet. Status: **done** (exists and meets the prompt), **partial** (exists,
but the prompt asks for more), **missing**.

## Test baseline

Run on 2026-11-21 (Windows 11, Ryzen AI 9 HX 370, 31 GB):

| Suite | Result |
|---|---|
| Rust unit and integration tests (`cargo test --workspace`) | 114 passed, 2 ignored by default |
| Heavy Rust tests (`--release --include-ignored`), incl. the 133,784,560-hand evaluator test | all passed (89 in solver-core, incl. both heavy ones) |
| Validation report (`solver-cli validate`) | **112 of 112 checks passed**; another 27 rows only report a value and are not counted; sanity bands 1 of 4 in band (listed separately, not checks) |
| Web unit tests (Vitest) | 204 passed (39 files), after the Phase 0 additions |
| Browser tests (Playwright) | 69 passed at 1.0; plus the new backup round trip (export → delete → import) |
| Visual comparison | 6 of 6 |
| `npm run check` | passing |

The first baseline run failed at the doc-test stage: `rustdoc.exe` had disappeared from the
pinned toolchain on this machine (its `.pdb` was still there). Every test that ran had passed.
Reinstalling the toolchain fixed it; nothing in the repo changed.

## What is solid

- **Solver core** (Rust, validated): hand evaluator with exact category counts over all
  133,784,560 seven-card hands; exact and Monte Carlo equity; CFR / CFR+ / DCFR checked on Kuhn
  and Leduc; heads-up postflop solver (river, turn, flop) cross-checked against an independent
  tabular reference, suit isomorphism, bit-reproducible results with stored goldens;
  node-locking checked against theory; heads-up push/fold exact with ICM; 3–6-handed
  push/fold sampled.
- **Determinism across platforms:** CI runs on Windows and Linux; both re-solve the golden spots
  to the same stored fingerprints, so results are bit-identical across the two. The one
  cross-platform difference found so far was in the license report (per-OS package names), now
  normalised. Visual baselines exist for Windows only.
- **Provenance:** every chart, report and solve carries source, settings, accuracy and commit.
- **Course:** 60 lessons, Levels 0–7, each with a worked hand, common mistakes, a widget, a
  3–5 question quiz and drill links; numbers computed at build time; claims pinned by tests;
  `LESSON_REVIEW.md` per level.
- **App:** offline service worker, installable, accessibility checks on every page and state,
  performance budgets, error boundaries with "Copy diagnostics", release zip.

## What is rough

- **Cash charts:** UTG, HJ and CO open 1.4–1.9 points below their sanity bands (D-050), so cash
  charts are practice only. The "not graded" message names the reason generically, without the
  numbers.
- **Solver speed:** single-threaded, 32-bit storage; D-038's planned speed-ups weren't done
  (D-084).
- **Postflop drills:** six fixed example spots solved in the browser.
- **Play mode:** 2–6 players, chart bots preflop and rule-based bots postflop; postflop
  decisions not graded.
- **Docs drift:** the user guide said the data controls and grading thresholds are under
  Stats → Review; they are under Settings → Data and Settings → Training (fixed in Phase 0).

## Gap list against the expansion prompt

### Phase 0: audit and housekeeping

| Item | Status | Notes |
|---|---|---|
| Audit and test baseline | done | This file. |
| Chart calibration table, diagnosis, recalibration | partial | EQR v2 is already measured from our own postflop solves (D-048–D-050). Bands exist only for 100 bb first-in. The factors are measured against BTN/CO openers and reused against UTG/HJ: the main suspect. |
| Plain-English reason on out-of-band charts | done | Added in Phase 0: the coach quotes each missed band ("UTG opens 12.6% of hands in this chart set; the sanity check expects 14 to 18%"), checked against the file by the claim checker. |
| CI on Linux with determinism | done | Green on Windows and Linux; goldens check bit-identical results. |
| 133,784,560-hand test, validation, backup | done | All pass. A browser test of export → delete → import was added in Phase 0. |

### Phase 1: math and decision tools

| Item | Status | Notes |
|---|---|---|
| Pot-odds trainer | done (Phase 1) | Math Lab: price and call/fold graded separately, "1 in N", draw / no-draw variants, two range templates. |
| Outs and rule of 2 and 4 | done (Phase 1) | Clean outs, tied and tainted outs, rule estimate vs exact equity with the error. |
| Equity estimation | done (Phase 1) | Numeric estimate scored by absolute error; calibration panel (bias with a 2-SE rule). |
| EV calculator and decision trees | done (Phase 1) | EV tool and a drill (fold / call-win / call-lose branches vs checking). |
| Implied and reverse-implied odds | done (Phase 1) | Adjustable tool and a drill (break-even extra winnings, tainted outs). |
| MDF and bluff share | done (Phase 1) | Compared with a solved river spot, per size and player. |
| Combinatorics and blockers | done (Phase 1) | Blocker drill: value combos left and value share. |
| SPR drills | done (Phase 1) | SPR, all-in price and commit decision. |
| Bet-sizing trainer | done (Phase 1) | On a solved river spot, graded by EV loss. |
| Math Lab screen | done (Phase 1) | `#/lab`, nine topics. |

### Phase 2: deeper training modes

| Item | Status | Notes |
|---|---|---|
| Spot library browser | done (Phase 2) | Train → Spot library: filters, search, launch. |
| Range-building drill | done (Phase 2) | EV difference added (combo- and reach-weighted). |
| Hand-reading drill | done (Phase 2) | Train → Hand reading: paint the opponent's action range vs the solved one. |
| Board texture and range advantage | done (Phase 2) | Math Lab advantage drill on report flops. |
| Postflop line drills with running EV loss | done (Phase 2) | EV given up per hand. |
| Facing-aggression drills | done (Phase 2) | Situations: c-bet, lead, check-raise, overbet, bluff-catch. |
| Tournament drills | done (Phase 2) | Bubble, final table, satellite, PKO (approximate); no re-shoves. |
| Weakness-targeted sessions | done (Phase 2) | Stats → Practice my weak spots. |
| Challenge sets and timed rounds | done (Phase 2) | Math Lab challenge: 10 problems, optional count-up timer. |
| Guided and Expert in all drills | done for existing drills | |

### Phase 3: full playing modes

| Item | Status | Notes |
|---|---|---|
| Cash game HU / 6-max / 9-max | done (Phase 3) | Play → Sessions: 2–9 players, reset or carry, rebuys, speed. Blind levels in tournaments. |
| Tournaments (SNG, small MTT simulation) | done (Phase 3) | Sit-and-go and a 27-player simulation (other tables simulated), ICM hints. |
| Spot practice | done (Phase 3) | Play → Spot practice; library links work. |
| Solver-based bot | partial | Preflop from charts where in the tree; solved postflop strategy only in spot practice. |
| Personality bots | done (Phase 3) | Five personalities, documented deviations, leaks and exploits shown. |
| Rule-based fallback, labelled | done | |
| Coaching Off / Review / Live hints | done (Phase 3) | Progressive hints; the reference only on request. |
| Hand review: what-if, all-in EV | done (Phase 3) | In sessions: what-if replays, heads-up all-in EV. |
| Session summary | done (Phase 3) | Session report. |
| Hand-history import | done | PokerStars and GGPoker, review only. |
| Rules tests incl. side pots | done | Plus full ring, multi-way side pots, ties in side pots (Phase 3). |

### Phase 4: workbench and study tools

| Item | Status | Notes |
|---|---|---|
| Workbench (painter, board, tree, exploitability, node browser, runouts, explain) | done | |
| Node-locking and presets | done | One node at a time. |
| Aggregated flop reports | done | One spot, 48 flops, no raises. |
| Equity calculator (multiway, board, dead) | done | |
| ICM calculator | done (Phase 4) | Solve → ICM. |
| Compare views | done (Phase 4) | Solve → Compare: any two charts, difference grid. |
| Study notes, custom spot builder, spot files | done (Phase 4) | Notes on spots (in backups), spot files in the workbench. |
| Exports: PNG, CSV, JSON | done (Phase 4) | Range images from the Charts page. |

### Phase 5: course and content

| Item | Status | Notes |
|---|---|---|
| Lessons Levels 0–7 | done | 62 lessons after Phase 5; stale claims in 6.2 and 7.6 corrected. |
| Engine-computed numbers, LESSON_REVIEW | done | |
| Math Lab and Play guides | done (Phase 5) | "How to use this page" panels; user guide sections. |
| Glossary | done | |
| "How to study efficiently" lesson | done (Phase 5) | Lesson 0.9 (7.6 covers solver study). |
| Mental-game module and journal | done (Phase 5) | Lessons 6.7 and 6.10; Play → Journal. |
| Responsible-play note on About | done (Phase 5) | |

### Phase 6: progress and analytics

| Item | Status | Notes |
|---|---|---|
| Home dashboard | done | Plan, continue, last 7 days, study days, recommended next. |
| Stats by position, scenario, street, hand class | done | With intervals and minimum samples. Missing: drill type and trends over time. |
| Goals, weekly summary, skill estimate per topic | missing | |
| Adaptive difficulty | missing | |
| Calibration tracking | missing | |
| Backup with versioned schemas and migrations | partial | Database version 2 and export schema 2 (reads 1). Missing: a migration test suite. |

### Phase 7: polish and release

| Item | Status | Notes |
|---|---|---|
| Performance, accessibility, errors, offline | done | M10. |
| Docs | partial | Missing: CONTRIBUTING.md; README predates the GitHub release. |
| Smoke tests and screenshots | done | |

## Order of work

Phases in the prompt's order. One adjustment: the chart recalibration is several hours of
computer time, so it runs in the background while later work continues; its results, chart
regeneration and report land as soon as it finishes (recorded in DECISIONS).
