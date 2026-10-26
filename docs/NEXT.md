# OpenRange: what to build next

OpenRange 1.0 does what the spec's definition of done asks for. This is a roadmap for going
further on **one ordinary computer, offline**: no servers, no cloud, no paid compute.

## Where the limits are today

The solver already does the hard parts well:
- it solves every hand combination exactly, with no grouping of similar hands;
- its showdown evaluation is efficient;
- it skips flops and turns that are just suit-swaps of each other;
- it uses Discounted CFR.

The limits come from how little of the computer it uses:
- **One CPU core** in the browser (D-010), on machines that have 8–16.
- **Memory:** strategies are stored as 32-bit numbers, and a browser page gets at most 4 GB.
- **Nothing is computed in advance:** every flop is solved from scratch while you wait.

So the two big levers are **using the whole machine** and **computing ahead of time**
(overnight). Every item below stays offline and exact. Each one has to pass the validation
suite (docs/VALIDATION.md) before it ships, and every speed-up is measured against today's
solver, not assumed.

## Tier 1: big gains for modest code (do these first)

### 1. Use every CPU core

D-038 planned this for M10, and M10 didn't do it (D-084). Turn and river cards are
independent branches, so they split naturally across threads. There are two routes, and both
are worth having:
- **Threads in the browser.** WebAssembly can use threads when the page is cross-origin
  isolated, which takes two response headers (COOP and COEP). The release's `serve.mjs` and
  the Vite dev server can both send them.
- **A native solver behind the local server.** `serve.mjs` already runs on the user's machine.
  It could start the compiled `solver-cli` for big solves, which gives native speed, all
  cores, CPU vector instructions and no 4 GB cap. Requests stay on 127.0.0.1 and
  same-origin, so the Content-Security-Policy doesn't change.

Expected: a small flop solve drops from about a minute to several seconds. That's an estimate
until it's measured. The CLI must keep a fixed summation order, so results stay identical from
run to run (D-038).

### 2. Converge in fewer iterations

- **Predictive CFR+** (Farina, Kroer and Sandholm, 2021) often reaches a given accuracy in
  fewer iterations than DCFR on poker games. It would be one more `Algorithm` variant in
  `cfr/tabular.rs`, checked on Kuhn, Leduc and the river reference spots. Keep it only if it
  measures faster on OpenRange's spots.
- **Warm starts.** After a node-lock, continue from the previous solution instead of
  restarting (KNOWN_LIMITS: a lock costs a full re-solve).

### 3. Raked cash charts

Postflop solves already take a rake (percentage and cap). The preflop cash charts are still
rake-free (D-016, D-046), and rake changes real low-stakes strategy noticeably. The code change
is small; generating the raked chart family is computer time. D-016 already plans it as a
separate, labelled family.

### 4. Postflop grading in play mode and hand review

Today only preflop decisions in the chart tree are graded. The plan:
- Rebuild each heads-up postflop spot from the real hand. Ranges come from the charts,
  narrowed by each action. Real bet sizes are mapped to the nearest size in the tree, which is
  an approximation and is labelled as one.
- Solve it in the background and grade by EV loss, as the trainer does.
- **River and turn first**, since they already solve in seconds. Flops follow item 1 or item 5.

The honest limits:
- heads-up pots only;
- graded after the hand, never during it;
- your own range is assumed from the charts, and the screen says so;
- lines the tree can't follow stay "not graded".

## Tier 2: compute ahead (the machine works overnight)

### 5. A flop library: all 1,755 distinct flops

That's every flop once suit-swaps are removed, for a few common spots: BTN vs BB
single-raised, SB vs BB, and one 3-bet pot. The native solver would run on all cores, storing
only compact strategies for the key decisions. This would give:
- instant flop browsing;
- trainer drills on any flop;
- instant flop grading (item 4);
- flop reports with raises included (today: 48 flops, no raises, D-077).

