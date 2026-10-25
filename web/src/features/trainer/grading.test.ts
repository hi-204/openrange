import { describe, expect, it } from 'vitest';
import { categoryFor, DEFAULT_THRESHOLDS, grade } from './grading';

describe('grading', () => {
  it('maps EV loss to categories at the documented thresholds', () => {
    const t = DEFAULT_THRESHOLDS.bb;
    expect(categoryFor(0, t)).toBe('best');
    expect(categoryFor(0.02, t)).toBe('best');
    expect(categoryFor(0.021, t)).toBe('acceptable');
    expect(categoryFor(0.1, t)).toBe('acceptable');
    expect(categoryFor(0.3, t)).toBe('inaccuracy');
    expect(categoryFor(1.0, t)).toBe('mistake');
    expect(categoryFor(1.01, t)).toBe('blunder');
  });

  it('grades by EV loss, not by matching the chart', () => {
    // Pure fold in the chart, but folding loses only 0.05 bb against the best action.
    const g = grade({ ev: [-0.5, -0.45], strategy: [0, 1], chosen: 0, unit: 'bb' });
    expect(g.loss).toBeCloseTo(0.05);
    expect(g.category).toBe('acceptable');
    expect(g.bestActions).toEqual([1]);
  });

  it('never calls the low-frequency half of a mix a mistake', () => {
    // 70/30 mix; the 30% action's EV trails by a little (an unconverged solve).
    const g = grade({ ev: [1.0, 0.95], strategy: [0.7, 0.3], chosen: 1, unit: 'bb' });
    expect(g.category).toBe('best');
    expect(g.lowerFrequency).toBe(true);
    expect(g.unconverged).toBe(false);
    // A 5% action is not part of the mix: graded on EV loss.
    const h = grade({ ev: [1.0, 0.5], strategy: [0.95, 0.05], chosen: 1, unit: 'bb' });
    expect(h.category).toBe('mistake');
    expect(h.inMix).toBe(false);
  });

  it('flags a mix whose EVs disagree as not converged', () => {
    const g = grade({ ev: [1.0, 0.2], strategy: [0.6, 0.4], chosen: 1, unit: 'bb' });
    expect(g.category).toBe('best');
    expect(g.unconverged).toBe(true);
  });

  it('gives sampled references the benefit of the doubt', () => {
    // Loss 0.2 bb, but each EV has SE 0.05: allowance 2·√(0.05²+0.05²) ≈ 0.141.
    const g = grade({ ev: [0, 0.2], evStdError: [0.05, 0.05], strategy: [0, 1], chosen: 0, unit: 'bb' });
    expect(g.loss).toBeCloseTo(0.2);
    expect(g.gradedLoss).toBeCloseTo(0.2 - 2 * Math.hypot(0.05, 0.05));
    expect(g.category).toBe('acceptable');
    // Exact references get no allowance.
    expect(grade({ ev: [0, 0.2], strategy: [0, 1], chosen: 0, unit: 'bb' }).category).toBe('inaccuracy');
  });

  it('grades postflop in % of the pot with the solve accuracy as a floor', () => {
    const g = grade({ ev: [3.0, 2.8], strategy: [1, 0], chosen: 1, unit: 'pctPot', potBb: 10 });
    expect(g.loss).toBeCloseTo(2);
    expect(g.lossBb).toBeCloseTo(0.2);
    expect(g.category).toBe('acceptable');
    const loose = grade({ ev: [3.0, 2.8], strategy: [1, 0], chosen: 1, unit: 'pctPot', potBb: 10, noiseFloorPct: 2.5 });
    expect(loose.category).toBe('best');
    expect(() => grade({ ev: [1, 0], strategy: [1, 0], chosen: 1, unit: 'pctPot' })).toThrow(/pot/);
  });

  it('treats tied best actions alike and skips actions without an EV', () => {
    const g = grade({ ev: [null, 0.5, 0.5], strategy: [0, 0.5, 0.5], chosen: 2, unit: 'bb' });
    expect(g.bestActions).toEqual([1, 2]);
    expect(g.loss).toBe(0);
    expect(() => grade({ ev: [null, 0.5], strategy: [0, 1], chosen: 0, unit: 'bb' })).toThrow(/no EV/);
  });
});
