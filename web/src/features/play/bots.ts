// Play-mode bots (D-079). Preflop they sample from OpenRange's charts whenever the spot is in
// the chart tree; everywhere else they use a simple rule-based strategy, and every action
// says which one it came from. Neither is presented as optimal play.

import { cellOf } from '../../lib/poker/hands';
import type { ChartFile } from '../../lib/provenance/types';
import { UNREACHED } from '../charts/ClassGrid';
import type { Hand } from '../review/handHistory';
import { preflopSpot } from '../review/reviewHand';
import { legal, type GameState, type Move } from './engine';

export type BotMove = { move: Move; source: 'chart' | 'rule'; detail: string };

/** The game so far as a hand history (for the chart lookup and the review). */
export function toHand(s: GameState, id = 'play'): Hand {
  const hero = s.seats.find((p) => p.hero);
  return {
    site: 'OpenRange',
    id,
    bigBlind: 1,
    unit: '',
    maxPlayers: 6,
    buttonSeat: s.button + 1,
    seats: s.seats.map((p, i) => ({ seat: i + 1, name: p.name, position: p.position, stack: Math.round((p.stack + s.contributed[i]! - s.collected[i]!) * 1e6) / 1e6 })),
    hero: hero?.name ?? null,
    heroCards: hero?.cards ?? [],
    board: s.board,
    actions: s.history,
    collected: Object.fromEntries(s.seats.map((p, i) => [p.name, s.collected[i]!]).filter(([, c]) => (c as number) > 0)),
    shown: Object.fromEntries(s.seats.filter((_, i) => s.shown[i]).map((p) => [p.name, p.cards])),
  };
}

/** Turn a chart action label into a legal move. */
function fromLabel(s: GameState, label: string): Move {
  const l = legal(s);
  if (/^Fold/.test(label)) return l.fold ? { kind: 'fold' } : { kind: 'check' };
  if (/^(Call|Check)/.test(label)) return l.call !== null ? { kind: 'call' } : { kind: 'check' };
  if (l.minTo === null) return l.call !== null ? { kind: 'call' } : { kind: 'check' };
  if (/^All-in/.test(label)) return { kind: 'raise', to: l.maxTo! };
  const size = Number(/([\d.]+)$/.exec(label)?.[1]);
  return { kind: 'raise', to: Number.isFinite(size) ? size : l.minTo };
}

/** A preflop move sampled from the chart for this spot, or null if the spot isn't in the tree. */
export function chartMove(s: GameState, docs: Map<string, ChartFile>, rnd: () => number): BotMove | null {
  if (s.street !== 'preflop' || s.toAct === null) return null;
  const p = s.seats[s.toAct]!;
  const spot = preflopSpot(toHand(s), s.history.length, p.name);
  if ('reason' in spot) return null;
  const doc = docs.get(spot.file);
  const chart = doc?.charts.find((c) => c.id === spot.chart);
  if (!doc || !chart) return null;
  const k = doc.classes.indexOf(doc.classes[cellOf(p.cards.join('')).index]!);
  if (k < 0 || (chart.reach && chart.reach[k]! < UNREACHED)) return null;
  const strategy = chart.strategy[k]!;
  let r = rnd();
  let a = 0;
  for (; a < strategy.length - 1; a++) {
    r -= strategy[a]!;
    if (r < 0) break;
  }
  return { move: fromLabel(s, chart.actions[a]!), source: 'chart', detail: spot.chart };
}

/** Equity of a hand against `opponents` random hands on the board (sampled). */
export type EquityFn = (cards: string, board: string, opponents: number) => Promise<number>;

/**
 * The simple rule-based bot: estimate equity against random hands, call when the price is
 * right, bet strong hands for value, bluff now and then. Deliberately plain and labelled so.
 */
export async function ruleMove(s: GameState, equity: EquityFn, rnd: () => number): Promise<BotMove> {
  const i = s.toAct!;
  const p = s.seats[i]!;
  const l = legal(s);
  const opponents = s.seats.filter((q, j) => j !== i && !q.folded).length;
  const e = await equity(p.cards.join(''), s.board.join(''), opponents);
  const pot = s.contributed.reduce((a, b) => a + b, 0);
  const raiseTo = (fraction: number) => ({ kind: 'raise' as const, to: Math.min(l.maxTo!, Math.max(l.minTo!, s.currentBet + fraction * (pot + (l.call ?? 0)))) });
  const fair = 1 / (opponents + 1);
  if (l.call !== null) {
    const price = l.call / (pot + l.call);
    if (l.minTo !== null && e > Math.max(0.7, fair + 0.35)) return { move: raiseTo(0.75), source: 'rule', detail: 'strong hand: raise' };
    if (e >= price + 0.05) return { move: { kind: 'call' }, source: 'rule', detail: 'the price is right: call' };
    return { move: { kind: 'fold' }, source: 'rule', detail: 'not enough equity for the price: fold' };
  }
  if (l.minTo !== null && e > Math.max(0.6, fair + 0.25)) return { move: raiseTo(0.66), source: 'rule', detail: 'strong hand: bet for value' };
  if (l.minTo !== null && e < fair * 0.6 && rnd() < 0.12) return { move: raiseTo(0.5), source: 'rule', detail: 'weak hand: occasional bluff' };
  return { move: { kind: 'check' }, source: 'rule', detail: 'check' };
}
