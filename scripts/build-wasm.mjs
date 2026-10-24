// Rebuilds web/public/wasm from crates/solver-wasm. Needs Rust; the app itself does not.
// Usage: npm run build:wasm
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { hasCommand, pinnedWasmBindgenVersion, ROOT, run, wasmSourceHash } from './lib/repo.mjs';

const OUT_DIR = join(ROOT, 'web', 'public', 'wasm');
const WASM_IN = join(ROOT, 'target', 'wasm32-unknown-unknown', 'release', 'solver_wasm.wasm');

function fail(msg) {
  console.error(`\nbuild:wasm: ${msg}\n`);
  process.exit(1);
}

if (!hasCommand('cargo')) {
  fail(
    'Rust is not installed (cargo not found).\n' +
      'You only need Rust to rebuild the solver; the app runs without it.\n' +
      'Install it from https://rustup.rs, then open a new PowerShell window and retry.',
  );
}

const want = pinnedWasmBindgenVersion();
const have = hasCommand('wasm-bindgen')
  ? run('wasm-bindgen', ['--version'], { capture: true }).stdout.trim().split(/\s+/)[1]
  : null;
if (have !== want) {
  fail(
    `wasm-bindgen CLI ${want} is required (found: ${have ?? 'none'}). Install it with:\n` +
      `  cargo install wasm-bindgen-cli --version ${want} --locked`,
  );
}

console.log('build:wasm: compiling solver-wasm (release, wasm32)…');
run('cargo', ['build', '-p', 'solver-wasm', '--target', 'wasm32-unknown-unknown', '--release', '--locked']);

console.log('build:wasm: generating JS bindings…');
run('wasm-bindgen', [WASM_IN, '--target', 'web', '--out-dir', OUT_DIR, '--out-name', 'solver_wasm']);

const rustc = run('rustc', ['--version'], { capture: true }).stdout.trim();
const wasmBytes = readFileSync(join(OUT_DIR, 'solver_wasm_bg.wasm'));
const info = {
  sourceHash: wasmSourceHash(),
  wasmSha256: createHash('sha256').update(wasmBytes).digest('hex'),
  wasmBytes: wasmBytes.length,
  rustc,
  wasmBindgen: want,
};
writeFileSync(join(OUT_DIR, 'BUILD_INFO.json'), `${JSON.stringify(info, null, 2)}\n`);
console.log(`build:wasm: done (${(wasmBytes.length / 1024).toFixed(1)} KiB).`);
