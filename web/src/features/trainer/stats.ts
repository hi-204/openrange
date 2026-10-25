// Statistics with honest uncertainty (D-055).

import type { Category, Unit } from './grading';

export const MIN_SAMPLE = 30;
const Z = 1.96;

export type Interval = { low: number; high: number };

/** 95% Wilson score interval for k successes out of n. */
export function wilson(k: number, n: number): Interval {
  if (n === 0) return { low: 0, high: 1 };
  const p = k / n;
  const d = 1 + (Z * Z) / n;
  const centre = (p + (Z * Z) / (2 * n)) / d;
  const half = (Z * Math.sqrt((p * (1 - p)) / n + (Z * Z) / (4 * n * n))) / d;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

/** Mean with a 95% normal interval (sample standard deviation); needs n ≥ 2. */
export function meanInterval(xs: number[]): { mean: number; interval: Interval | null } {
  const n = xs.length;
  if (n === 0) return { mean: NaN, interval: null };
  const mean = xs.reduce((s, x) => s + x, 0) / n;
  if (n < 2) return { mean, interval: null };
  const sd = Math.sqrt(xs.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  const half = (Z * sd) / Math.sqrt(n);
  return { mean, interval: { low: mean - half, high: mean + half } };
}

export type GradedAnswer = { unit: Unit; loss: number; category: Category; groups: Record<string, string> };

export type GroupStats = {
  dimension: string;
  value: string;
  unit: Unit;
  n: number;
  enough: boolean;
  meanLoss: number;
  lossInterval: Interval | null;
  errorRate: number;
  errorInterval: Interval;
  /** Mean-loss interval lies entirely above that of all other answers in the same unit. */
  leak: boolean;
};

const isError = (c: Category) => c === 'mistake' || c === 'blunder';

/** Stats for every (dimension, value) group, per unit. Units are never mixed. */
export function groupStats(answers: GradedAnswer[], dimensions: string[]): GroupStats[] {
  const out: GroupStats[] = [];
  for (const unit of ['bb', 'pctPot'] as const) {
    const inUnit = answers.filter((a) => a.unit === unit);
    for (const dim of dimensions) {
      const values = [...new Set(inUnit.map((a) => a.groups[dim]).filter((v): v is string => v !== undefined))].sort();
      for (const value of values) {
        const inside = inUnit.filter((a) => a.groups[dim] === value);
        const rest = inUnit.filter((a) => a.groups[dim] !== value);
        const n = inside.length;
        const errors = inside.filter((a) => isError(a.category)).length;
        const m = meanInterval(inside.map((a) => a.loss));
        const r = meanInterval(rest.map((a) => a.loss));
        const enough = n >= MIN_SAMPLE;
        out.push({
          dimension: dim,
          value,
          unit,
          n,
          enough,
          meanLoss: m.mean,
          lossInterval: m.interval,
          errorRate: n ? errors / n : 0,
          errorInterval: wilson(errors, n),
          leak: enough && rest.length >= MIN_SAMPLE && !!m.interval && !!r.interval && m.interval.low > r.interval.high,
        });
      }
    }
  }
  return out;
}
