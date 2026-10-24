// Runs the same checks as CI. Rust steps are skipped (with a warning) if Rust isn't installed,
// so `npm run check` is still useful on a Node-only machine.
// Usage: npm run check
import { hasCommand, run } from './lib/repo.mjs';

const rust = hasCommand('cargo');
const steps = [
  ...(rust
    ? [
        ['cargo fmt', 'cargo', ['fmt', '--all', '--check']],
        ['cargo clippy', 'cargo', ['clippy', '--workspace', '--all-targets', '--locked', '--', '-D', 'warnings']],
        ['cargo test', 'cargo', ['test', '--workspace', '--locked']],
      ]
    : []),
  ['committed WASM is fresh', 'node', ['scripts/check-wasm-fresh.mjs']],
  ['typecheck', 'npm', ['--workspace', 'web', 'run', 'typecheck']],
  ['vitest', 'npm', ['--workspace', 'web', 'run', 'test']],
  ['licenses', 'node', ['scripts/license-report.mjs', '--check']],
];

if (!rust) console.warn('check: Rust not installed — skipping cargo fmt/clippy/test.\n');

for (const [label, cmd, args] of steps) {
  console.log(`\n=== ${label} ===`);
  try {
    run(cmd, args);
  } catch (e) {
    console.error(`\ncheck: FAILED at "${label}". ${e.message}`);
    process.exit(1);
  }
}
console.log('\ncheck: all steps passed.');
