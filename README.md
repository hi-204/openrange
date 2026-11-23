# OpenRange

A free, offline No-Limit Texas Hold'em study suite: a validated solver, a trainer that grades
by expected value, and a course from the rules to solver study.

> **Study tool only.** OpenRange does not read your screen, show overlays or HUDs, or connect
> to any poker site. Hand-history import is for reviewing sessions *after* you play. Using
> real-time assistance during play is against the rules of virtually every poker site.

**What's in it:**
- **Course:** lessons from the rules (Level 0) to solver study (Level 7), each with a worked
  hand, a widget and a quiz; every number in a lesson is computed, not typed.
- **Train:** preflop, postflop and tournament (ICM) drills graded by EV loss, facing-aggression
  situations, hand reading, range building, a spot library, and "Practice my weak spots".
- **Math Lab:** pot odds, outs, equity, EV, implied odds, MDF, blockers, SPR and bet sizing, each
  with the formula in plain English, a tool and a graded drill.
- **Play:** cash games, sit-and-gos and a small multi-table tournament against reference and
  personality bots, with optional coaching, hand review, what-if replays, a session report and a
  journal.
- **Solve:** a validated solver with node-locking, preflop charts, flop reports, chart
  comparison, equity and ICM calculators.
- **Stats:** progress by week, skill estimates, leaks with confidence intervals.

It works offline and can be installed as an app. Everything stays on your computer.

**Documentation:**

| Document | What's in it |
|---|---|
| [User guide](docs/USER_GUIDE.md) | How to use every page |
| [Validation](docs/VALIDATION.md) | The generated proof that the solver is right |
| [Known limits](docs/KNOWN_LIMITS.md) | What is approximate or missing |
| [Roadmap](docs/ROADMAP.md), [what to build next](docs/NEXT.md) and [improvements from 1.1](docs/IMPROVEMENTS.md) | Where the project could go |
| [Contributing](CONTRIBUTING.md) | Rules and commands for working on the code |
| [State log](docs/STATE.md) | Milestone history |

## Use it (Windows): download a release

The easiest way: no project code and no build.

1. Install **Node.js** (the LTS version) from <https://nodejs.org> if you don't have it, or in
   PowerShell: `winget install OpenJS.NodeJS.LTS`.
2. Open the repository's **Releases** page on GitHub (the "Releases" link on the right of the main
   page) and download the latest `openrange-<version>.zip` under "Assets".
3. Unzip it anywhere and double-click **`start.cmd`**. Your browser opens
   <http://localhost:8080>; keep the black window open while you use OpenRange.

After the first visit it also works offline. To install it as an app, click the install icon at
the right of the browser's address bar (Edge and Chrome both offer it). Elsewhere than Windows,
run `node serve.mjs --open` in the unzipped folder. Use the same address each time: your progress
is saved per address (Settings → Data → Export makes a backup).

## Run it from the code

For changing the code, or to run the very latest version.

1. **Get the code:** on GitHub press **Code → Download ZIP** and unzip it, or clone it with Git:
   ```powershell
   git clone https://github.com/hi-204/openrange.git
   ```
2. **Install the libraries** OpenRange is built on (React, Vite and others). `npm install` reads
   their list from `package.json` and downloads them into a `node_modules` folder; you only need
   to run it once (and again if the list changes). Open a **new** PowerShell window, go to the
   folder and run:
   ```powershell
   cd <the folder you unzipped or cloned>
   npm install
   ```
3. **Start it:**
   ```powershell
   npm run dev
   ```
   Then open <http://localhost:5173>. Stop it with `Ctrl+C`. The development server doesn't save
   the app for offline use.

To look at the app without running it, open the screenshots in `docs/screenshots/`.

## Build your own release zip

```powershell
npm run release
```

It builds the app and writes `release/openrange-<version>/` (with `start.cmd`) and a zip next to
it. `npm run preview` serves the last production build at <http://localhost:4173>.

Rust is **not** needed to run the app: the compiled solver (WebAssembly) is included in
`web/public/wasm/`.

### Other commands

| Command | What it does |
|---|---|
| `npm run check` | Runs all checks CI runs (Rust steps are skipped if Rust isn't installed) |
| `npm test` | Web unit tests (Vitest) |
| `npm run test:e2e` | Browser tests: flows, offline, accessibility, performance budgets (uses the Microsoft Edge that comes with Windows) |
| `npm run build` | Production build into `web/dist/` |
| `npm run release` | Build a self-contained release folder and zip into `release/` |
| `npm run preview` | Serve the last production build at <http://localhost:4173> |
| `npm run build:wasm` | Rebuild the solver WebAssembly (needs Rust, see below) |
| `npm run licenses` | Regenerate `docs/THIRD_PARTY_LICENSES.md` |
| `npm run facts` | Recompute the equities quoted in lessons (also runs before `dev`/`build`) |
| `npm run screenshots` | Capture every main screen into `docs/screenshots/` (1440/1024/390 px, dark and light) |
| `npm --workspace web run test:visual` | Compare a few screens with the visual baselines |

## Rebuilding the solver (optional, needs Rust)

1. Install **Visual Studio Build Tools** with the "Desktop development with C++" workload
   (<https://visualstudio.microsoft.com/visual-cpp-build-tools/>), or:
   ```powershell
   winget install Microsoft.VisualStudio.2022.BuildTools --override "--quiet --wait --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
   ```
2. Install Rust from <https://rustup.rs> (`winget install Rustlang.Rustup`). The repo's
   `rust-toolchain.toml` selects the exact Rust version automatically.
3. Install the matching bindings tool (version must match `Cargo.toml`):
   ```powershell
   cargo install wasm-bindgen-cli --version 0.2.129 --locked
   ```
4. Rebuild: `npm run build:wasm`. Run the Rust tests with `cargo test --workspace`.

## Notes for OneDrive and long paths

- The project works anywhere, but it is fastest **outside OneDrive** (for example
  `C:\Users\<you>\openrange`): `node_modules` and Rust's `target` folder contain many files,
  and syncing them slows builds and can briefly lock files.
- If you see "path too long" errors, enable long paths once (admin PowerShell):
  `New-ItemProperty -Path HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem -Name LongPathsEnabled -Value 1 -PropertyType DWORD -Force`

## Privacy

No accounts, no telemetry, no network requests after the page loads. "Copy diagnostics" on
an error screen copies only technical details (version, page, browser, the error), never your
answers, hands or settings, and only to your clipboard. The production build
ships a Content-Security-Policy that blocks connections to any other site. Your progress
stays in your browser's local storage and can be exported as a JSON file.

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party packages are listed in
[docs/THIRD_PARTY_LICENSES.md](docs/THIRD_PARTY_LICENSES.md).
