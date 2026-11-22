import { describe, expect, it } from 'vitest';
import { cellName } from '../../../lib/poker/hands';
import { bestAnswer, combosOfClass, evDifference, scoreRange } from './rangeScore';

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

describe('EV difference of a range answer', () => {
  const names = Array.from({ length: 169 }, (_, i) => cellName(i));
  it('is zero for the best answer and adds up the losses of wrong classes', () => {
    // Synthetic chart: raising is worth +1 bb for pairs and −1 bb for everything else; folding 0.
    const ev = names.map((n) => [0, n.length === 2 ? 1 : -1]);
    const best = names.map((n) => n.length === 2);
    expect(evDifference(names, ev, undefined, best)!.perHand).toBeCloseTo(0, 12);
    // Add AKs (4 combos, loses 1 bb each) and drop AA (6 combos, gives up 1 bb each).
    const answer = names.map((n) => (n === 'AKs' ? true : n === 'AA' ? false : n.length === 2));
    const d = evDifference(names, ev, undefined, answer)!;
    expect(d.perHand).toBeCloseTo((4 * 1 + 6 * 1) / 1326, 12);
    expect(d.worst.map((x) => x.name)).toEqual(['AA', 'AKs']);
  });

  it('weights each class by how often it reaches the decision', () => {
    const ev = names.map(() => [0, 1]);
    const reach = names.map((n) => (n === 'AA' ? 1 : 0));
    const none = names.map(() => false);
    // Only AA reaches the decision; leaving it out loses 1 bb per hand dealt here.
    expect(evDifference(names, ev, reach, none)!.perHand).toBeCloseTo(1, 12);
  });
});
