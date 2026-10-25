import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countStartingCombos, initSync, parseRange } from '../../../../public/wasm/solver_wasm.js';
import { COMBO_STRINGS, combosOf } from './cards';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

describe('card helpers agree with the engine', () => {
  it('maps every combo index to the engine combo', () => {
    expect(COMBO_STRINGS).toHaveLength(countStartingCombos());
    for (let i = 0; i < COMBO_STRINGS.length; i += 1) {
      const r = JSON.parse(parseRange(COMBO_STRINGS[i]!));
      expect(r.weights.indexOf(1), COMBO_STRINGS[i]).toBe(i);
    }
  });

  it('counts the combos of a hand like the engine (6 / 4 / 12 / 16)', () => {
    for (const h of ['AA', '22', 'AKs', 'T9s', 'AKo', '72o', 'AK', 'QJ']) {
      const engine = JSON.parse(parseRange(h)).combos as number;
      expect(combosOf(h), h).toHaveLength(engine);
    }
    expect(combosOf('QQ')).toHaveLength(6);
    expect(combosOf('AKs')).toHaveLength(4);
    expect(combosOf('AKo')).toHaveLength(12);
  });
});
