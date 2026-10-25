import { describe, expect, it } from 'vitest';
import { cellName } from '../../../lib/poker/hands';
import { bestAnswer, combosOfClass, scoreRange } from './rangeScore';

const NAMES = Array.from({ length: 169 }, (_, i) => cellName(i));
const target = (play: Record<string, number>) => NAMES.map((n) => play[n] ?? 0);

describe('range-building score', () => {
  it('a perfect answer has no error; an empty one misses the whole range', () => {
    const t = target({ AA: 1, AKs: 1, AKo: 1 });
    expect(scoreRange(t, bestAnswer(t)).error).toBe(0);
    const empty = scoreRange(t, NAMES.map(() => false));
    expect(empty.error).toBe(22);
    expect(empty.chartCombos).toBe(22);
  });

  it('weights by combos: missing AKo costs three times missing AKs', () => {
    const t = target({ AKs: 1, AKo: 1 });
    const noAko = scoreRange(t, NAMES.map((n) => n === 'AKs'));
    const noAks = scoreRange(t, NAMES.map((n) => n === 'AKo'));
    expect(noAko.missed).toBe(12);
    expect(noAks.missed).toBe(4);
    expect(noAko.missedHands).toEqual(['AKo']);
  });

  it('mixed cells count by frequency, and extra hands are penalised', () => {
    const t = target({ QQ: 0.5, '22': 1 });
    const s = scoreRange(t, NAMES.map((n) => n === 'QQ' || n === '72o'));
    expect(s.hit).toBe(3);
    expect(s.extra).toBe(3 + 12);
    expect(s.missed).toBe(6);
    expect(s.extraHands).toEqual(['72o']); // QQ is played half the time, so it isn't listed as a mistake
    expect(combosOfClass('72o') + combosOfClass('72s') + combosOfClass('77')).toBe(22);
  });

  it('the best answer reaches the smallest possible error, and no flip beats it', () => {
    const t = NAMES.map((_, i) => ((i * 37) % 100) / 100);
    const best = scoreRange(t, bestAnswer(t));
    expect(best.error).toBeCloseTo(best.bestError, 9);
    for (let i = 0; i < 169; i++) {
      const flipped = bestAnswer(t).map((v, j) => (j === i ? !v : v));
      expect(scoreRange(t, flipped).error).toBeGreaterThanOrEqual(best.error - 1e-9);
    }
  });
});
