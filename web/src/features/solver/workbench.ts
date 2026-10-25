// Pure helpers for the solver workbench: CSV export, range text from a painted grid, and
// runout summaries.

import { cellName, cellOf } from '../../lib/poker/hands';
import type { SolverNode } from '../../lib/wasm/protocol';

type ActionNode = SolverNode & { kind: 'action' };

/** One row per combo of the acting player: weight, then frequency and EV of each action. */
export function nodeCsv(node: ActionNode, hands: string[]): string {
  const n = hands.length;
  const reach = node.reach[node.player]!;
  const head = ['hand', 'weight', ...node.actions.map((a) => `freq ${a}`), ...node.actions.map((a) => `ev ${a} (bb)`)];
  const esc = (x: string) => (/[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x);
  const rows = hands
    .map((h, i) => ({ h, i }))
    .filter(({ i }) => reach[i]! > 0)
    .map(({ h, i }) => [
      h,
      reach[i]!.toFixed(6),
      ...node.actions.map((_, a) => node.strategy[a * n + i]!.toFixed(6)),
      ...node.actions.map((_, a) => {
        const ev = node.evBb[a * n + i];
        return ev === null || ev === undefined ? '' : ev.toFixed(4);
      }),
    ]);
  return [head, ...rows].map((r) => r.map(esc).join(',')).join('\n') + '\n';
}

/**
 * Range text for per-class weights (grid order): full classes by name, partial ones as
 * `AKs:0.5`. Combos within a class are assumed equally weighted, as painting produces.
 */
export function rangeText(weights: number[]): string {
  return weights
    .map((w, i) => ({ w, name: cellName(i) }))
    .filter(({ w }) => w > 0)
    .map(({ w, name }) => (w >= 0.9995 ? name : `${name}:${Number(w.toFixed(3))}`))
    .join(', ');
}

/** Per-class average weight from per-combo weights (the parser's 1326-combo order). */
export function classWeights(comboWeights: number[], combos: string[]): number[] {
  const sum = new Array(169).fill(0);
  const count = new Array(169).fill(0);
  combos.forEach((c, i) => {
    const k = cellOf(c).index;
    sum[k] += comboWeights[i]!;
    count[k]++;
  });
  return sum.map((s, k) => (count[k] ? s / count[k] : 0));
}

/** The acting player's overall action frequencies at a node (reach-weighted). */
export function nodeFrequencies(node: ActionNode, hands: string[]): number[] {
  const n = hands.length;
  const reach = node.reach[node.player]!;
  const total = reach.reduce((s, w) => s + w, 0) || 1;
  return node.actions.map((_, a) => hands.reduce((s, _h, i) => s + reach[i]! * node.strategy[a * n + i]!, 0) / total);
}
