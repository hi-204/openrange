// The browser's push/fold solver (WASM) must reproduce the committed exact heads-up chart,
// which the native CLI generated.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, loadPairs, pushFold } from '../../../public/wasm/solver_wasm.js';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
loadPairs(readFileSync(root('data/equity/preflop-pairs.json'), 'utf8'));

type Chart = { id: string; strategy: number[][] };
const charts = JSON.parse(readFileSync(root('data/charts/pushfold-hu.json'), 'utf8')).charts as Chart[];

describe('WASM push/fold', () => {
  it('matches the committed heads-up 10 bb chart', () => {
    const r = JSON.parse(pushFold(JSON.stringify({ stacks: [10, 10], pusher: 0, caller: 1, ante: 0, payouts: [] })));
    const sb = charts.find((c) => c.id === 'sb-shove-10')!;
    const bb = charts.find((c) => c.id === 'bb-call-10')!;
    let worst = 0;
    for (let i = 0; i < 169; i++) {
      // Same deterministic solve as the CLI; the chart stores 4 decimals.
      worst = Math.max(worst, Math.abs(r.pusher.strategy[i][1] - sb.strategy[i]![1]!), Math.abs(r.caller.strategy[i][1] - bb.strategy[i]![1]!));
    }
    expect(worst).toBeLessThanOrEqual(5e-5 + 1e-12);
    expect(r.exploitability).toBeLessThanOrEqual(1e-6);
  });

  it('solves an ICM bubble spot and reports prize units', () => {
    const r = JSON.parse(pushFold(JSON.stringify({ stacks: [12, 20, 8], pusher: 1, caller: 2, ante: 0, payouts: [65, 35] })));
    expect(r.units).toBe('prize');
    expect(r.exploitability).toBeLessThan(1e-4);
  });
});
