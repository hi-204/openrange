# OpenRange — Design

_M6.5 design pass. This document is the source for tokens, components, screens and the
information architecture. No frontend-design skill was available in this environment; the
direction below is our own and is recorded in D-063._

## 1. Direction

**A focused study room, not a casino.**
- **Dark theme is the hero:** deep, slightly warm neutrals with one refined accent (iris).
  The light theme is just as finished.
- **Theme:** follows the OS by default.
- **Motion:** quiet and purposeful.
- **Numbers:** tabular everywhere, so they never jitter.
- **Colour is never the only cue:** actions have hue, a shape and a label.

All graphics (cards, chips, felt, icons) are our own SVG/CSS. The quality bar is that of
modern study apps, but nothing is copied: no assets, logos or exact layouts.

## 2. Tokens (`web/src/styles/tokens.css`)

All values live in CSS custom properties, set per theme on `:root[data-theme]`. Tailwind's
theme maps to them (`bg-surface`, `text-muted`, `rounded-card`…). Components never use ad-hoc
colours.

### Colour
| Token | Dark | Light | Use |
|---|---|---|---|
| `--canvas` | `#121110` | `#f7f5f1` | page background |
| `--surface` | `#1a1917` | `#ffffff` | cards, panels |
| `--surface-2` | `#23211e` | `#f1eee8` | raised / hover |
| `--surface-3` | `#2d2a26` | `#e7e2d9` | pressed, inputs |
| `--line` | `#3a3631` | `#d9d2c6` | borders |
| `--ink` | `#ede9e3` | `#1d1b18` | primary text |
| `--ink-muted` | `#aaa39a` | `#5b564e` | secondary text |
| `--ink-faint` | `#7f786f` | `#857e74` | hints, disabled |
| `--accent` | `#8e8ff7` | `#4f50cf` | primary actions, focus, links |
| `--accent-ink` | `#14131f` | `#ffffff` | text on accent |
| `--good` | `#5aa9e6` | `#1f6fb2` | "Best", positive (blue, not green) |
| `--warn` | `#e3b341` | `#8a5f00` | cautions |
| `--bad` | `#e0704a` | `#b23c12` | mistakes, errors |

Text contrast is at least AA (4.5:1) on `--canvas`, `--surface` and `--surface-2`;
`--ink-faint` is only used for large or non-essential text.

**Action colours.** Each action has a hue and a glyph.
- Studio palette (default):
  - fold `#8e9aaf` ✕
  - check `#4fa3a5` ○
  - call `#3f8fd8` ●
  - bet/raise, smallest to largest, `#e3b341` → `#e8873a` → `#d4553a` ▲
  - all-in `#b34a8c` ◆
- Colour-blind palette (Okabe–Ito):
  - fold `#56b4e9`
  - check/call `#009e73`
  - raises `#f0e442` → `#e69f00` → `#d55e00`
  - all-in `#cc79a7`

**Grade colours** (always with a symbol and a word):
- Best `--good` ✓✓
- Acceptable teal ✓
- Inaccuracy `--warn` ?!
- Mistake `--bad` ?
- Blunder magenta ??

**Felt** (`--felt`, `--felt-edge`, `--rail`): green (default) `#1f5a43`, navy `#1e3a5f`,
burgundy `#5a1f2b`, charcoal `#2b2b2b`; a lighter tint in the light theme.

### Type
- **Font:** Inter Variable (OFL-1.1, bundled, D-064), with the system UI font as fallback.
- **Numbers:** every number uses `font-variant-numeric: tabular-nums` (`.num`).
- **Scale (rem):** 0.75 · 0.8125 · 0.875 · 1 · 1.125 · 1.25 · 1.5 · 1.875 · 2.25.
- **Leading:** body 1.55, headings 1.2.
- **Measure:** lesson text 68ch.
- **Text size setting:** scales the root font size (90 / 100 / 112 / 125 %).

