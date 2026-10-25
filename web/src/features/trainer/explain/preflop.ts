// Claims for preflop decisions (D-053).

import type { Grade } from '../grading';
import { verdictOf, type Claim } from './claims';

/** Exact matchup rows for the hero's combos (solver-wasm `preflopMatchup`). */
export type MatchupRow = { combo: string; share: number; equity: number | null };

export type PreflopContext = {
  actions: string[];
  ev: (number | null)[];
  evStdError: (number | null)[] | null;
  strategy: number[];
  chosen: number;
  grade: Grade | null;
  /** Heads-up push/fold (chip EV, blinds 0.5/1, no ante): who decides and the exact matchup. */
  headsUp?: { stack: number; role: 'shove' | 'call'; matchup: MatchupRow[] };
};

/** Identity tolerance: chart EVs are stored to 4 decimals. */
export const EXACT_TOLERANCE_BB = 0.002;

const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

export function preflopClaims(ctx: PreflopContext): Claim[] {
  const claims: Claim[] = [];
  const { actions, ev, evStdError: se, strategy, grade } = ctx;
  if (!grade) claims.push({ kind: 'practice', reason: 'outOfBand' });
  else
    claims.push({
      kind: 'verdict',
      category: grade.category,
      chosen: actions[ctx.chosen]!,
      best: grade.bestActions.map((i) => actions[i]!),
      loss: grade.loss,
      gradedLoss: grade.gradedLoss,
      unit: grade.unit,
      chosenFrequency: grade.chosenFrequency,
      lowerFrequency: grade.lowerFrequency,
      topAction: actions[grade.topAction]!,
      unconverged: grade.unconverged,
    });

  const order = actions
    .map((action, i) => ({ action, ev: ev[i], stdError: se?.[i] ?? null }))
    .filter((r): r is { action: string; ev: number; stdError: number | null } => r.ev !== null && r.ev !== undefined)
    .sort((a, b) => b.ev - a.ev);
  claims.push({ kind: 'evRank', unit: 'bb', order });

  if (Math.max(...strategy) < 0.999) claims.push({ kind: 'mix', frequencies: actions.map((action, i) => ({ action, p: strategy[i]! })) });
  if (se) claims.push({ kind: 'sampled', largestStdError: Math.max(0, ...se.map((x) => x ?? 0)) });

  const hu = ctx.headsUp;
  if (hu) {
    const s = hu.stack;
    const rows = hu.matchup;
    if (hu.role === 'call') {
      const eqs = rows.map((r) => r.equity).filter((e): e is number => e !== null);
      const [fold, call] = [ev[0], ev[1]];
      if (eqs.length === rows.length && fold != null && call != null) {
        const equity = mean(eqs);
        const toCall = s - 1;
        const potAfterCall = 2 * s;
        const evDiff = call - fold;
        claims.push({
          kind: 'callMath',
          toCall,
          potAfterCall,
          required: toCall / potAfterCall,
          equity,
          evDiff,
          verdict: verdictOf(evDiff),
          exact: Math.abs(evDiff - (equity * potAfterCall - toCall)) <= EXACT_TOLERANCE_BB,
        });
      }
    } else {
      const [fold, shove] = [ev[0], ev[1]];
      if (fold != null && shove != null) {
        // Per combo: BB folds → +1 bb; BB calls → 2S·equity − S. Averaged over the class.
        const rebuilt = mean(rows.map((r) => (1 - r.share) * 1 + r.share * ((r.equity ?? 0) * 2 * s - s)));
        const called = rows.reduce((t, r) => t + r.share, 0);
        claims.push({
          kind: 'shoveMath',
          stack: s,
          foldShare: 1 - mean(rows.map((r) => r.share)),
          equityWhenCalled: called > 0 ? rows.reduce((t, r) => t + r.share * (r.equity ?? 0), 0) / called : null,
          evShove: shove,
          evFold: fold,
          rebuilt,
        });
      }
    }
  }
  return claims;
}
