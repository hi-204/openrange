// Hand of the day (D-094): one exact heads-up push/fold decision per calendar day, the same all
// day, graded against the exact chart. Pure: the date picks the spot.

import type { ChartFile } from '../../lib/provenance/types';
import { grade, type Grade } from '../trainer/grading';
import { combosIn, mulberry32, randomCombo } from '../trainer/preflop/deal';

/** "2026-11-21" for a local date. */
export const dayKey = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const seedOf = (key: string) => [...key].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7);

export type DailyHand = { day: string; chart: string; title: string; actions: string[]; classIndex: number; handClass: string; combo: string; ev: (number | null)[]; strategy: number[] };

/** The day's spot from the exact heads-up push/fold charts: a chart, then a hand class by combos. */
export function dailyHand(doc: ChartFile, day: string): DailyHand {
  const rnd = mulberry32(seedOf(day));
  const charts = doc.charts.filter((c) => c.ev);
  const chart = charts[Math.floor(rnd() * charts.length)]!;
  const weights = doc.classes.map((name, k) => (chart.ev?.[k] && chart.ev[k]!.every((e) => e !== null) ? combosIn(name) : 0));
  const total = weights.reduce((a: number, b) => a + b, 0);
  let x = rnd() * total;
  let k = weights.findIndex((w) => (x -= w) < 0);
  if (k < 0) k = weights.findLastIndex((w) => w > 0);
  const name = doc.classes[k]!;
  return { day, chart: chart.id, title: chart.title, actions: chart.actions, classIndex: k, handClass: name, combo: randomCombo(name, rnd), ev: chart.ev![k]!, strategy: chart.strategy[k]! };
}

export const gradeDaily = (h: DailyHand, chosen: number): Grade => grade({ ev: h.ev, strategy: h.strategy, chosen, unit: 'bb' });
