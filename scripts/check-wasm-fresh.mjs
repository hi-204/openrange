// Fails if the committed WASM was built from different Rust sources than the ones in the repo.
// Keeps "works without Rust" honest: users always get a WASM that matches the code.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, wasmSourceHash } from './lib/repo.mjs';

const infoPath = join(ROOT, 'web', 'public', 'wasm', 'BUILD_INFO.json');
const info = JSON.parse(readFileSync(infoPath, 'utf8'));
const current = wasmSourceHash();

if (info.sourceHash !== current) {
  console.error(
    'check-wasm-fresh: web/public/wasm is out of date with crates/.\n' +
      'Run `npm run build:wasm` (needs Rust) and commit the result.',
  );
  process.exit(1);
}
console.log('check-wasm-fresh: committed WASM matches the Rust sources.');
