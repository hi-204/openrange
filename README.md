# OpenRange

A free, offline No-Limit Texas Hold'em study suite: a validated solver, a trainer that grades
by expected value, and a course from the rules to solver study.

> **Study tool only.** OpenRange does not read your screen, show overlays or HUDs, or connect
> to any poker site. Hand-history import is for reviewing sessions *after* you play. Using
> real-time assistance during play is against the rules of virtually every poker site.

**Status:** version 1.0. It includes:
- a validated solver with node-locking;
- push/fold and cash charts;
- a trainer graded by EV loss;
- a course from Level 0 to solver study;
- play mode, hand review and flop reports.

It works offline and can be installed as an app.

**Documentation:**

| Document | What's in it |
|---|---|
| [User guide](docs/USER_GUIDE.md) | How to use every page |
| [Validation](docs/VALIDATION.md) | The generated proof that the solver is right |
| [Known limits](docs/KNOWN_LIMITS.md) | What is approximate or missing |
| [What to build next](docs/NEXT.md) | Where the project could go from here |
| [State log](docs/STATE.md) | Milestone history |

## Run it (Windows, PowerShell)

You only need **Node.js 22 or newer** (24 LTS recommended). Download the LTS installer from
<https://nodejs.org>, or in PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Open a **new** PowerShell window (so it sees Node), go to the project folder, and run:

```powershell
cd C:\Users\aless\openrange
npm install
npm run dev
```

Then open <http://localhost:5173>. Stop the server with `Ctrl+C`. The first time, a short
welcome screen asks how much poker you know; you can skip it.

To look at the app without running it, open the screenshots in `docs/screenshots/`.

## Run the release (no install or build)

A release is a folder with the built app and a tiny local server; it needs only Node.js.

1. Make one with `npm run release`. It writes `release/openrange-1.0.0/` and
   `release/openrange-1.0.0.zip`. Or unzip a release someone gave you.
2. In the folder, double-click **`start.cmd`**. Or, in PowerShell:
   ```powershell
   cd C:\Users\aless\openrange\release\openrange-1.0.0
   node serve.mjs --open
   ```
3. Your browser opens <http://localhost:8080>. Keep the window open while you use OpenRange.
   To use another port, add `--port 8090`.

**Offline and install:** after the first visit to a release (or to `npm run preview`),
OpenRange works without a network. Home says "Saved for offline use" when it is ready. To
install it as an app, click the install icon at the right of the address bar, or look for "Install" in the browser's menu (Edge and Chrome both offer it). The dev server (`npm run dev`) never caches.

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
