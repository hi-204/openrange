// Compare two charts (D-091): per hand class, how much more often chart A plays (doesn't fold) or
// raises than chart B. Pure, over the chart files.

import type { Chart, ChartFile } from '../../lib/provenance/types';

export type Measure = 'plays' | 'aggressive';

const isFold = (a: string) => /^Fold/.test(a);
const isAggressive = (a: string) => /^(Raise|All-in|Bet)/.test(a);

/** Frequency of the measure for one class of a chart (grid order lookup by name). */
export function measureOf(doc: ChartFile, chart: Chart, name: string, m: Measure): number {
  const k = doc.classes.indexOf(name);
  const row = chart.strategy[k]!;
  return chart.actions.reduce((s, a, i) => s + ((m === 'plays' ? !isFold(a) : isAggressive(a)) ? row[i]! : 0), 0);
}

export type Diff = { name: string; a: number; b: number; d: number };

/** Differences A − B for every class (in `names` order), and the largest ones first. */
export function chartDiff(names: string[], A: { doc: ChartFile; chart: Chart }, B: { doc: ChartFile; chart: Chart }, m: Measure): { cells: Diff[]; largest: Diff[] } {
  const cells = names.map((name) => {
    const a = measureOf(A.doc, A.chart, name, m);
    const b = measureOf(B.doc, B.chart, name, m);
    return { name, a, b, d: a - b };
  });
  return { cells, largest: [...cells].filter((c) => Math.abs(c.d) >= 0.005).sort((x, y) => Math.abs(y.d) - Math.abs(x.d)).slice(0, 12) };
}

/** Share of all 1326 combos the measure covers (combo-weighted). */
export function rangeShare(doc: ChartFile, chart: Chart, m: Measure): number {
  let w = 0;
  let s = 0;
  for (const name of doc.classes) {
    const n = name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12;
    w += n;
    s += n * measureOf(doc, chart, name, m);
  }
  return s / w;
}
