// Calibration of equity estimates (D-087): average error and bias, with a bias only claimed when
// it is clearly bigger than its sampling error.

import type { MathAttempt } from '../trainer/store';

/** Fewer estimates than this: no numbers (they'd mostly be noise). */
export const MIN_ESTIMATES = 20;

export type Calibration = { n: number; mae: number; bias: number; biasStdError: number; clear: boolean };

/** Mean absolute error and mean signed error (estimate − exact) over the estimates, in shares. */
export function calibration(attempts: MathAttempt[]): Calibration | null {
  const xs = attempts.filter((a) => typeof a.estimate === 'number' && typeof a.exact === 'number').map((a) => a.estimate! - a.exact!);
  const n = xs.length;
  if (n < MIN_ESTIMATES) return null;
  const bias = xs.reduce((s, x) => s + x, 0) / n;
  const mae = xs.reduce((s, x) => s + Math.abs(x), 0) / n;
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - bias) ** 2, 0) / (n - 1));
  const biasStdError = sd / Math.sqrt(n);
  // A bias is "clear" when it is more than two standard errors from zero (about 95%).
  return { n, mae, bias, biasStdError, clear: Math.abs(bias) > 2 * biasStdError };
}

export const estimateCount = (attempts: MathAttempt[]) => attempts.filter((a) => typeof a.estimate === 'number' && typeof a.exact === 'number').length;
