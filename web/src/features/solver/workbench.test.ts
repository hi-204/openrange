import { describe, expect, it } from 'vitest';
import { cellName } from '../../lib/poker/hands';
import type { SolverNode } from '../../lib/wasm/protocol';
import { classWeights, nodeCsv, nodeFrequencies, rangeText } from './workbench';

const node = {
  kind: 'action',
  player: 0,
  actions: ['Check', 'Bet 3.3'],
  aggressive: [false, true],
  strategy: [1, 0.25, 0, 0, 0.75, 1],
  evBb: [1.5, null, 2, 0.5, null, 3],
  reach: [[1, 1, 0], []],
  board: [],
  pot: 10,
  street: 'River',
  committed: [0, 0],
} as unknown as SolverNode & { kind: 'action' };

describe('workbench helpers', () => {
  it('CSV: one row per combo in range, frequencies and EVs, blank where an EV is missing', () => {
    const csv = nodeCsv(node, ['AhKh', 'AsKs', 'QdQc']).trim().split('\n');
    expect(csv[0]).toBe('hand,weight,freq Check,freq Bet 3.3,ev Check (bb),ev Bet 3.3 (bb)');
    expect(csv).toHaveLength(3); // QdQc has no weight
    expect(csv[1]).toBe('AhKh,1.000000,1.000000,0.000000,1.5000,0.5000');
    expect(csv[2]).toBe('AsKs,1.000000,0.250000,0.750000,,');
  });

  it('frequencies are reach-weighted', () => {
    expect(nodeFrequencies(node, ['AhKh', 'AsKs', 'QdQc'])).toEqual([0.625, 0.375]);
  });

  it('range text round-trips class weights', () => {
    const w = new Array(169).fill(0);
    w[0] = 1; // AA
    w[1] = 0.5; // AKs
    expect(rangeText(w)).toBe(`${cellName(0)}, ${cellName(1)}:0.5`);
    const combos = ['AsAh', 'AsAd', 'AhKh', 'AsKs'];
    const cw = classWeights([1, 0, 1, 1], combos);
    expect(cw[0]).toBe(0.5);
    expect(cw[1]).toBe(1);
  });
});
