import { describe, expect, it } from 'vitest';
import { LAPSE_DELAY_MS, newFamily, pickFamily, review } from './srs';

const DAY = 86_400_000;

describe('SM-2 scheduling', () => {
  it('grows intervals 1, 6, then by the ease factor', () => {
    let s = newFamily('f', 0);
    s = review(s, 'best', 0);
    expect(s.intervalDays).toBe(1);
    s = review(s, 'best', s.due);
    expect(s.intervalDays).toBe(6);
    const ease = s.ease;
    s = review(s, 'best', s.due);
    expect(s.intervalDays).toBe(Math.round(6 * ease));
  });

  it('resets on a mistake and brings the family back soon', () => {
    let s = review(newFamily('f', 0), 'best', 0);
    s = review(s, 'blunder', 5);
    expect(s.repetitions).toBe(0);
    expect(s.lapses).toBe(1);
    expect(s.due).toBe(5 + LAPSE_DELAY_MS);
    expect(s.ease).toBeLessThan(2.5);
  });

  it('ignores early successes so a family cannot be farmed', () => {
    let s = review(newFamily('f', 0), 'best', 0);
    const due = s.due;
    for (let i = 0; i < 10; i++) s = review(s, 'best', 1000 + i);
    expect(s.due).toBe(due);
    expect(s.repetitions).toBe(1);
    expect(s.answers).toBe(11);
  });

  it('scales intervals by review intensity without changing the SM-2 state', () => {
    const base = review(review(newFamily('f', 0), 'best', 0), 'best', DAY);
    const first = review(newFamily('f', 0), 'best', 0, 1.5);
    // 1 day × 1.5, rounded.
    expect(first.due).toBe(2 * DAY);
    const light = review(first, 'best', first.due, 1.5);
    expect(base.intervalDays).toBe(6);
    expect(light.intervalDays).toBe(6);
    expect(light.due - first.due).toBe(9 * DAY);
    expect(review(newFamily('f', 0), 'best', 0, 0.6).due).toBe(DAY);
  });

  it('never lets the ease fall below 1.3', () => {
    let s = newFamily('f', 0);
    for (let i = 0; i < 20; i++) s = review(s, 'mistake', i);
    expect(s.ease).toBeCloseTo(1.3);
  });

  it('picks overdue, then unseen, then soonest', () => {
    const states = new Map([
      ['a', { ...newFamily('a', 0), due: 5 * DAY }],
      ['b', { ...newFamily('b', 0), due: 1 * DAY }],
      ['c', { ...newFamily('c', 0), due: 2 * DAY }],
    ]);
    expect(pickFamily(['a', 'b', 'c', 'd'], states, 3 * DAY)).toBe('b');
    expect(pickFamily(['a', 'c', 'd'], states, 0)).toBe('d');
    expect(pickFamily(['a', 'c'], states, 0)).toBe('c');
    expect(pickFamily([], states, 0)).toBeNull();
  });
});
