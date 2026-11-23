# OpenRange roadmap: ideas beyond the expansion prompt

Ideas that would materially improve OpenRange, each with a rationale, an effort estimate (S: a
day or less, M: a few days, L: a week or more) and a risk. The bigger solver and data work is in
[NEXT.md](NEXT.md); this file is mostly about learning and the app. Smaller fixes and tests suggested by the 1.1
work are in [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Done in the expansion (high value, low risk)

| Idea | Rationale | Effort | Risk |
|---|---|---|---|
| Hand of the day (Home) | A tiny daily habit; one exact push/fold decision, the same all day | S | Low: exact charts only |
| Review inbox (Stats) | Makes the spaced-repetition queue visible and one tap to clear | S | Low |
| Challenge sets (Math Lab) | Focused rounds with a summary, no pressure mechanics | S | Low |
| Practice my weak spots (Stats) | Turns leaks into a session | S | Low: says when data is too thin |
| Range-read calibration | Shows whether you paint ranges too wide or too narrow | S | Low |

## Next candidates

| Idea | Rationale | Effort | Risk |
|---|---|---|---|
| Rapid-fire mode | Keyboard-only, auto-advance preflop rounds (quick mode and number keys exist; a dedicated screen with a running tally would make it a habit) | S | Low |
| Custom drill builder | Save filter presets ("BB defence at 40 bb") and share them as small JSON files | M | Low |
| Shareable study plans | A week of lessons, drills and goals as a JSON file a coach or friend can send | M | Low: no network, files only |
| EV bars in the coach | Show each action's EV as a bar next to the text, so the size of a mistake is visible at a glance | S | Low |
| Equity over the streets | In the postflop drill and replays, a small graph of your equity against the opponent's range on each street | M | Medium: needs the range at every node (available from the solver) |
| Range evolution | Show how a player's range narrows street by street in a solved spot (reach-weighted grids per action) | M | Medium |
| Spaced review for lessons | Bring back a lesson's quiz a week later | S | Low |
| Hand-history import: more sites | Wider post-session review | M per site | Medium: formats change |
| Translations | Every string is already in `en.json` | M per language | Medium: poker terms need a human reviewer |
| Multithreaded and pre-solved spots | See NEXT.md items 1 and 5: faster solves and a flop library unlock flop grading in play and many more drill spots | L | Medium |

## Deliberately not planned

- Anything that runs during real play (HUDs, overlays, screen reading): against the rules of
  poker sites and against OpenRange's purpose.
- Accounts, cloud sync or telemetry: OpenRange is offline and private by design.
- Streaks, badges or other pressure mechanics.
