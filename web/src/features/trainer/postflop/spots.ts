// Spots for "drill this spot". Ranges and bet sizes are example inputs (the same ones the
// solver page offers); the strategies are solved in the browser. Ranges are written as hand
// classes, so they are suit-symmetric (required by the card mapping, D-051).

import type { SpotJson } from '../../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../../solver/spotForm';

export type DrillSpot = { id: string; street: 'flop' | 'turn' | 'river'; spot: SpotJson; target: number; maxIterations: number; slow?: boolean };

/** One step of a situation's line: matched against the node's action labels. */
export type LineStep = 'check' | 'bet-small' | 'bet-mid' | 'bet-large' | 'raise';

/**
 * Facing-aggression situations (D-089): a line through one street of a drill spot that ends at
 * the hero's decision. Hands are dealt by how often they reach that decision.
 */
export type Situation = { id: string; spot: string; hero: 0 | 1; line: LineStep[] };

export const SITUATIONS: Situation[] = [
  { id: 'vs-cbet', spot: 'flop-qj4', hero: 0, line: ['check', 'bet-small'] },
  { id: 'vs-lead', spot: 'turn-qj74', hero: 1, line: ['bet-small'] },
  { id: 'vs-checkraise', spot: 'turn-qj74', hero: 1, line: ['check', 'bet-small', 'raise'] },
  { id: 'vs-checkraise', spot: 'turn-kt63', hero: 1, line: ['check', 'bet-small', 'raise'] },
  { id: 'bluffcatch', spot: 'river-qj742', hero: 1, line: ['bet-mid'] },
  { id: 'vs-overbet', spot: 'river-qj742', hero: 1, line: ['bet-large'] },
  { id: 'vs-checkraise', spot: 'river-qj742', hero: 1, line: ['check', 'bet-mid', 'raise'] },
  { id: 'bluffcatch', spot: 'river-k9472', hero: 1, line: ['bet-mid'] },
  { id: 'vs-overbet', spot: 'river-k9472', hero: 1, line: ['bet-large'] },
];

/** The action index for a line step among a node's actions, or -1 if the node has none. */
export function matchStep(actions: string[], step: LineStep): number {
  if (step === 'check') return actions.findIndex((a) => /^check/i.test(a));
  if (step === 'raise') return actions.findIndex((a) => /^raise/i.test(a));
  const bets = actions.map((a, i) => ({ a, i, size: Number(a.match(/([\d.]+)/)?.[1] ?? NaN) })).filter((b) => /^bet/i.test(b.a)).sort((x, y) => x.size - y.size);
  if (!bets.length) return -1;
  const k = step === 'bet-small' ? 0 : step === 'bet-large' ? bets.length - 1 : Math.floor((bets.length - 1) / 2);
  return bets[k]!.i;
}

/** Resolve a situation's line to a path from the root, or an error. */
export async function situationPath(line: LineStep[], source: (path: number[]) => Promise<{ kind: string; actions?: string[] }>): Promise<number[]> {
  const path: number[] = [];
  for (const step of line) {
    const node = await source(path);
    if (node.kind !== 'action' || !node.actions) throw new Error('the situation crosses a card or ends the hand');
    const k = matchStep(node.actions, step);
    if (k < 0) throw new Error(`this spot has no "${step}" here`);
    path.push(k);
  }
  return path;
}

export const DRILL_SPOTS: DrillSpot[] = [
  { id: 'river-qj742', street: 'river', spot: toSpot(PRESETS.river), target: 0.3, maxIterations: 2000 },
  { id: 'river-k9472', street: 'river', spot: { ...toSpot(PRESETS.river), board: 'Kh 9h 4h 7c 2d' }, target: 0.3, maxIterations: 2000 },
  { id: 'river-qj742-short', street: 'river', spot: { ...toSpot(PRESETS.river), stack: 5 }, target: 0.3, maxIterations: 2000 },
  { id: 'turn-qj74', street: 'turn', spot: toSpot(PRESETS.turn), target: 0.5, maxIterations: 500 },
  { id: 'turn-kt63', street: 'turn', spot: { ...toSpot(PRESETS.turn), board: 'Kh Th 6h 3s' }, target: 0.5, maxIterations: 500 },
  { id: 'flop-qj4', street: 'flop', spot: toSpot(PRESETS.flop), target: 1, maxIterations: 300, slow: true },
];
