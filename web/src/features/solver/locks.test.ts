// Node-lock presets, and an end-to-end lock through the WASM solver checked against theory.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, Solver } from '../../../public/wasm/solver_wasm.js';
import type { SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { toySpot, toyBestResponse } from '../lessons/widgets/gamesMath';
import { applyPreset, overall, presetsFor, type LockNode } from './locks';

initSync({ module: readFileSync(fileURLToPath(new URL('../../../public/wasm/solver_wasm_bg.wasm', import.meta.url))) });

const facing: LockNode = { actions: ['Fold', 'Call', 'Raise 20'], aggressive: [false, false, true], strategy: [0.5, 0, 0.3, 1, 0.2, 0] }; // 2 hands
const first: LockNode = { actions: ['Check', 'Bet 3.3', 'Bet 7.5'], aggressive: [false, true, true], strategy: [0.6, 1, 0.3, 0, 0.1, 0] };
const rows = (s: number[], hands: number) => Array.from({ length: hands }, (_, h) => s.filter((_, i) => i % hands === h));

describe('lock presets', () => {
  it('offer what fits the node', () => {
    expect(presetsFor(facing)).toEqual(['asSolved', 'foldMore', 'callMore', 'neverRaise', 'pure']);
    expect(presetsFor(first)).toEqual(['asSolved', 'neverRaise', 'betMore', 'checkMore', 'pure']);
  });

  it('keep every hand a probability distribution and move the right mass', () => {
    const more = applyPreset(facing, 2, 'foldMore', 0.5);
    for (const r of rows(more, 2)) expect(r.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(more[0]).toBeCloseTo(0.5 + 0.5 * 0.5, 12); // hand 0 folds half of its non-fold mass more
    expect(more[1]).toBeCloseTo(0.5, 12); // hand 1 never folded; half its mass moves to fold
    const never = applyPreset(facing, 2, 'neverRaise', 1);
    expect(never[4]).toBe(0); // raise frequency of hand 0
    expect(never[2]).toBeCloseTo(0.5, 12); // its raise went to call
    const bet = applyPreset(first, 2, 'betMore', 1);
    expect(bet[0]).toBe(0); // no checks left
    expect(bet[2]).toBeCloseTo(0.9, 12); // hand 0: 0.3 + 0.6 into the smallest bet
    const pure = applyPreset(first, 2, 'pure', 1, 2);
    for (const r of rows(pure, 2)) {
      expect(r[2]).toBeCloseTo(1, 12);
      expect(r[0]! + r[1]!).toBeCloseTo(0, 12);
    }
    expect(applyPreset(first, 2, 'asSolved', 1)).toEqual(first.strategy);
  });

  it('overall frequencies weight by reach', () => {
    expect(overall([1, 0, 0, 1], [3, 1], 2)).toEqual([0.75, 0.25]);
  });
});

describe('locking the toy game through the WASM API', () => {
  it('a caller locked to fold more makes bluffing every air hand the best response, at the analytic EV', () => {
    const s = new Solver(JSON.stringify(toySpot(10, 75, 1)), 1e9, false);
    s.step(3000);
    const info = JSON.parse(s.info()) as SolverInfo;
    const facingNode = JSON.parse(s.node('[1]')) as SolverNode & { kind: 'action' };
    const m = info.hands[1].length;
    // "Folds more" by half of the calling mass: from the MDF (4/7) down to 2/7 calls.
    const locked = applyPreset(facingNode, m, 'foldMore', 0.5);
    const call = overall(locked, facingNode.reach[1]!, 2)[1]!;
    expect(call).toBeCloseTo((10 / 17.5) * 0.5, 2);
    JSON.parse(s.lock('[1]', JSON.stringify(locked)));
    s.reset();
    s.step(3000);
    const report = JSON.parse(s.exploitability()) as { pctPot: number; evBb: [number, number] };
    const root = JSON.parse(s.node('[]')) as SolverNode & { kind: 'action' };
    const H = info.hands[0].length;
    const airBet = info.hands[0].map((h, i) => (h[0] === '9' ? null : root.strategy[H + i]!)).filter((x): x is number => x !== null);
    expect(Math.min(...airBet)).toBeGreaterThan(0.999);
    expect(report.evBb[0]).toBeCloseTo(toyBestResponse(10, 7.5, 1, call).evBettor, 2);
    expect(report.pctPot).toBeLessThan(0.01);
    expect((JSON.parse(s.node('[1]')) as SolverNode).locked).toBe(true);
    s.free();
  });
});
