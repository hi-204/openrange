# OpenRange: what to build next

OpenRange 1.0 does what the spec's definition of done asks for. This is where it could go
next, roughly in order of value for a learner. Each item names the limit it would remove
(KNOWN_LIMITS.md) or the decision it would revisit (DECISIONS.md).

## 1. Better cash charts (biggest accuracy gain)

The 100 bb 6-max charts are approximate, and UTG, HJ and CO open about 1.5–2 points less
than their sanity bands (D-050).
- Measure equity realization against each opener and at each stack depth, instead of reusing
  one opener's 100 bb factors everywhere.
- Measure multiway flops and 4-bet pots directly instead of reusing other factors.
- Longer term: solve preflop with real postflop subgames for the most common flops, and use
  realization factors only for the rest.

Once early positions land inside their bands, the cash charts could be graded in the trainer
like push/fold.

## 2. A faster solver

Flop solves in the browser are slow and single-threaded (D-010, D-038).
- **Threads:** WebAssembly threads need a cross-origin-isolated page. The release's own server
  (`serve.mjs`) can send the two headers that allow it, so threads could be added there first.
- **SIMD and smaller storage:** 128-bit SIMD for the regret updates, 16-bit compressed
  strategies for big trees.
- **Pre-solved packs:** ship a few hundred common flop spots, solved with the CLI, as data
  files, so the trainer and reports don't need a browser solve.

## 3. A richer game tree

- Separate donk and probe sizes, and different bet sizes per node, not one list per street.
- Raises in the flop report, so check-raises and c-bet levels are realistic, and a turn report.
- Tree-wide node-locking presets ("this player never bluffs the river") on top of the current
  one-node locks.

## 4. Trainer and course

- A "related lesson" link on the coaching card after each answer (lessons already link to
  drills, but not the other way round).
- More postflop drill spots (which needs item 2's pre-solved packs), and per-combo preflop
  grading where card removal matters.
- Guided and Expert modes that change the wording itself, not only the defaults.
- Translations: every string is in `web/src/lib/i18n/en.json`, so adding a language is a new
  file and a language setting.

## 5. Hand review and play

- More hand-history formats (other sites, tournament context with ICM) and saving imported
  hands between visits.
- Postflop play-mode bots that use solved spots where one exists, instead of the rule-based bot.

## 6. Data safety and packaging

- Ask the browser for persistent storage after the first lesson, and offer automatic export
  to a file.
- A packaged desktop app (for example Tauri) with an installer, so Node.js isn't needed; it needs
  code signing and an update channel (D-083).
- Visual checks on Linux and macOS: CI already passes on Windows and Linux, but the visual
  baselines exist only for Windows, and macOS isn't tested at all.
