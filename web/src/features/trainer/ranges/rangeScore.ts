// Range-building drill scoring (D-075). The target is a chart's frequency for one action per
// hand class; the answer is a set of classes. Everything is weighted by combos (pairs 6,
// suited 4, offsuit 12), so a missed offsuit hand counts three times a suited one.

import { cellName } from '../../../lib/poker/hands';

export const combosOfClass = (name: string) => (name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12);
const NAMES = Array.from({ length: 169 }, (_, i) => cellName(i));

export type RangeScore = {
  /** Combos of the chart's range that the answer includes (mixed cells count by frequency). */
  hit: number;
  /** Combos of the chart's range left out. */
  missed: number;
  /** Combos included that the chart doesn't play this way. */
  extra: number;
  /** Combos the answer gets wrong: missed + extra. */
  error: number;
  /** The smallest error any answer can have (mixed cells always cost something). */
  bestError: number;
  /** Combos in the chart's range (weighted by frequency). */
  chartCombos: number;
  /** Biggest differences first: classes the chart plays at least half the time but the answer left out, and the reverse. */
  missedHands: string[];
  extraHands: string[];
};

/** `target[i]` is the chart's frequency for class i (grid order); `picked[i]` the answer. */
export function scoreRange(target: number[], picked: boolean[]): RangeScore {
  let hit = 0;
  let missed = 0;
  let extra = 0;
  let bestError = 0;
  const miss: { n: string; w: number }[] = [];
  const add: { n: string; w: number }[] = [];
  NAMES.forEach((n, i) => {
    const c = combosOfClass(n);
    const f = target[i]!;
    bestError += c * Math.min(f, 1 - f);
    if (picked[i]) {
      hit += c * f;
      extra += c * (1 - f);
      if (f < 0.5) add.push({ n, w: c * (1 - f) });
    } else {
      missed += c * f;
      if (f >= 0.5) miss.push({ n, w: c * f });
    }
  });
  const byWeight = (a: { w: number }, b: { w: number }) => b.w - a.w;
  return { hit, missed, extra, error: missed + extra, bestError, chartCombos: hit + missed, missedHands: miss.sort(byWeight).map((x) => x.n), extraHands: add.sort(byWeight).map((x) => x.n) };
}

/** The answer with the smallest error: every class the chart plays at least half the time. */
export const bestAnswer = (target: number[]) => target.map((f) => f >= 0.5);

export type EvDifference = {
  /** Average EV given up per hand you're dealt at this decision, in bb. */
  perHand: number;
  /** Classes costing the most, biggest first (combo- and reach-weighted loss in bb). */
  worst: { name: string; loss: number }[];
};

/**
 * EV given up by an answer on a two-action chart (fold vs the shove, call or raise, D-089): each
 * class plays the action the answer gives it; its loss is the better action's EV minus that,
 * weighted by combos × how often the player holds it at this decision. Null if the chart has no
 * EVs for some class.
 */
export function evDifference(classes: string[], ev: (number | null)[][] | undefined, reach: number[] | undefined, picked: boolean[]): EvDifference | null {
  if (!ev) return null;
  let total = 0;
  let weight = 0;
  const worst: { name: string; loss: number }[] = [];
  for (let i = 0; i < NAMES.length; i++) {
    const n = NAMES[i]!;
    const j = classes.indexOf(n);
    const row = ev[j];
    if (!row) return null;
    const k = row.length - 1;
    const [fold, act] = [row[0], row[k]];
    if (fold == null || act == null) continue;
    const w = combosOfClass(n) * (reach ? reach[j]! : 1);
    const loss = Math.max(fold, act) - (picked[i] ? act : fold);
    total += w * loss;
    weight += w;
    if (loss > 1e-9) worst.push({ name: n, loss: w * loss });
  }
  if (weight <= 0) return null;
  return { perHand: total / weight, worst: worst.sort((a, b) => b.loss - a.loss) };
}
