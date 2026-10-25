// Claims for postflop decisions (D-053), built from a solved node and exact equities.

import type { Grade } from '../grading';
import { price, rangeSummary, remainingStack, texture, type ComboEq } from '../postflop/features';
import { ADVANTAGE_MARGIN, NUT_EQUITY, STRONG_EQUITY, verdictOf, WEAK_EQUITY, type Claim } from './claims';
import { preflopClaims } from './preflop';

export type PostflopContext = {
  actions: string[];
  /** EV of each action for the hero's hand (bb). */
  ev: (number | null)[];
  strategy: number[];
  chosen: number;
  grade: Grade | null;
  /** Hero's reach here as a share of its starting weight. */
  reachShare: number;
  offPath: boolean;
  street: string;
  /** Board in the solver's frame. */
  board: string[];
  pot: number;
  committed: [number, number];
  heroSeat: 0 | 1;
  startStack: number;
  startPot: number;
  exploitabilityPct: number;
  /** Hero combo in the solver's frame. */
  heroCombo: string;
  /** Hero combo's equity against the opponent's range at this node. */
  heroEquity: number | null;
  /** Range vs range at this node (per combo, weights = reach). */
  heroRange: ComboEq[] | null;
  villainRange: ComboEq[] | null;
  /** Share of the hero's range (by reach) that doesn't fold here; null when not facing a bet. */
  heroDefend: number | null;
};

/**
 * River identity tolerance (D-057): about 6× the worst error measured on the solved test spots
 * (8.1e-5 bb; f32 strategy storage).
 */
export const EXACT_TOLERANCE_POSTFLOP_BB = 5e-4;

const blocks = (combo: string, hero: string) => hero.includes(combo.slice(0, 2)) || hero.includes(combo.slice(2, 4));

export function postflopClaims(ctx: PostflopContext): Claim[] {
  const claims: Claim[] = [];
  if (ctx.offPath) claims.push({ kind: 'offPath', reachShare: ctx.reachShare });
  // Shared kinds (verdict, EV ranking, mix) as for preflop; no sampling allowance postflop.
  const shared = preflopClaims({ actions: ctx.actions, ev: ctx.ev, evStdError: null, strategy: ctx.strategy, chosen: ctx.chosen, grade: ctx.grade });
  claims.push(...shared.filter((c) => c.kind !== 'practice'));
  claims.push({ kind: 'accuracy', exploitabilityPct: ctx.exploitabilityPct });

  const pr = price(ctx.pot, ctx.committed, ctx.heroSeat);
  const fold = ctx.actions.indexOf('Fold');
  const call = ctx.actions.indexOf('Call');
  if (pr.toCall > 0 && fold >= 0 && call >= 0 && ctx.heroEquity !== null && ctx.ev[fold] != null && ctx.ev[call] != null) {
    const evDiff = ctx.ev[call]! - ctx.ev[fold]!;
    claims.push({
      kind: 'potOdds',
      toCall: pr.toCall,
      potAfterCall: pr.potAfterCall,
      required: pr.required,
      equity: ctx.heroEquity,
      evDiff,
      verdict: verdictOf(evDiff),
      rawVerdict: ctx.heroEquity >= pr.required ? 'continue' : 'fold',
      exact: ctx.street === 'River',
    });
  }
  if (pr.toCall > 0 && ctx.heroDefend !== null) claims.push({ kind: 'mdf', mdf: pr.mdf, defend: ctx.heroDefend });

  const stack = remainingStack(ctx.startStack, ctx.startPot, ctx.pot, ctx.committed, ctx.heroSeat);
  claims.push({ kind: 'spr', spr: stack / ctx.pot, stack, pot: ctx.pot });
  claims.push({ kind: 'texture', board: ctx.board, ...texture(ctx.board) });

  if (ctx.heroRange && ctx.villainRange) {
    const h = rangeSummary(ctx.heroRange, NUT_EQUITY);
    const v = rangeSummary(ctx.villainRange, NUT_EQUITY);
    claims.push({
      kind: 'advantage',
      heroEquity: h.equity,
      heroNuts: h.nutShare,
      villainNuts: v.nutShare,
      nut: NUT_EQUITY,
      lead: h.equity > 0.5 + ADVANTAGE_MARGIN ? 'hero' : h.equity < 0.5 - ADVANTAGE_MARGIN ? 'villain' : 'even',
    });
    let [strong, strongBlocked, weak, weakBlocked] = [0, 0, 0, 0];
    for (const c of ctx.villainRange) {
      if (c.equity >= STRONG_EQUITY) {
        strong += c.weight;
        if (blocks(c.combo, ctx.heroCombo)) strongBlocked += c.weight;
      } else if (c.equity <= WEAK_EQUITY) {
        weak += c.weight;
        if (blocks(c.combo, ctx.heroCombo)) weakBlocked += c.weight;
      }
    }
    if (strong > 0 && weak > 0) claims.push({ kind: 'blockers', strongBlocked: strongBlocked / strong, weakBlocked: weakBlocked / weak });
  }
  return claims;
}
