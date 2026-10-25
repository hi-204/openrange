// EV-loss grading (D-052). Pure functions: the drills pass in the reference's numbers for the
// dealt hand and get back a category plus everything the answer panel shows.

export const CATEGORIES = ['best', 'acceptable', 'inaccuracy', 'mistake', 'blunder'] as const;
export type Category = (typeof CATEGORIES)[number];

/** Upper bounds of Best, Acceptable, Inaccuracy and Mistake; anything above is a Blunder. */
export type Thresholds = [number, number, number, number];

export type Unit = 'bb' | 'pctPot';

export const DEFAULT_THRESHOLDS: Record<Unit, Thresholds> = {
  bb: [0.02, 0.1, 0.3, 1.0],
  pctPot: [1, 3, 8, 20],
};

/** An action the reference plays at least this often counts as part of its mix. */
export const MIX_THRESHOLD = 0.1;

export type DecisionInput = {
  /** EV of each action for this hand (bb), null where unavailable. */
  ev: (number | null)[];
  /** Standard error of each EV for sampled references; omitted or null for exact ones. */
  evStdError?: (number | null)[] | null;
  /** The reference's probability of each action for this hand. */
  strategy: number[];
  chosen: number;
  unit: Unit;
  /** Pot at the decision in bb (needed for unit 'pctPot'). */
  potBb?: number;
  /** Postflop: the solve's exploitability in % of pot; raises the Best threshold to at least this. */
  noiseFloorPct?: number;
  thresholds?: Thresholds;
};

export type Grade = {
  category: Category;
  /** EV loss in the grading unit, as measured. */
  loss: number;
  /** The loss after the sampling allowance (equals `loss` for exact references). */
  gradedLoss: number;
  /** EV loss in bb (same as `loss` preflop). */
  lossBb: number;
  /** Indices of the actions with the highest EV. */
  bestActions: number[];
  /** Index of the reference's most frequent action. */
  topAction: number;
  chosenFrequency: number;
  /** Chosen action is in the reference's mix (≥ MIX_THRESHOLD). */
  inMix: boolean;
  /** In the mix but not the most frequent action. */
  lowerFrequency: boolean;
  /** In the mix, yet its EV trails by more than the Inaccuracy threshold: not converged here. */
  unconverged: boolean;
  unit: Unit;
};

export function categoryFor(loss: number, t: Thresholds): Category {
  for (let i = 0; i < t.length; i++) if (loss <= t[i]!) return CATEGORIES[i]!;
  return 'blunder';
}

export function grade(input: DecisionInput): Grade {
  const { ev, strategy, chosen, unit } = input;
  if (chosen < 0 || chosen >= strategy.length) throw new Error(`no action ${chosen}`);
  const evChosen = ev[chosen];
  if (evChosen === null || evChosen === undefined) throw new Error('the chosen action has no EV in the reference');
  let bestEv = -Infinity;
  ev.forEach((e) => {
    if (e !== null && e > bestEv) bestEv = e;
  });
  // Ties within a rounding hair count as equally good.
  const bestActions = ev.flatMap((e, i) => (e !== null && bestEv - e <= 1e-9 ? [i] : []));
  const lossBb = Math.max(0, bestEv - evChosen);
  const scale = unit === 'pctPot' ? 100 / requirePot(input.potBb) : 1;
  const loss = lossBb * scale;

  // Sampling allowance against the best action with the smallest allowance-adjusted gap.
  let gradedLoss = loss;
  const se = input.evStdError;
  if (se) {
    const seChosen = se[chosen] ?? 0;
    gradedLoss = Math.min(
      ...bestActions.map((b) => Math.max(0, loss - 2 * Math.hypot(se[b] ?? 0, seChosen) * scale)),
    );
  }

  const base = input.thresholds ?? DEFAULT_THRESHOLDS[unit];
  const floor = unit === 'pctPot' ? (input.noiseFloorPct ?? 0) : 0;
  const t: Thresholds = [Math.max(base[0], floor), Math.max(base[1], floor), Math.max(base[2], floor), Math.max(base[3], floor)];

  const topAction = strategy.reduce((best, p, i) => (p > strategy[best]! ? i : best), 0);
  const chosenFrequency = strategy[chosen]!;
  const inMix = chosenFrequency >= MIX_THRESHOLD;
  const category = inMix ? 'best' : categoryFor(gradedLoss, t);
  return {
    category,
    loss,
    gradedLoss,
    lossBb,
    bestActions,
    topAction,
    chosenFrequency,
    inMix,
    lowerFrequency: inMix && chosen !== topAction,
    unconverged: inMix && gradedLoss > t[2],
    unit,
  };
}

function requirePot(pot: number | undefined): number {
  if (pot === undefined || !(pot > 0)) throw new Error('grading in % of pot needs the pot size');
  return pot;
}
