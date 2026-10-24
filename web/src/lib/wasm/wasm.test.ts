// Checks the *committed* WASM artifact, i.e. exactly what users get without Rust installed.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countStartingCombos, initSync, version } from '../../../public/wasm/solver_wasm.js';

const wasmPath = fileURLToPath(new URL('../../../public/wasm/solver_wasm_bg.wasm', import.meta.url));
const cargoToml = fileURLToPath(new URL('../../../../Cargo.toml', import.meta.url));

initSync({ module: readFileSync(wasmPath) });

describe('committed solver WASM', () => {
  it('counts C(52,2) = 1326 starting combos', () => {
    expect(countStartingCombos()).toBe((52 * 51) / 2);
  });

  it('matches the workspace version in Cargo.toml', () => {
    const m = /\[workspace\.package\][^[]*?version\s*=\s*"([^"]+)"/.exec(
      readFileSync(cargoToml, 'utf8'),
    );
    expect(version()).toBe(m?.[1]);
  });
});
