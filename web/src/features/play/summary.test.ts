// Session review (D-090): heads-up all-ins found with the board at the time, all-in EV from the
// exact equity, and the report's totals.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { equity, evaluateHand, initSync } from '../../../public/wasm/solver_wasm.js';
import type { Decision } from '../review/reviewHand';
import { act, needsShowdown, newHand, settle } from './engine';
import { allInEvBb, allInSpot, sessionReport, type HandResult } from './summary';

initSync({ module: readFileSync(fileURLToPath(new URL('../../../public/wasm/solver_wasm_bg.wasm', import.meta.url))) });
const strength = (cards: string) => (JSON.parse(evaluateHand(cards)) as { strength: number }).strength;

describe('session review', () => {
  it('finds a preflop heads-up all-in and values it at the exact equity', () => {
    let s = newHand({ names: ['You', 'Bot'], stacks: [20, 20], hero: 0, button: 0, seed: 21 });
    s = act(s, { kind: 'raise', to: 20 }); // hero shoves
    s = act(s, { kind: 'call' });
    expect(needsShowdown(s)).toBe(true);
    s = settle(s, strength);
    const spot = allInSpot(s)!;
    expect(spot.street).toBe('preflop');
    expect(spot.board).toEqual([]);
    expect(spot.pot).toBeCloseTo(40, 9);
    expect(spot.contributed).toBeCloseTo(20, 9);
    const eq = JSON.parse(equity(JSON.stringify({ ranges: [s.seats[0]!.cards.join(''), spot.villain], board: '', dead: '', mode: 'exact' }))).players[0].equity as number;
    expect(allInEvBb(eq, spot.pot, spot.contributed)).toBeCloseTo(eq * 40 - 20, 9);
    // The actual result is what the hero won minus what they put in.
    expect(spot.actualBb).toBeCloseTo(s.collected[0]! - 20, 9);
  });

  it('no all-in EV when the hand ends by a fold or reaches the river with chips behind', () => {
    let s = newHand({ names: ['You', 'Bot'], stacks: [100, 100], hero: 0, button: 0, seed: 22 });
    s = act(s, { kind: 'raise', to: 3 });
    s = act(s, { kind: 'fold' });
    expect(allInSpot(s)).toBeNull();
  });

  it('adds up results, all-in EV and graded losses', () => {
    const d = (lossBb: number, category: 'best' | 'mistake'): Decision => ({ index: 0, action: { street: 'preflop', player: 'You', kind: 'fold', amount: 0, allIn: false }, status: 'graded', ref: { file: 'pushfold-hu.json', chart: 'sb-shove-10', graded: true }, grade: { category, loss: lossBb, gradedLoss: lossBb, lossBb, bestActions: [1], topAction: 1, chosenFrequency: 0, inMix: false, lowerFrequency: false, unconverged: false, unit: 'bb' } });
    const results: HandResult[] = [
      { hand: 1, netBb: 10, allIn: { street: 'preflop', board: [], villain: 'xx', equity: 0.4, pot: 20, contributed: 10, evBb: -2, actualBb: 10 }, decisions: [d(0, 'best')], position: 'BTN' },
      { hand: 2, netBb: -3, allIn: null, decisions: [d(0.6, 'mistake')], position: 'BB' },
    ];
    const r = sessionReport(results);
    expect(r.netBb).toBe(7);
    expect(r.allInAdjustedBb).toBe(-2 - 3);
    expect(r.graded).toBe(2);
    expect(r.lossByPosition).toEqual({ BTN: 0, BB: 0.6 });
    expect(r.mistakes.map((m) => m.hand)).toEqual([2]);
    expect(r.drills).toEqual([{ file: 'pushfold-hu.json', chart: 'sb-shove-10' }]);
    expect(r.leaks).toEqual([]); // far below the minimum sample
  });
});
