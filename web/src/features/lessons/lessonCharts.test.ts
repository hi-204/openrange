// The chart claims in lessons 1.5, 1.6 and Level 3, checked against the generated 100 bb cash charts
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

// Level 3 helpers: defence share, EVs, and EV comparisons with the sampling margin.
const last = (id: string) => chart(id).actions.length - 1;
const defend = (id: string) => 1 - share(id, 0);
const evOf = (id: string, hand: string, k: number) => chart(id).ev![doc.classes.indexOf(hand)]![k]!;
const seOf = (id: string, hand: string, k: number) => chart(id).evStdError![doc.classes.indexOf(hand)]![k] ?? 0;
/** EV(a) − EV(b) is more than two standard errors. */
const clearlyBetter = (id: string, hand: string, a: number, b: number) =>
  evOf(id, hand, a) - evOf(id, hand, b) > 2 * Math.hypot(seOf(id, hand, a), seOf(id, hand, b));
const reached = (id: string) => doc.classes.filter((_, i) => chart(id).reach![i]! >= UNREACHED);
type Tree = { open: number[]; fourBet: number; threeBetInPosition: number; threeBetOutOfPosition: number; squeezePerCaller: number };

describe('Level 3: preflop in depth', () => {
  it('tree facts quoted in the lessons', () => {
    const tree = (doc as unknown as { tree: Tree }).tree;
    expect(tree.open).toEqual([2.5, 2.5, 2.5, 2.5, 3]);
    expect(tree.threeBetInPosition).toBe(3);
    expect(tree.threeBetOutOfPosition).toBe(4);
    expect(tree.fourBet).toBe(2.3);
    expect(tree.squeezePerCaller).toBe(1);
    expect(chart('vs-open-BB-vs-BTN').actions).toEqual(['Fold', 'Call', 'Raise 10']);
    expect(chart('vs-open-BTN-vs-CO').actions).toEqual(['Fold', 'Call', 'Raise 7.5']);
    expect(chart('vs-3bet-UTG-vs-BTN').actions).toEqual(['Fold', 'Call', 'Raise 17.25']);
    expect(chart('vs-3bet-BTN-vs-BB').actions).toEqual(['Fold', 'Call', 'Raise 23']);
    expect(chart('vs-4bet-BB-vs-BTN').actions).toEqual(['Fold', 'Call', 'All-in 100']);
    expect(chart('squeeze-BB-vs-BTN-SB').actions).toEqual(['Fold', 'Call', 'Raise 12.5']);
  });

  it('3.1: the big blind defends far more against the button than against UTG', () => {
    expect(defend('vs-open-BB-vs-BTN')).toBeGreaterThan(0.5);
    expect(defend('vs-open-BB-vs-UTG')).toBeLessThan(defend('vs-open-BB-vs-BTN') / 2);
    const threeBets = doc.classes.filter((h) => at('vs-open-BB-vs-UTG', h)[2]! > 0.5);
    for (const h of threeBets) expect(['AA', 'KK', 'QQ', 'JJ', 'TT', 'AKs', 'AKo'], h).toContain(h);
    expect(share('vs-open-BTN-vs-CO', 1)).toBeLessThan(0.02); // the button almost never calls
    expect(share('vs-open-SB-vs-BTN', 1)).toBeLessThan(0.05);
    expect(share('vs-open-SB-vs-BTN', 2)).toBeGreaterThan(share('vs-open-SB-vs-BTN', 1));
    expect(at('vs-open-BB-vs-BTN', 'K9o')[1]!).toBeGreaterThan(0.9); // worked hand
    expect(at('vs-open-BB-vs-UTG', 'K9o')[0]!).toBeGreaterThan(0.9);
  });

  it('3.2: AA, KK, QQ and A-K 3-bet in every chart facing an open; two range shapes', () => {
    for (const c of doc.charts.filter((x) => x.id.startsWith('vs-open-')))
      for (const h of ['AA', 'KK', 'QQ', 'AKs', 'AKo']) expect(at(c.id, h)[last(c.id)]!, `${c.id} ${h}`).toBeGreaterThan(0.5);
    for (const h of ['A5s', '76s', '65s']) {
      expect(at('vs-open-BTN-vs-CO', h)[2]!, h).toBeGreaterThan(0.5);
      expect(at('vs-open-BB-vs-BTN', h)[1]!, h).toBeGreaterThan(0.5);
    }
    const suitedAces = ['A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s'];
    for (const h of suitedAces) expect(at('vs-open-BB-vs-BTN', h)[1]!, h).toBeGreaterThan(0.5);
    expect(suitedAces.filter((h) => at('vs-open-BTN-vs-CO', h)[2]! > 0.5).length).toBeGreaterThanOrEqual(4);
    expect(at('vs-open-BTN-vs-CO', '65s')[2]!).toBeGreaterThan(0.9); // worked hand
  });

  it('3.3: openers fold less to the smaller in-position 3-bet; the button defends over half', () => {
    for (const s of ['UTG', 'HJ', 'CO']) expect(share(`vs-3bet-${s}-vs-BTN`, 0), s).toBeLessThan(share(`vs-3bet-${s}-vs-BB`, 0));
    expect(share('vs-3bet-BTN-vs-BB', 0)).toBeLessThan(0.5);
    for (const h of ['AA', 'KK']) expect(at('vs-3bet-BTN-vs-BB', h)[2]!, h).toBeGreaterThan(0.5);
    expect(at('vs-3bet-BTN-vs-BB', 'AJo')[1]!).toBeGreaterThan(0.5); // worked hand
  });

  it('3.4: who gets it in', () => {
    const calls = reached('vs-5bet-BTN-vs-BB').filter((h) => at('vs-5bet-BTN-vs-BB', h)[1]! > 0.5);
    expect(calls.sort()).toEqual(['99', 'AA', 'AKo', 'AKs', 'JJ', 'KK', 'QQ', 'TT'].sort());
    for (const h of ['AA', 'KK', 'AKs', 'AKo']) expect(at('vs-4bet-BB-vs-BTN', h)[2]!, h).toBeGreaterThan(0.5);
    const qq = at('vs-4bet-BB-vs-BTN', 'QQ');
    expect(qq[1]! > 0.1 && qq[2]! > 0.1).toBe(true); // QQ mixes
    // A small pair goes all-in, but its all-in and call EVs are within the sampling margin.
    expect(at('vs-4bet-BB-vs-BTN', '44')[2]!).toBeGreaterThan(0.5);
    expect(clearlyBetter('vs-4bet-BB-vs-BTN', '44', 2, 1) || clearlyBetter('vs-4bet-BB-vs-BTN', '44', 1, 2)).toBe(false);
    // "Mostly AA, KK and A-K": their share of the all-in combos.
    const c = chart('vs-4bet-BB-vs-BTN');
    let top = 0;
    let all = 0;
    doc.classes.forEach((n, i) => {
      const w = combos(n) * c.reach![i]! * c.strategy[i]![2]!;
      all += w;
      if (['AA', 'KK', 'AKs', 'AKo'].includes(n)) top += w;
    });
    expect(top / all).toBeGreaterThan(0.6);
    expect(at('vs-5bet-BTN-vs-BB', 'JJ')[1]!).toBeGreaterThan(0.9); // worked hand
    expect(clearlyBetter('vs-5bet-BTN-vs-BB', 'JJ', 1, 0)).toBe(true);
  });

  it('3.5: blind vs blind', () => {
    expect(share('first-in-SB', 1)).toBeGreaterThan(0.3);
    expect(defend('vs-open-BB-vs-SB')).toBeGreaterThan(defend('vs-open-BB-vs-BTN'));
    const ratio = share('vs-open-BB-vs-SB', 2) / share('vs-open-BB-vs-BTN', 2);
    expect(ratio).toBeGreaterThan(1.7);
    expect(ratio).toBeLessThan(2.5);
    expect(at('vs-open-BB-vs-SB', 'K2o')[1]!).toBeGreaterThan(0.5); // worked hand
    expect(at('vs-open-BB-vs-BTN', 'K2o')[0]!).toBeGreaterThan(0.9);
  });

  it('3.6: squeezes', () => {
    for (const h of ['AA', 'KK', 'QQ', 'AKs', 'AKo']) expect(at('vs-open-SB-vs-BTN', h)[1]!, h).toBeLessThan(0.1); // capped caller
    expect(share('squeeze-BB-vs-BTN-SB', 2)).toBeGreaterThan(share('vs-open-BB-vs-BTN', 2));
    expect(share('squeeze-BB-vs-BTN-SB', 1)).toBeLessThan(share('vs-open-BB-vs-BTN', 1) / 2);
    expect(at('squeeze-BB-vs-BTN-SB', 'KQo')[2]!).toBeGreaterThan(0.9); // worked hand
    expect(clearlyBetter('squeeze-BB-vs-BTN-SB', 'KQo', 2, 1)).toBe(true);
  });

  it('3.7: calling vs raising EVs', () => {
    for (const h of ['77', 'KQo', 'KJs']) expect(clearlyBetter('vs-open-BTN-vs-CO', h, 2, 1), h).toBe(true);
    const raisedHands = doc.classes.filter((h) => at('vs-open-BTN-vs-CO', h)[2]! > 0.5);
    const better = raisedHands.filter((h) => evOf('vs-open-BTN-vs-CO', h, 2) > evOf('vs-open-BTN-vs-CO', h, 1));
    expect(better.length / raisedHands.length).toBeGreaterThan(0.8);
    expect(clearlyBetter('vs-open-BB-vs-BTN', 'A5s', 1, 2)).toBe(true);
    expect(evOf('vs-open-BB-vs-BTN', 'K2o', 0)).toBe(-1); // folding the big blind
  });
});
