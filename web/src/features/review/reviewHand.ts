// Post-session review of an imported hand (D-078): find a reference for each of the hero's
// decisions. Exact heads-up push/fold decisions are graded; 6-max cash decisions get the
// approximate chart as a practice reference (as in the trainer); everything else is shown as
// "not graded" with the reason. Nothing is guessed.

import { cellOf } from '../../lib/poker/hands';
import type { ChartFile } from '../../lib/provenance/types';
import { UNREACHED } from '../charts/ClassGrid';
import { grade, type Grade } from '../trainer/grading';
import type { Hand, HandAction } from './handHistory';

export type Reference = { file: string; chart: string; graded: boolean };

export type Decision = {
  index: number;
  action: HandAction;
  /** 'graded': exact reference; 'practice': approximate chart; 'none': no reference. */
  status: 'graded' | 'practice' | 'none';
  reason?: string;
  ref?: Reference;
  /** The chart's actions, strategy and EVs for the hero's hand, and the hero's choice. */
  actions?: string[];
  strategy?: number[];
  ev?: (number | null)[];
  chosen?: number;
  grade?: Grade;
  /** Size note when the hero's raise size differs from the chart's. */
  sizeNote?: string;
};

export const CASH_FILES: Record<number, string> = { 20: 'cash-6max-20bb.json', 40: 'cash-6max-40bb.json', 60: 'cash-6max-60bb.json', 100: 'cash-6max-100bb.json' };
export const HU_FILE = 'pushfold-hu.json';

const handClass = (cards: string[]) => (cards.length === 2 ? cellOf(cards.join('')).index : -1);

/** The cash chart file for an effective stack, if one is within a quarter of it. */
export function cashFileFor(effective: number): string | null {
  let best: number | null = null;
  for (const s of Object.keys(CASH_FILES).map(Number)) if (best === null || Math.abs(s - effective) < Math.abs(best - effective)) best = s;
  return best !== null && Math.abs(best - effective) <= 0.25 * best ? CASH_FILES[best]! : null;
}

/** Which chart answers `player`'s preflop decision at action `k` (default: the hero), or why none does. */
export function preflopSpot(hand: Hand, k: number, player = hand.hero!): { file: string; chart: string; graded: boolean } | { reason: string } {
  const hero = player;
  const seat = hand.seats.find((s) => s.name === hero)!;
  const pos = seat.position;
  const before = hand.actions.slice(0, k).filter((a) => a.street === 'preflop' && a.kind !== 'post');
  const players = hand.seats.length;
  const raises = before.filter((a) => a.kind === 'raise' || a.kind === 'bet');
  const limps = before.filter((a) => a.kind === 'call' && !raises.some((r) => before.indexOf(r) < before.indexOf(a)));
  const posOf = (name: string) => hand.seats.find((s) => s.name === name)?.position ?? '?';
  const others = hand.seats.filter((s) => s.name !== hero);
  const effective = Math.min(seat.stack, Math.max(...others.map((s) => s.stack)));

  if (players === 2) {
    // Heads-up: the button posts the small blind. Exact push/fold for shove-or-fold spots only.
    const stack = Math.round(effective);
    if (stack < 2 || stack > 25) return { reason: `heads-up at ${effective.toFixed(1)} bb: the exact push/fold charts cover 2 to 25 bb` };
    if (pos === 'BTN' && raises.length === 0) return { file: HU_FILE, chart: `sb-shove-${stack}`, graded: true };
    if (pos === 'BB' && raises.length === 1 && raises[0]!.allIn) return { file: HU_FILE, chart: `bb-call-${stack}`, graded: true };
    return { reason: 'heads-up spots other than shove-or-fold have no exact reference' };
  }
  if (hand.maxPlayers > 6 || players > 6) return { reason: `${players} players: the cash charts are 6-max` };
  if (limps.length) return { reason: "someone limped: the cash charts' tree has no limps" };
  const file = cashFileFor(effective);
  if (!file) return { reason: `effective stack ${effective.toFixed(0)} bb: charts exist for 20, 40, 60 and 100 bb` };
  const heroRaises = raises.filter((r) => r.player === hero).length;
  if (raises.length === 0) return { file, chart: `first-in-${pos}`, graded: false };
  const opener = raises[0]!.player;
  const callers = before.filter((a) => a.kind === 'call' && a.player !== hero);
  if (raises.length === 1 && heroRaises === 0) {
    if (callers.length === 0) return { file, chart: `vs-open-${pos}-vs-${posOf(opener)}`, graded: false };
    if (callers.length === 1) return { file, chart: `squeeze-${pos}-vs-${posOf(opener)}-${posOf(callers[0]!.player)}`, graded: false };
    return { reason: 'more than one caller: the cash tree allows at most one' };
  }
  const last = raises[raises.length - 1]!;
  const names = ['open', '3bet', '4bet', '5bet'];
  if (raises.length >= 2 && raises.length <= 4 && heroRaises === raises.length - 1 && last.player !== hero) {
    return { file, chart: `vs-${names[raises.length - 1]}-${pos}-vs-${posOf(last.player)}`, graded: false };
  }
  return { reason: 'this betting sequence is not in the cash tree' };
}