### Space, radius, elevation, motion
- **Space:** 4 px grid (Tailwind's scale). Density "compact" tightens card and control
  padding through `--pad` (16 → 12 px) and `--gap`.
- **Radius:** `--r-sm` 6, `--r-md` 10, `--r-lg` 14, `--r-xl` 20 px.
- **Elevation:** `--shadow-1/2/3`, softer and warmer in light, deeper in dark.
- **Motion:**
  - Durations: `--dur-fast` 150 ms, `--dur` 200 ms, `--dur-slow` 250 ms.
  - Easing: `--ease` `cubic-bezier(.2,.8,.2,1)`.
  - The animation-speed setting multiplies durations by 0 (off), 0.6 (fast) or 1 (normal).
  - `prefers-reduced-motion` forces off unless the user picks otherwise.
- **Focus ring:** 2 px `--accent` with a 2 px offset in the canvas colour, on every
  interactive element.
- **Touch targets:** at least 44 px.

## 3. Information architecture

| Section | Contains | Route |
|---|---|---|
| **Home** | continue where you left off, today's plan, recent accuracy, low-key streak, one recommended next step | `#/` |
| **Learn** | course map, placement quiz, lesson reader, glossary | `#/learn`, `#/learn/<id>`, `#/glossary` |
| **Train** | preflop, postflop and math drills, with session summaries | `#/train/<drill>` |
| **Play** | play mode, arriving in M9 (empty state until then) | `#/play` |
| **Solve** | solver workbench, charts, equity calculator, push/fold calculator | `#/solve/<tool>` |
| **Stats** | trainer stats with intervals, math accuracy, course progress | `#/stats` |
| **Settings** | searchable settings with presets | `#/settings` |

- **Desktop:** a left rail with icon + label.
- **Below 768 px:** a bottom tab bar with the five most-used sections (Home · Learn · Train ·
  Solve · Stats); Play and Settings are in a "More" menu.
- **Top bar:** page title, the Guided/Expert switch, and the theme toggle.
- **Old links** (`#/trainer`, `#/charts`, `#/solver`, `#/equity`, `#/pushfold`) redirect.

**Modes** (presentation and defaults only, never correctness):
- **Guided** (default for "new" and "know the basics"): plain labels, tooltips and pre-answer
  hints, "Show advanced" disclosures, Standard coaching detail, study mode (waits after
  feedback).
- **Expert:** denser layout, solver terminology, every panel open, shortcuts shown, Detailed
  coaching, quick mode.

**First run** (under a minute, skippable): experience (new / basics / experienced), main
interest (cash / tournaments / both), theme, card style. This sets the mode and defaults.

## 4. Components

- **Foundation:** Button (primary / secondary / quiet / danger; sizes; icon), IconButton,
  SegmentedControl, Tabs, Switch, Slider (with tabular readout), Select, TextField,
  Tooltip (hover + focus, with a "Learn more" link), Popover, Modal (focus-trapped), Toast
  (polite live region), Card, Badge, Skeleton, EmptyState, ErrorState (with next step),
  ProgressBar, Kbd (shortcut hint), Accordion (advanced settings), Icon (own SVG set).
- **Poker:**
  - Card (SVG; two- or four-colour; three backs; sizes)
  - ChipStack (denominations)
  - PokerTable (2–9 seats, oval or tall, static or interactive)
  - ActionBar (size buttons, slider where the tree allows, shortcut hints)
  - ActionHistory strip
  - SpotChip (summary)
  - RangeGrid (13×13 with highlight)
  - CoachCard
  - SessionSummary
- **Lessons:** Reader layout, TOC, progress bar, Callout (Key idea / Common mistake / Try
  it / Worked example), Quiz (instant feedback), widgets, "Practice this" button.

## 5. The poker table

- **Seats:** 2–9, placed on an ellipse (desktop) or a tall rounded rectangle (under 640 px).
  The hero is always at the bottom centre.
- **Each seat:** label, position, stack (bb or chips, a setting), status (active / folded /
  all-in), turn indicator (accent ring + "to act"), bet in front of the seat.
- **Centre:** dealer button, pot with side pots, board cards with street labels, action
  history strip below the table.
- **Cards:** hero face-up, opponents face-down until showdown.
- **Motion:** dealing (cards slide from the dealer), flipping (3D rotate), chips sliding to the
  pot. All of it can be switched off and follows the animation-speed setting.
- **Variants:** `static` (lessons) and `interactive` (drills, play, replay, workbench).

## 6. Coaching card

The same component is used in every drill, in play-mode review, hand replay and the
workbench's "Explain this node". It has six parts:
1. **Verdict.**
2. **Why:** 2–4 sentences about this hand.
3. **Key idea.**
4. **Next time look for…**
5. **Learn more.**
6. **Show the math:** EVs, the mix, equity against the range, the price, and the 13×13 grid
   with the hand highlighted.

It is generated offline from the claims of D-053, with phrase variants chosen
deterministically by a seed made from the decision. The detail level (Simple / Standard /
Detailed) changes how many reasons are shown, never what they say. Consistency rules and
tests: D-065.

## 7. Settings

A searchable page with progressive disclosure, presets (Beginner / Standard / Advanced) and
"Reset section". It is stored in Dexie (`settings` table, key `app`) and included in the
backup export. Each setting has a one-sentence tooltip. Sections:
- **Game:** table size, stack, game type, rake, blinds/ante. These are the defaults for the
  workbench and play. Drills keep their reference's own structure and say so.
- **Training:** positions, situations, difficulty, hints, timer, auto-advance, spaced
  repetition intensity, grading thresholds.
- **Coaching:** detail level, math shown by default, hints, live coach in play mode.
- **Solver (advanced):** algorithm, iteration cap, target, bet sizes per street, raise depth,
  simplification, memory limit, rake, with the memory estimate shown live. Thread count is
  shown but fixed at 1 in the browser (D-010).
- **Display:** theme, felt, deck, card back, chips vs bb, number format, animation speed,
  reduce motion, text size, density, sound (off by default; synthesized, no files).
- **Data:** export/import, reset progress (confirmed), storage used.

## 8. Lesson reader

- **Reading:** a 68ch column with a sticky table of contents (desktop) and a progress bar.
- **Around the text:** estimated time; "What you'll learn" at the top and "Recap" at the end;
  previous/next lesson.
- **Callouts** via ` ```callout key|mistake|try|example ` fences.
- **Quizzes** give instant feedback per question.
- **"Practice this"** opens the matching drill.
- **Numbers:** computed at build time (`scripts/gen-lesson-facts.mjs` → `facts.json`), see
  D-059 / D-066. Each lesson's claims and how they were checked are listed in
  `docs/LESSON_REVIEW.md`.

## 9. Screens and screenshots

Home, Onboarding, Learn (course map), Lesson reader, Train (preflop / postflop / math with
coach card open), Stats, Solve (workbench, charts), Play (empty state), Settings.
`npm run screenshots` captures each at 1440, 1024 and 390 px wide, dark and light, into
`docs/screenshots/<screen>-<width>-<theme>.png`.

## 10. Defaults assumed (no questions asked; change any by telling me)

- Accent iris, felt green, Inter.
- Four-colour deck by default: easier for beginners to tell suits apart.
- Guided mode for new/basics, Expert for experienced.
- Sound off.
- Animation speed normal (off under reduced motion).
- Stacks shown in bb.
