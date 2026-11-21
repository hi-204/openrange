import { describe, expect, it } from 'vitest';
import type { MathAttempt } from '../trainer/store';
import { calibration, MIN_ESTIMATES } from './calibration';

const at = (estimate: number, exact: number): MathAttempt => ({ at: 0, drill: 'lab.estimate', correct: true, given: '', answer: '', estimate, exact });

describe('equity-estimate calibration', () => {
  it('says nothing below the minimum sample', () => {
    expect(calibration(Array.from({ length: MIN_ESTIMATES - 1 }, () => at(0.5, 0.4)))).toBeNull();
  });

  it('measures the mean absolute and signed error', () => {
    // Half the estimates 10 points high, half 10 points low: no bias, average error 10 points.
    const xs = Array.from({ length: 40 }, (_, i) => at(0.5 + (i % 2 ? 0.1 : -0.1), 0.5));
    const c = calibration(xs)!;
    expect(c.n).toBe(40);
    expect(c.mae).toBeCloseTo(0.1, 12);
    expect(c.bias).toBeCloseTo(0, 12);
    expect(c.clear).toBe(false);
  });

  it('reports a clear bias only when it exceeds two standard errors', () => {
    // Every estimate 5 to 7 points high: a clear upward bias.
    const high = Array.from({ length: 30 }, (_, i) => at(0.45 + 0.05 + (i % 3) * 0.01, 0.45));
    const c = calibration(high)!;
    expect(c.bias).toBeGreaterThan(0.05);
    expect(c.clear).toBe(true);
    // Ignores math attempts without an estimate.
    expect(calibration([...high, { at: 0, drill: 'potodds', correct: true, given: '', answer: '' }])!.n).toBe(30);
  });
});
