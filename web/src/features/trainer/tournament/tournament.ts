// Tournament push/fold drill (D-089): bubble, final-table and satellite spots solved live with
// ICM (heads-up push/fold between the small and big blind; everyone else folds, exact for that
// model), next to the same spot in chips. Stacks and payout structures are example inputs.

import type { PushFoldResult, PushFoldSpotJson } from '../../../lib/wasm/protocol';
import { grade, type Grade } from '../grading';
import { combosIn, randomCombo } from '../preflop/deal';

export type ScenarioKind = 'bubble' | 'final-table' | 'satellite' | 'pko';
export const SCENARIOS: ScenarioKind[] = ['bubble', 'final-table', 'satellite', 'pko'];

/** Payout structures (example inputs, shares of a 100-unit prize pool). */
export const PAYOUTS: Record<ScenarioKind, number[]> = {
  // Four left, three paid.
  bubble: [50, 30, 20],
  // Six left, everyone paid, top-heavy.
  'final-table': [40, 25, 15, 10, 6, 4],
  // Four left, three equal seats: only survival matters.
  satellite: [100 / 3, 100 / 3, 100 / 3],
  // Knockout final table: six left, a smaller prize pool plus bounties (see BOUNTY).
  pko: [30, 18, 12, 8, 5, 3],
};
const PLAYERS: Record<ScenarioKind, number> = { bubble: 4, 'final-table': 6, satellite: 4, pko: 6 };

/**
 * Knockout bounty on each head in the PKO scenario (prize units), and the share counted: in a
 * progressive knockout half is paid in cash at once and half is added to the winner's own bounty.
 * Only the cash half is counted (the other half's value depends on later hands), so PKO answers
 * are approximate (D-089).
 */
export const BOUNTY = 8;
export const BOUNTY_CASH_SHARE = 0.5;
const STACK_CHOICES = [4, 6, 8, 10, 12, 15, 18, 20, 25, 30];

export type TournamentSpot = { kind: ScenarioKind; stacks: number[]; sb: number; bb: number; role: 'shove' | 'call' };

export function randomSpot(rnd: () => number): TournamentSpot {
  const kind = SCENARIOS[Math.floor(rnd() * SCENARIOS.length)]!;
  const n = PLAYERS[kind];
  const stacks = Array.from({ length: n }, () => STACK_CHOICES[Math.floor(rnd() * STACK_CHOICES.length)]!);
  // The blinds are the last two seats; everyone before them has folded.
  return { kind, stacks, sb: n - 2, bb: n - 1, role: rnd() < 0.5 ? 'shove' : 'call' };
}

export const toJson = (s: TournamentSpot, icm: boolean): PushFoldSpotJson => ({
  stacks: s.stacks,
  pusher: s.sb,
  caller: s.bb,
  ante: 0,
  payouts: icm ? PAYOUTS[s.kind] : [],
  // Bounties only in the ICM solve (prize units); the chips comparison has none.
  ...(icm && s.kind === 'pko' ? { bounties: s.stacks.map(() => BOUNTY * BOUNTY_CASH_SHARE) } : {}),
});

export type Solved = { icm: PushFoldResult; chips: PushFoldResult };

/** Value of one chip on average: the prize pool (plus counted bounties) over the chips in play (prize units per bb). */
export const chipValue = (s: TournamentSpot) => (PAYOUTS[s.kind].reduce((a, b) => a + b, 0) + (s.kind === 'pko' ? s.stacks.length * BOUNTY * BOUNTY_CASH_SHARE : 0)) / s.stacks.reduce((a, b) => a + b, 0);

/** Share of hands (by combos) the side plays aggressively: shoves for the pusher, calls for the caller. */
export function rangeShare(side: PushFoldResult['pusher'], classes: string[]): number {
  let w = 0;
  let s = 0;
  classes.forEach((c, i) => {
    const n = combosIn(c);
    w += n;
    s += n * side.strategy[i]![1]!;
  });
  return s / w;
}

export type TournamentProblem = { spot: TournamentSpot; classIndex: number; handClass: string; combo: string };

/** Deal a hand class by combos (every class reaches these decisions: first in, or facing the shove). */
export function dealHand(spot: TournamentSpot, classes: string[], rnd: () => number): TournamentProblem {
  const weights = classes.map(combosIn);
  const total = weights.reduce((a, b) => a + b, 0);
  let x = rnd() * total;
  let i = weights.findIndex((w) => (x -= w) < 0);
  if (i < 0) i = classes.length - 1;
  return { spot, classIndex: i, handClass: classes[i]!, combo: randomCombo(classes[i]!, rnd) };
}

export type TournamentGrade = { grade: Grade; icmEv: [number, number]; chipsEv: [number, number]; chipsBest: number; icmBest: number };

/**
 * Grade a choice (0 fold, 1 shove or call) by its ICM EV, with the loss in bb-equivalents (prize
 * units ÷ the average chip value) so the trainer's bb thresholds apply.
 */
export function gradeChoice(p: TournamentProblem, solved: Solved, chosen: 0 | 1): TournamentGrade {
  const side = p.spot.role === 'shove' ? 'pusher' : 'caller';
  const icm = solved.icm[side];
  const chips = solved.chips[side];
  const k = p.classIndex;
  const icmEv = [icm.ev[k]![0]!, icm.ev[k]![1]!] as [number, number];
  const chipsEv = [chips.ev[k]![0]!, chips.ev[k]![1]!] as [number, number];
  const v = chipValue(p.spot);
  const g = grade({ ev: icmEv.map((e) => e / v), strategy: icm.strategy[k]!, chosen, unit: 'bb' });
  return { grade: g, icmEv, chipsEv, icmBest: icmEv[1] >= icmEv[0] ? 1 : 0, chipsBest: chipsEv[1] >= chipsEv[0] ? 1 : 0 };
}