/** Index of the chart action matching the hero's action (sizes are matched by type). */
function chartAction(actions: string[], a: HandAction): number {
  const find = (re: RegExp) => actions.findIndex((x) => re.test(x));
  if (a.kind === 'fold') return find(/^Fold/);
  if (a.kind === 'check') return find(/^Check/);
  if (a.kind === 'call') return find(/^Call/);
  if (a.allIn) {
    const i = find(/^All-in/);
    if (i >= 0) return i;
  }
  return find(/^(Raise|Bet|All-in)/);
}

export function reviewHand(hand: Hand, docs: Map<string, ChartFile>): Decision[] {
  if (!hand.hero) return [];
  const cls = handClass(hand.heroCards);
  return hand.actions.flatMap((action, index): Decision[] => {
    if (action.player !== hand.hero || action.kind === 'post') return [];
    if (action.street !== 'preflop') return [{ index, action, status: 'none', reason: 'postflop decisions have no solved reference in the library; study the spot in the solver' }];
    const spot = preflopSpot(hand, index);
    if ('reason' in spot) return [{ index, action, status: 'none', reason: spot.reason }];
    const doc = docs.get(spot.file);
    const chart = doc?.charts.find((c) => c.id === spot.chart);
    if (!doc || !chart) return [{ index, action, status: 'none', reason: `no chart ${spot.chart} in ${spot.file}` }];
    const k = doc.classes.indexOf(handClassName(cls, doc));
    if (k < 0 || cls < 0) return [{ index, action, status: 'none', reason: 'hero cards unknown' }];
    if (chart.reach && chart.reach[k]! < UNREACHED) return [{ index, action, status: 'none', reason: 'the reference never reaches this spot with this hand (it plays it differently earlier)' }];
    const chosen = chartAction(chart.actions, action);
    if (chosen < 0) return [{ index, action, status: 'none', reason: `"${action.kind}" isn't one of this chart's actions (${chart.actions.join(', ')})` }];
    const ev = chart.ev?.[k] ?? null;
    const strategy = chart.strategy[k]!;
    const chartSize = Number(/([\d.]+)$/.exec(chart.actions[chosen] ?? '')?.[1]);
    const sizeNote = action.to && Number.isFinite(chartSize) && Math.abs(action.to - chartSize) > 0.25 ? `you raised to ${action.to.toFixed(1)} bb; the chart's size is ${chartSize} bb` : undefined;
    const g = ev && ev[chosen] !== null ? grade({ ev, evStdError: chart.evStdError?.[k] ?? null, strategy, chosen, unit: 'bb' }) : undefined;
    return [{ index, action, status: spot.graded ? 'graded' : 'practice', ref: spot, actions: chart.actions, strategy, ev: ev ?? undefined, chosen, grade: g, sizeNote }];
  });
}

/** Chart class name for a grid index (charts list classes in grid order). */
function handClassName(index: number, doc: ChartFile): string {
  return doc.classes[index] ?? '';
}
