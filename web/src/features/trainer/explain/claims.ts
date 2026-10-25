// Explanations are lists of typed claims computed from the decision's numbers (D-053). Text is
// rendered from a claim's fields only (render.ts), and every claim kind has a predicate that
// recomputes it from the raw data (check.ts), so tests can prove no sentence contradicts the
// numbers.

import type { Category, Unit } from '../grading';

/** "call" / "fold" verdict of a simple equity-vs-price comparison, or "even" when too close. */
export type Verdict = 'continue' | 'fold' | 'even';

export type Claim =
  /** How the answer was graded. */
  | {
      kind: 'verdict';
      category: Category;
      chosen: string;
      best: string[];
      /** Loss in the grading unit, as measured and after the sampling allowance. */
      loss: number;
      gradedLoss: number;
      unit: Unit;
      chosenFrequency: number;
      lowerFrequency: boolean;
      topAction: string;
      unconverged: boolean;
    }
  /** EV of every action, best first. `stdError` for sampled references. */
  | { kind: 'evRank'; unit: 'bb'; order: { action: string; ev: number; stdError: number | null }[] }
  /** The reference's mix for this hand. */
  | { kind: 'mix'; frequencies: { action: string; p: number }[] }
  /**
   * All-in call against a single opponent (chip EV): price vs equity. `exact` when the identity
   * EV(call) − EV(fold) = equity · potAfterCall − toCall holds for the reference's numbers.
   */
  | {
      kind: 'callMath';
      toCall: number;
      potAfterCall: number;
      required: number;
      equity: number;
      evDiff: number;
      verdict: Verdict;
      exact: boolean;
    }
  /** Heads-up shove (chip EV): fold equity and equity when called, combined into the EV. */
  | {
      kind: 'shoveMath';
      stack: number;
      foldShare: number;
      equityWhenCalled: number | null;
      evShove: number;
      evFold: number;
      /** EV of shoving rebuilt from the parts (per combo, averaged); equals evShove for exact data. */
      rebuilt: number;
    }
  /** The reference is sampled: EVs carry standard errors. */
  | { kind: 'sampled'; largestStdError: number }
  /** Practice spot: shown for reference, not graded. */
  | { kind: 'practice'; reason: 'outOfBand' }
  /** Postflop: how accurately the reference was solved. */
  | { kind: 'accuracy'; exploitabilityPct: number }
  /** Postflop: the hero reached this node with an action the solution doesn't take with this hand. */
  | { kind: 'offPath'; reachShare: number }
  /**
   * Postflop, facing a bet: price vs raw equity against the opponent's range at this node.
   * `exact` on the river, where EV(call) − EV(fold) = equity · potAfterCall − toCall.
   */
  | {
      kind: 'potOdds';
      toCall: number;
      potAfterCall: number;
      required: number;
      equity: number;
      evDiff: number;
      verdict: Verdict;
      rawVerdict: 'continue' | 'fold';
      exact: boolean;
    }
  /** Postflop, facing a bet: minimum defence frequency vs how often the solution continues. */
  | { kind: 'mdf'; mdf: number; defend: number }
  | { kind: 'spr'; spr: number; stack: number; pot: number }
  | { kind: 'texture'; board: string[]; paired: boolean; maxSuit: number; straightPossible: boolean; highCard: string }
  /** Range vs range at this node: average equity and share of very strong hands (≥ `nut`). */
  | { kind: 'advantage'; heroEquity: number; heroNuts: number; villainNuts: number; nut: number; lead: 'hero' | 'villain' | 'even' }
  /** Share of the opponent's strong (≥ 70%) and weak (≤ 30%) hands, by weight, that the hero's cards remove. */
  | { kind: 'blockers'; strongBlocked: number; weakBlocked: number };

/** Range advantage is called "even" within this margin of 50%. */
export const ADVANTAGE_MARGIN = 0.02;
export const NUT_EQUITY = 0.85;
export const STRONG_EQUITY = 0.7;
export const WEAK_EQUITY = 0.3;

/** Margin (bb) inside which a verdict is reported as "even". */
export const EVEN_MARGIN_BB = 0.005;

export function verdictOf(evDiff: number, margin = EVEN_MARGIN_BB): Verdict {
  return Math.abs(evDiff) < margin ? 'even' : evDiff > 0 ? 'continue' : 'fold';
}