**Pilot first:** solve about 50 flops, measure time and size, then decide the tree. Expected
size is tens of MB per spot, so the library is an optional download, not part of the offline
cache.

### 6. Measured equity realization for the cash charts

The 100 bb charts reuse factors measured against one opener (D-048). UTG, HJ and CO open about
1.5–2 points below their sanity bands (D-050). The plan:
- measure the factors against each opener and at 20, 40 and 60 bb;
- measure 4-bet pots and multiway flops directly instead of reusing other factors.

It's the same method as now, run more times: hours to days of computer time, little new code.

**Caveat:** this may not close the gap. The cause may instead be the tree simplifications (no
limps, at most one cold caller). Either way it replaces estimates with measurements and says
which. If early positions do land inside their bands, the cash charts could be graded in the
trainer.

## Tier 3: bigger, more realistic trees

### 7. 16-bit compressed storage

Also planned for M10 by D-038 and not done (D-084). Store regrets and strategies as 16-bit
integers with a scale per node, as open-source solvers already do. That roughly halves memory, so trees about twice as big fit in the browser.

### 8. A more flexible tree

- bet sizes per node instead of one list per street;
- separate donk and probe sizes;
- raises everywhere;
- tree-wide node-locking presets ("this player never bluffs the river") on top of the current
  one-node locks.

### 9. Re-solving later streets at full detail

Solve the flop on a simpler tree, then re-solve the turn or river you're looking at with every
size, using **safe subgame solving**. That technique guarantees the re-solve doesn't become
more exploitable than the original. It's the hardest item worth doing, and it lets one machine
show more detail than it could ever solve at once.

## Tier 4: stretch goals, only after Tier 1 has been measured

### 10. Solving on the graphics card (WebGPU)

The solver runs every hand through the same steps at once, which suits a GPU. The gain could be
large, but it's a lot of new code that's hard to debug. Worth it only if, after item 1, solve
time is still the main complaint.

### 11. Three-way pots, river first, labelled experimental

With three players CFR has no equilibrium guarantee. Results would show their measured
exploitability, like today's 3–6-handed push/fold.

## Smaller items

- A "related lesson" link on the coaching card after each answer (lessons already link to
  drills, but not the other way round).
- Per-combo preflop grading where card removal matters.
- Guided and Expert modes that change the wording itself, not only the defaults.
- Translations: every string is in `web/src/lib/i18n/en.json`. Each language needs review by a
  human who knows poker terms.
- More hand-history formats (other sites, tournaments with ICM context), and saving imported
  hands between visits.
- Postflop play-mode bots that use solved spots (item 5) instead of the rule-based bot.
- Ask the browser for persistent storage after the first lesson, and offer automatic export to
  a file.
- A packaged desktop app (for example Tauri). It would bring native solver speed and remove
  the need for Node.js, but needs a code-signing certificate (about $100–400 a year) to avoid
  Windows warnings (D-083).
- Visual checks on Linux and macOS: CI already passes on Windows and Linux, but the visual
  baselines exist only for Windows, and macOS isn't tested at all.

## Not worth it on one machine

- **A full preflop solve with real postflop subgames.** This is how commercial preflop
  solutions are built, on server clusters. On one computer it's a research project, not a plan.
- **Neural-network solvers (Deep CFR and similar).** Training is expensive and they give up the
  exactness guarantees this project is built on.

## Suggested order

1. Use every core (item 1), measured against today's speed.
2. Predictive CFR+ and warm starts (item 2).
3. Raked cash charts (item 3).
4. River and turn grading (item 4).
5. A 50-flop pilot, then the flop library (item 5).
6. Flop grading.
7. Compressed storage and a more flexible tree (items 7–8).
8. Re-solving later streets (item 9).
9. The GPU (item 10), only if the earlier measurements make it worthwhile.

Steps 1–4 are about one to two milestones of work and would change how the app feels the most.
