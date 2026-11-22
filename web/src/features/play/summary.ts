// Session review (D-090): all-in EV for heads-up all-ins, per-decision grades, EV loss by street
// and position, biggest mistakes, leaks with intervals, and drills to practise.

import type { Decision } from '../review/reviewHand';
import { groupStats, MIN_SAMPLE, type GroupStats } from '../trainer/stats';
import type { GameState } from './engine';

export type AllIn = { street: 'preflop' | 'flop' | 'turn'; board: string[]; villain: string; equity: number; pot: number; contributed: number; evBb: number; actualBb: number };

/**
 * The heads-up all-in of a finished hand, if the money went in before the river with exactly two
 * players left: the street, the board then, and the pot and hero contribution at the end.
 */
export function allInSpot(s: GameState): Omit<AllIn, 'equity' | 'evBb'> | null {
  if (!s.done) return null;
  const live = s.seats.filter((p) => !p.folded);
  const hero = s.seats.findIndex((p) => p.hero);
  if (live.length !== 2 || s.seats[hero]!.folded) return null;
  // The last voluntary action closes the betting; after it no one could act.
  const acts = s.history.filter((a) => a.kind !== 'post');
  const last = acts.at(-1);
  if (!last || last.street === 'river') return null;
  if (!s.seats.some((p) => !p.folded && p.allIn)) return null;
  const street = last.street as AllIn['street'];
  const cards = { preflop: 0, flop: 3, turn: 4 }[street];
  const villain = live.find((p) => !p.hero)!;
  const pot = s.contributed.reduce((a, b) => a + b, 0) - s.rakeTaken;
  return { street, board: s.board.slice(0, cards), villain: villain.cards.join(''), pot, contributed: s.contributed[hero]!, actualBb: s.collected[hero]! - s.contributed[hero]! };
}

/** All-in EV: the hero's equity share of the pot minus what they put in. */
export const allInEvBb = (equity: number, pot: number, contributed: number) => equity * pot - contributed;

export type HandResult = { hand: number; netBb: number; allIn: AllIn | null; decisions: Decision[]; position: string };

export type SessionReport = {
  hands: number;
  netBb: number;
  /** Net with each heads-up all-in counted at its EV instead of its result. */
  allInAdjustedBb: number;
  allIns: number;
  graded: number;
  /** EV given up in graded decisions, in bb, by street and position. */
  lossByStreet: Record<string, number>;
  lossByPosition: Record<string, number>;
  mistakes: { hand: number; decision: Decision }[];
  leaks: GroupStats[];
  /** Charts behind the biggest mistakes, to drill. */
  drills: { file: string; chart: string }[];
};

export function sessionReport(results: HandResult[]): SessionReport {
  const graded = results.flatMap((r) => r.decisions.filter((d) => d.status === 'graded' && d.grade).map((d) => ({ r, d })));
  const add = (m: Record<string, number>, k: string, v: number) => ((m[k] = (m[k] ?? 0) + v), m);
  const lossByStreet: Record<string, number> = {};
  const lossByPosition: Record<string, number> = {};
  for (const { r, d } of graded) {
    add(lossByStreet, d.action.street, d.grade!.lossBb);
    add(lossByPosition, r.position, d.grade!.lossBb);
  }
  const mistakes = graded
    .filter(({ d }) => d.grade!.category === 'mistake' || d.grade!.category === 'blunder' || d.grade!.category === 'inaccuracy')
    .sort((a, b) => b.d.grade!.lossBb - a.d.grade!.lossBb)
    .slice(0, 5)
    .map(({ r, d }) => ({ hand: r.hand, decision: d }));
  const stats = groupStats(
    graded.map(({ r, d }) => ({ unit: 'bb' as const, loss: d.grade!.lossBb, category: d.grade!.category, groups: { position: r.position, street: d.action.street } })),
    ['position', 'street'],
  );
  const drills: { file: string; chart: string }[] = [];
  for (const m of mistakes) {
    const ref = m.decision.ref;
    if (ref && !drills.some((x) => x.chart === ref.chart && x.file === ref.file)) drills.push({ file: ref.file, chart: ref.chart });
  }
  return {
    hands: results.length,
    netBb: results.reduce((a, r) => a + r.netBb, 0),
    allInAdjustedBb: results.reduce((a, r) => a + (r.allIn ? r.allIn.evBb : r.netBb), 0),
    allIns: results.filter((r) => r.allIn).length,
    graded: graded.length,
    lossByStreet,
    lossByPosition,
    mistakes,
    leaks: stats.filter((s) => s.leak),
    drills: drills.slice(0, 3),
  };
}

export { MIN_SAMPLE };
