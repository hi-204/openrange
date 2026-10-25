import { describe, expect, it } from 'vitest';
import type { Category } from './grading';
import { groupStats, meanInterval, MIN_SAMPLE, wilson, type GradedAnswer } from './stats';

describe('stats', () => {
  it('computes Wilson intervals', () => {
    // Textbook value: 8 of 10 → about [0.490, 0.943].
    const w = wilson(8, 10);
    expect(w.low).toBeCloseTo(0.4902, 3);
    expect(w.high).toBeCloseTo(0.9433, 3);
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
    expect(wilson(0, 50).low).toBe(0);
  });

  it('computes a mean interval only from two answers up', () => {
    expect(meanInterval([1]).interval).toBeNull();
    const m = meanInterval([1, 2, 3, 4]);
    expect(m.mean).toBe(2.5);
    const half = (1.96 * Math.sqrt(5 / 3)) / 2;
    expect(m.interval!.low).toBeCloseTo(2.5 - half);
  });

  const answers = (n: number, loss: number, category: Category, pos: string): GradedAnswer[] =>
    Array.from({ length: n }, (_, i) => ({ unit: 'bb', loss: loss + (i % 3) * 0.01, category, groups: { position: pos } }));

  it('says not enough data below the minimum sample and never flags it as a leak', () => {
    const s = groupStats([...answers(10, 2, 'blunder', 'SB'), ...answers(100, 0, 'best', 'BB')], ['position']);
    const sb = s.find((g) => g.value === 'SB')!;
    expect(sb.n).toBe(10);
    expect(sb.enough).toBe(false);
    expect(sb.leak).toBe(false);
  });

  it('flags a leak only when the intervals separate', () => {
    const s = groupStats([...answers(MIN_SAMPLE, 0.5, 'mistake', 'SB'), ...answers(100, 0.01, 'best', 'BB')], ['position']);
    expect(s.find((g) => g.value === 'SB')!.leak).toBe(true);
    expect(s.find((g) => g.value === 'BB')!.leak).toBe(false);
    // Same losses everywhere: no leak anywhere.
    const flat = groupStats([...answers(50, 0.1, 'acceptable', 'SB'), ...answers(50, 0.1, 'acceptable', 'BB')], ['position']);
    expect(flat.some((g) => g.leak)).toBe(false);
  });

  it('never mixes bb and % of pot', () => {
    const mixed: GradedAnswer[] = [
      ...answers(40, 0.1, 'acceptable', 'BTN'),
      ...Array.from({ length: 40 }, () => ({ unit: 'pctPot' as const, loss: 5, category: 'inaccuracy' as const, groups: { position: 'BTN' } })),
    ];
    const s = groupStats(mixed, ['position']);
    expect(s).toHaveLength(2);
    expect(s.find((g) => g.unit === 'bb')!.meanLoss).toBeCloseTo(0.11, 1);
    expect(s.find((g) => g.unit === 'pctPot')!.meanLoss).toBe(5);
  });
});
