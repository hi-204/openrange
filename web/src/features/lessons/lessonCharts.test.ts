// The chart claims in lessons 1.5 and 1.6, checked against the generated 100 bb cash charts
// (docs/LESSON_REVIEW.md cites this test). If the charts are regenerated and a claim stops
// holding, this test fails and the lesson text must change.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChartFile } from '../../lib/provenance/types';
import { UNREACHED } from '../charts/ClassGrid';

const path = fileURLToPath(new URL('../../../public/data/charts/cash-6max-100bb.json', import.meta.url));
const doc = JSON.parse(readFileSync(path, 'utf8')) as ChartFile & { sanityBands: { seat: string; inBand: boolean }[] };
const chart = (id: string) => doc.charts.find((c) => c.id === id)!;
const at = (id: string, hand: string) => chart(id).strategy[doc.classes.indexOf(hand)]!;
const combos = (name: string) => (name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12);
/** Share of all starting hands taking action k, as in ChartEmbed. */
const share = (id: string, k: number) => {
  const c = chart(id);
  let total = 0;
  let s = 0;
  doc.classes.forEach((n, i) => {
    const w = combos(n) * (c.reach ? c.reach[i]! : 1);
    total += w;
    s += w * c.strategy[i]![k]!;
  });
  return s / total;
};
const raised = (id: string) => new Set(doc.classes.filter((_, i) => chart(id).strategy[i]![1]! > 0.5));
const SEATS = ['UTG', 'HJ', 'CO', 'BTN'];

describe('lesson 1.5: open-raise ranges', () => {
  it('the raise share grows from UTG to the button, more than threefold', () => {
    const s = SEATS.map((p) => share(`first-in-${p}`, 1));
    for (let i = 1; i < s.length; i++) expect(s[i]!).toBeGreaterThan(s[i - 1]!);
    expect(s[3]! / s[0]!).toBeGreaterThan(3);
    expect(share('first-in-SB', 1)).toBeLessThan(s[3]!); // SB wide, but not as wide as BTN
    expect(share('first-in-SB', 1)).toBeGreaterThan(s[2]!);
  });

  it('each seat keeps the previous range', () => {
    for (let i = 1; i < SEATS.length; i++) {
      const later = raised(`first-in-${SEATS[i]}`);
      for (const h of raised(`first-in-${SEATS[i - 1]}`)) expect(later.has(h), `${h} from ${SEATS[i - 1]} to ${SEATS[i]}`).toBe(true);
    }
  });

  it('what each seat adds', () => {
    const utg = raised('first-in-UTG');
    for (const h of ['AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', 'AKs', 'AQs', 'AKo', 'AQo', 'KQs', 'KQo', 'QJs']) expect(utg.has(h), h).toBe(true);
    const hj = raised('first-in-HJ');
    for (const h of ['66', '55', '44']) expect(hj.has(h) && !utg.has(h), h).toBe(true);
    const co = raised('first-in-CO');
    for (const h of ['A7s', 'A6s', 'A5s', 'A4s', '76s', '65s', '98s']) expect(co.has(h) && !hj.has(h), h).toBe(true);
    const btn = raised('first-in-BTN');
    const added = [...btn].filter((h) => !co.has(h));
    expect(added.filter((h) => /^[KQ].s$/.test(h)).length).toBeGreaterThanOrEqual(8);
    expect(added.filter((h) => h.endsWith('o')).length).toBeGreaterThanOrEqual(15);
  });

  it('worked hand: A9o folds from UTG and raises from the cutoff and button', () => {
    expect(at('first-in-UTG', 'A9o')[1]!).toBeLessThan(0.1);
    expect(at('first-in-CO', 'A9o')[1]!).toBeGreaterThan(0.9);
    expect(at('first-in-BTN', 'A9o')[1]!).toBeGreaterThan(0.9);
  });

  it('sanity bands: BTN inside, UTG/HJ/CO below', () => {
    const band = (seat: string) => doc.sanityBands.find((b) => b.seat === seat)!;
    expect(band('BTN').inBand).toBe(true);
    for (const s of ['UTG', 'HJ', 'CO']) expect(band(s).inBand).toBe(false);
    expect(doc.provenance.source).toBe('solver_approx');
  });
});

describe('lesson 1.6: reading the grid', () => {
  it('BB vs BTN has mixed cells; T9s mixes call and 3-bet', () => {
    const c = chart('vs-open-BB-vs-BTN');
    expect(c.actions).toEqual(['Fold', 'Call', 'Raise 10']);
    expect(c.strategy.filter((s) => s.some((f) => f > 0.2 && f < 0.8)).length).toBeGreaterThan(5);
    const t9s = at('vs-open-BB-vs-BTN', 'T9s');
    expect(t9s[1]!).toBeGreaterThan(0.2);
    expect(t9s[2]!).toBeGreaterThan(0.2);
  });

  it('BTN facing a 3-bet has unreached hands: the ones it folded first in', () => {
    const c = chart('vs-3bet-BTN-vs-BB');
    const grey = doc.classes.filter((_, i) => c.reach![i]! < UNREACHED);
    expect(grey.length).toBeGreaterThan(20);
    for (const h of grey) expect(at('first-in-BTN', h)[0]!, h).toBeGreaterThan(0.99);
  });
});
