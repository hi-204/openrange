// Chart comparison (D-091) on the committed chart files.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { cellName } from '../../lib/poker/hands';
import type { ChartFile } from '../../lib/provenance/types';
import { chartDiff, measureOf, rangeShare } from './compare';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(root(`data/charts/${f}`), 'utf8')) as ChartFile;
const names = Array.from({ length: 169 }, (_, i) => cellName(i));

describe('chart comparison', () => {
  const hu = load('pushfold-hu.json');
  const at = (id: string) => ({ doc: hu, chart: hu.charts.find((c) => c.id === id)! });

  it('a chart compared with itself has no differences', () => {
    const d = chartDiff(names, at('sb-shove-10'), at('sb-shove-10'), 'plays');
    expect(d.cells.every((c) => c.d === 0)).toBe(true);
    expect(d.largest).toEqual([]);
  });

  it('differences are A − B of the summed action frequencies, largest first', () => {
    const A = at('sb-shove-5');
    const B = at('sb-shove-20');
    const d = chartDiff(names, A, B, 'aggressive');
    for (const c of d.cells) expect(c.d).toBeCloseTo(measureOf(A.doc, A.chart, c.name, 'aggressive') - measureOf(B.doc, B.chart, c.name, 'aggressive'), 12);
    for (let i = 1; i < d.largest.length; i++) expect(Math.abs(d.largest[i - 1]!.d)).toBeGreaterThanOrEqual(Math.abs(d.largest[i]!.d));
    // Shove-or-fold: "plays" and "aggressive" are the same thing.
    expect(rangeShare(A.doc, A.chart, 'plays')).toBeCloseTo(rangeShare(A.doc, A.chart, 'aggressive'), 12);
  });

  it('works across files (heads-up push/fold against a cash open)', () => {
    const cash = load('cash-6max-100bb.json');
    const d = chartDiff(names, at('sb-shove-20'), { doc: cash, chart: cash.charts.find((c) => c.id === 'first-in-BTN')! }, 'plays');
    expect(d.cells).toHaveLength(169);
  });
});
