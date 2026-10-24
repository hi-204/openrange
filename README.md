# OpenRange

A free, offline No-Limit Texas Hold'em study suite: a validated solver, a trainer that grades
by expected value, and a course from the rules to solver study.

> **Study tool only.** OpenRange does not read your screen, show overlays or HUDs, or connect
> to any poker site. Hand-history import is for reviewing sessions *after* you play. Using
> real-time assistance during play is against the rules of virtually every poker site.

**Status:** milestone M3 — equity calculator and a validated river solver work. See
[docs/STATE.md](docs/STATE.md) for what works today and
[docs/KNOWN_LIMITS.md](docs/KNOWN_LIMITS.md) for what doesn't.

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

Then open <http://localhost:5173>. Stop the server with `Ctrl+C`.

Rust is **not** needed to run the app: the compiled solver (WebAssembly) is included in
`web/public/wasm/`.

### Other commands

| Command | What it does |
|---|---|
| `npm run check` | Runs all checks CI runs (Rust steps are skipped if Rust isn't installed) |
| `npm test` | Web unit tests (Vitest) |
| `npm run test:e2e` | Browser smoke test (uses the Microsoft Edge that comes with Windows) |
| `npm run build` | Production build into `web/dist/` |
| `npm run build:wasm` | Rebuild the solver WebAssembly (needs Rust, see below) |
| `npm run licenses` | Regenerate `docs/THIRD_PARTY_LICENSES.md` |

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

No accounts, no telemetry, no network requests after the page loads. The production build
ships a Content-Security-Policy that blocks connections to any other site. Your progress
stays in your browser's local storage and can be exported as a JSON file.

## License

MIT — see [LICENSE](LICENSE) and [NOTICE](NOTICE). Third-party packages are listed in
[docs/THIRD_PARTY_LICENSES.md](docs/THIRD_PARTY_LICENSES.md).
