import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChartFile } from '../../lib/provenance/types';
import { dailyHand, dayKey, gradeDaily } from './daily';

const doc = JSON.parse(readFileSync(fileURLToPath(new URL('../../../../data/charts/pushfold-hu.json', import.meta.url)), 'utf8')) as ChartFile;

describe('hand of the day', () => {
  it('is the same all day and changes between days', () => {
    const a = dailyHand(doc, '2026-11-21');
    expect(dailyHand(doc, '2026-11-21')).toEqual(a);
    const week = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25'].map((d) => dailyHand(doc, d));
    expect(new Set(week.map((h) => `${h.chart}|${h.handClass}`)).size).toBeGreaterThan(1);
    expect(dayKey(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
  });

  it('reads the hand from the exact chart and grades by its EVs', () => {
    const h = dailyHand(doc, '2026-11-21');
    const chart = doc.charts.find((c) => c.id === h.chart)!;
    expect(h.ev).toEqual(chart.ev![h.classIndex]);
    expect(h.combo.length).toBe(4);
    const best = h.ev.indexOf(Math.max(...(h.ev as number[])));
    expect(gradeDaily(h, best).lossBb).toBe(0);
    expect(gradeDaily(h, 1 - best).lossBb).toBeCloseTo(Math.abs(h.ev[0]! - h.ev[1]!), 12);
  });
});
