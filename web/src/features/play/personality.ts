// Personality bots (D-090): deliberate, documented deviations from the reference bot, labelled as
// exploitable and not equilibrium, each with the leak it shows and how to exploit it. The
// reference bot is the chart (preflop, where the spot is in the tree) plus the rule-based bot.
// The numbers below are the bots' settings, not claims about good strategy.

import type { ChartFile } from '../../lib/provenance/types';
import { chartMove, DEFAULT_RULE, ruleMove, type BotMove, type EquityFn, type RuleParams } from './bots';
import { legal, type GameState, type Move } from './engine';

export type Personality = 'reference' | 'nit' | 'station' | 'lag' | 'overfolder' | 'overbluffer';
export const PERSONALITIES: Personality[] = ['reference', 'nit', 'station', 'lag', 'overfolder', 'overbluffer'];

/** Postflop thresholds per personality (see RuleParams). */
export const POSTFLOP: Record<Personality, RuleParams> = {
  reference: DEFAULT_RULE,
  // Tight-passive: needs more to continue, rarely bets or bluffs.
  nit: { ...DEFAULT_RULE, callMargin: 0.12, raiseFloor: 0.85, valueFloor: 0.72, bluffRate: 0.02 },
  // Calling station: calls far too light, almost never raises.
  station: { ...DEFAULT_RULE, callMargin: -0.15, raiseFloor: 0.9, valueFloor: 0.7, bluffRate: 0.03 },
  // Loose-aggressive: bets thinner and bluffs a lot.
  lag: { ...DEFAULT_RULE, callMargin: 0, raiseFloor: 0.62, valueFloor: 0.52, valueMargin: 0.15, bluffRate: 0.35 },
  // Over-folder: gives up to bets unless the price is very good.
  overfolder: { ...DEFAULT_RULE, callMargin: 0.2 },
  // Over-bluffer: bets weak hands half the time it's checked to.
  overbluffer: { ...DEFAULT_RULE, bluffRate: 0.5 },
};

/** Preflop deviations, from the hand's equity against one random hand (sampled). */
export const PREFLOP = {
  nit: { foldBelow: 0.58, passiveBelow: 0.7 },
  station: { callAbove: 0.38, flatInsteadOfRaise: 0.7 },
  lag: { raiseAbove: 0.45 },
  overfolder: { foldToRaiseBelow: 0.62 },
} as const;

const isAggressive = (m: Move) => m.kind === 'raise';

/** A raise to about 2.5 open (or 3× the current bet when facing one), within the legal range. */
function standardRaise(s: GameState): Move {
  const l = legal(s);
  const to = s.currentBet <= 1 ? 2.5 : s.currentBet * 3;
  return { kind: 'raise', to: Math.min(l.maxTo!, Math.max(l.minTo!, to)) };
}

/** Apply a personality's preflop deviation to the reference move. */
export function preflopDeviation(p: Personality, s: GameState, base: Move, e: number, rnd: () => number): { move: Move; note: string } | null {
  const l = legal(s);
  const facingRaise = s.currentBet > 1 && l.call !== null;
  if (p === 'nit') {
    if (base.kind !== 'fold' && base.kind !== 'check' && e < PREFLOP.nit.foldBelow) return { move: l.fold ? { kind: 'fold' } : { kind: 'check' }, note: 'too tight: folds a playable hand' };
    if (isAggressive(base) && e < PREFLOP.nit.passiveBelow) return { move: l.call !== null ? { kind: 'call' } : { kind: 'check' }, note: 'passive: calls instead of raising' };
  }
  if (p === 'station') {
    if (base.kind === 'fold' && l.call !== null && e >= PREFLOP.station.callAbove) return { move: { kind: 'call' }, note: 'calls too light' };
    if (isAggressive(base) && facingRaise && rnd() < PREFLOP.station.flatInsteadOfRaise) return { move: { kind: 'call' }, note: 'flats instead of re-raising' };
  }
  if (p === 'lag') {
    if ((base.kind === 'fold' || base.kind === 'check' || base.kind === 'call') && l.minTo !== null && e >= PREFLOP.lag.raiseAbove) return { move: standardRaise(s), note: 'raises a wide range' };
  }
  if (p === 'overfolder') {
    if (facingRaise && base.kind !== 'fold' && e < PREFLOP.overfolder.foldToRaiseBelow) return { move: { kind: 'fold' }, note: 'folds too often to raises' };
  }
  return null;
}

export type PersonalityMove = BotMove & { personality: Personality; deviation?: string };

/** The bot's move: the reference move, then the personality's deviation. */
export async function personalityMove(p: Personality, s: GameState, docs: Map<string, ChartFile>, equity: EquityFn, rnd: () => number): Promise<PersonalityMove> {
  const seat = s.seats[s.toAct!]!;
  if (s.street === 'preflop') {
    const base = chartMove(s, docs, rnd) ?? (await ruleMove(s, equity, rnd, POSTFLOP[p]));
    if (p === 'reference' || p === 'overbluffer') return { ...base, personality: p };
    const e = await equity(seat.cards.join(''), '', 1);
    const dev = preflopDeviation(p, s, base.move, e, rnd);
    return dev ? { ...base, move: dev.move, personality: p, deviation: dev.note } : { ...base, personality: p };
  }
  return { ...(await ruleMove(s, equity, rnd, POSTFLOP[p])), personality: p };
}
