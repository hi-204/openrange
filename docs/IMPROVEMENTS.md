# OpenRange: improvements noticed while building 1.1

Ideas that came out of the 1.1 work: the EQR v3 recalibration, the LAG bot fix, the upgrade
crash and the release itself. They add to the two existing idea lists and don't repeat them:
- [ROADMAP.md](ROADMAP.md): learning and app features;
- [NEXT.md](NEXT.md): solver speed, the flop library, postflop grading in play.

Each idea says why (what happened that suggests it), an effort (S: a day or less, M: a few
days, L: a week or more) and a risk. Nothing here changes the rules in DECISIONS.md: no typed
strategy numbers, provenance on everything, offline, study tool only.

## 1. Cash charts: close or explain the last 0.3–0.4 points

After EQR v3, UTG, HJ and CO open 0.3–0.4 points under their sanity bands at 100 bb (D-086),
so cash spots stay practice.

| Idea | Why | Effort | Risk |
|---|---|---|---|
| **Measure the noise floor first.** Regenerate the 100 bb chart with 5 different `--seed` values at the committed settings (4M iterations, 1M samples) and report each position's open % spread. | The 2M default run was visibly noisy. If seeds alone move opens by ~0.3 points, the "miss" is within noise, and that should be known before any more modelling. | S code, about a day of computer time | Low |
| **Decide in advance what a noisy result means.** If the spread is comparable to the gap, write a DECISIONS entry *before* looking at new results: for example "a position passes if the seed-averaged open % is in band". | The bands must not be loosened after seeing numbers; a pre-registered rule, like D-085's, keeps that honest. | S | Medium: needs care to stay a fair rule |
| **Measure the two reused roles.** The opener out of position against a cold caller, and that caller, reuse late-opener factors (D-085). | They're the roles most specific to early positions, the ones still under band. | M, mostly computer time | Low |
| **Tree ablation: one limp branch.** Add an SB complete to the 100 bb tree in an experimental file and see whether early-position opens move. | NEXT.md item 6 suspected the tree simplifications (no limps, at most one cold caller). An ablation tests that directly instead of guessing. | M | Medium: a bigger tree is slower |
| **Per-position band status on the Charts page.** Show each position's open % next to its band with a pass or miss mark. | Today the page says the file is practice; showing *which* positions miss and by how much makes the reason concrete. | S | Low: numbers come from the file |

## 2. Bots

| Idea | Why | Effort | Risk |
|---|---|---|---|
| **Measured bot profiles, tested.** Simulate ~100k hands per personality against a fixed baseline and measure VPIP, PFR, 3-bet, all-in preflop and fold to a c-bet. A test checks each lands in the range its label promises, and the bot's card shows the measured numbers. | The LAG bug (re-raising all-in with K4o, D-095) was found by playing, not by a test. A frequency test would have caught it. | M | Low |
| **"Why did the bot do that?" after the hand.** In the hand review, name the rule behind each bot action ("LAG: raises the top 45% when at most one raise is in"). | You learn to exploit a leak faster when you can see it. Shown after the hand only, so it stays a study feature. | S | Low |
| **Exploit practice.** A session against one labelled bot with a short brief ("calls too much: value-bet thinner, bluff less") and a summary at the end, using the all-in EV results that already exist. | Playing the LAG, you weren't sure how to beat it; a focused session turns that question into practice. | M | Low |

## 3. Updates and releases

| Idea | Why | Effort | Risk |
|---|---|---|---|
| **Run `check-upgrade` in CI.** Build the previous tag's release and the current one, then run `scripts/check-upgrade.mjs` with Chromium on the Linux runner. | The 1.0 → 1.1 upgrade crash (D-096) was caught only by testing the zip by hand before release. | M | Low |
| **Never lose typed text on an update.** Save notes and journal drafts to IndexedDB as you type, so the automatic reload after an update (D-096) can't lose anything. | KNOWN_LIMITS says unsaved typing is lost if an update takes over at that moment. | S | Low |
| **Release from CI.** On a version tag, CI builds the zip, attaches it to the GitHub release and puts its SHA-256 in the notes. With fixed file timestamps in the zip, anyone can rebuild it and get the same checksum. | 1.1.0 was built, uploaded and verified by hand; a pipeline makes each step the same every time. | M | Low |
| **First-run test on a clean Windows.** Run `start.cmd` in Windows Sandbox with only Node installed. | The release is tested from a developer machine, which may have things a fresh PC lacks. | S | Low |
| **No Node.js needed.** Package `serve.mjs` as a Node single-executable app, so the zip runs without installing Node. | Installing Node is the one setup step. Without code signing Windows still warns on first run (D-083), so weigh that first. | M | Medium |

## 4. Data, provenance and long runs

| Idea | Why | Effort | Risk |
|---|---|---|---|
| **Refuse to write committed data from a dirty tree.** `gen-charts`, `report` and the calibration step stop if the git tree is dirty, unless `--allow-dirty` is given (and the file says so). | In 1.1 the charts and the flop report were first generated from a dirty tree and had to be redone. `validate` catches it, but only afterwards. | S | Low |
| **Long runs keep the PC awake and can resume.** `calibrate-eqr-v3.sh` and similar scripts keep the machine and display awake themselves, write a checkpoint after each round and restart from the last one. | The calibration slowed down when the PC went to sleep, and a stopped run had to start its round over. | S–M | Low |
| **Lesson numbers from the charts.** Extend the `{{eq …}}` placeholders (`gen-lesson-facts.mjs`, D-059) with chart facts, such as `{{chart cash-6max-100bb UTG open}}`, filled in at build time. | After the recalibration, 8 lessons had to be re-derived by hand. With placeholders, regenerating a chart updates its lessons, and the existing lesson tests still check the claims. | M | Low: a worked hand still needs a human to pick it |

## 5. Tests and code health

| Idea | Why | Effort | Risk |
|---|---|---|---|
| **One shared "seed the database before the app loads" helper** for every e2e test that needs old or prepared data. | The migration test failed on CI because the app opened the database before the test seeded it; the fix should be the default, not a one-off. | S | Low |
| **Coach reasons as data, not sentences.** The coach builds a list of reasons and a renderer decides how to word them, with a test that no reason is ever dropped. | A sentence limit in guided mode silently dropped a missed-band reason (fixed in 1.1 by joining sentences). | M | Low |
| **Track bundle size and first-load time in CI.** Fail if the precached build grows by more than a set percent without a note. | Everything is precached for offline use (D-080), so every added file costs every user a download on update. | S | Low |

## If only three

1. **Measure the cash-chart noise floor** (section 1). It decides whether the remaining gap is
   real, and it's mostly computer time.
2. **Measured bot profiles** (section 2). They turn bot behaviour from "looks right" into a
   tested claim.
3. **`check-upgrade` in CI, plus saved drafts** (section 3). Every future release then upgrades
   safely without a manual check.
