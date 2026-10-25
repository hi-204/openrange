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
  | { kind: 'practice'; reason: 'outOfBand' };

/** Margin (bb) inside which a verdict is reported as "even". */
export const EVEN_MARGIN_BB = 0.005;

export function verdictOf(evDiff: number, margin = EVEN_MARGIN_BB): Verdict {
  return Math.abs(evDiff) < margin ? 'even' : evDiff > 0 ? 'continue' : 'fold';
}
