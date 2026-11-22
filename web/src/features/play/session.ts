// Playing sessions (D-090): cash games, sit-and-gos and a small multi-table simulation. A session
// keeps chips between hands; each hand is played by the engine in big blinds of the current level,
// so bots, charts and grading work unchanged. Blind levels and payouts are example structures.

import type { GameState } from './engine';
import type { Personality } from './personality';

export type Level = { sb: number; bb: number; ante: number };

/** Example blind structure (chips), one level per `handsPerLevel` hands. */
export const LEVELS: Level[] = [
  { sb: 10, bb: 20, ante: 0 },
  { sb: 15, bb: 30, ante: 0 },
  { sb: 25, bb: 50, ante: 0 },
  { sb: 50, bb: 100, ante: 10 },
  { sb: 75, bb: 150, ante: 15 },
  { sb: 100, bb: 200, ante: 25 },
  { sb: 150, bb: 300, ante: 40 },
  { sb: 200, bb: 400, ante: 50 },
  { sb: 300, bb: 600, ante: 75 },
  { sb: 400, bb: 800, ante: 100 },
  { sb: 600, bb: 1200, ante: 150 },
  { sb: 1000, bb: 2000, ante: 250 },
];

export type CashFormat = { kind: 'cash'; players: number; startBb: number; stacks: 'reset' | 'carry'; rebuy: boolean };
export type SngFormat = { kind: 'sng'; players: number; startChips: number; handsPerLevel: number; payouts: number[] };
export type MttFormat = { kind: 'mtt'; field: number; tableSize: number; startChips: number; handsPerLevel: number; payouts: number[] };
export type Format = CashFormat | SngFormat | MttFormat;

/** Example payouts (shares of the prize pool). */
export const SNG_PAYOUTS: Record<number, number[]> = { 6: [65, 35], 9: [50, 30, 20] };
export const MTT_PAYOUTS = [40, 27, 19, 14];

export type Player = { name: string; chips: number; bot: Personality | null; out: boolean; place?: number; rebuys: number };

export type HandSummary = { hand: number; level: number; bb: number; heroNet: number; heroNetBb: number };

export type Session = {
  format: Format;
  /** Players at the hero's table, in seat order (the hero is seat 0). */
  table: Player[];
  /** Multi-table simulation: chips of the players at the other tables (not played). */
  field: number[];
  /** Players still in the tournament when each placed player busted (for places). */
  remaining: number;
  hand: number;
  /** Index into `table` of the button. */
  button: number;
  finished: boolean;
  heroPrize: number | null;
  hands: HandSummary[];
};

export const isTournament = (f: Format) => f.kind !== 'cash';
export const levelOf = (s: Session): Level =>
  s.format.kind === 'cash' ? { sb: 0.5, bb: 1, ante: 0 } : LEVELS[Math.min(LEVELS.length - 1, Math.floor(s.hand / s.format.handsPerLevel))]!;

export function startSession(format: Format, names: string[], bots: Personality[]): Session {
  const seats = format.kind === 'mtt' ? format.tableSize : format.players;
  const start = format.kind === 'cash' ? format.startBb : format.startChips;
  const table: Player[] = Array.from({ length: seats }, (_, i) => ({ name: names[i] ?? `Bot ${i}`, chips: start, bot: i === 0 ? null : (bots[(i - 1) % bots.length] ?? 'reference'), out: false, rebuys: 0 }));
  const field = format.kind === 'mtt' ? new Array(format.field - seats).fill(start) : [];
  return { format, table, field, remaining: table.length + field.length, hand: 0, button: 0, finished: false, heroPrize: null, hands: [] };
}

/** The next hand's seating for the engine: active players, stacks in big blinds, hero and button indices. */
export function handSetup(s: Session): { names: string[]; stacks: number[]; hero: number; button: number; ante: number; bots: (Personality | null)[]; index: number[] } {
  const lvl = levelOf(s);
  const index = s.table.map((p, i) => (p.out ? -1 : i)).filter((i) => i >= 0);
  const active = index.map((i) => s.table[i]!);
  return {
    names: active.map((p) => p.name),
    stacks: active.map((p) => p.chips / lvl.bb),
    hero: index.indexOf(0),
    button: Math.max(0, index.indexOf(s.button)),
    ante: lvl.ante / lvl.bb,
    bots: active.map((p) => p.bot),
    index,
  };
}

const prizeFor = (f: Format, place: number) => (f.kind === 'cash' ? 0 : (f.payouts[place - 1] ?? 0));

/** Apply a finished hand: chips, busts, places, rebuys, the button, blind level and the end. */
export function applyHand(prev: Session, end: GameState, setup: ReturnType<typeof handSetup>, rnd: () => number): Session {
  const s: Session = structuredClone(prev);
  const lvl = levelOf(prev);
  const heroBefore = s.table[0]!.chips;
  setup.index.forEach((ti, k) => (s.table[ti]!.chips = Math.round(end.seats[k]!.stack * lvl.bb * 1e6) / 1e6));
  // Busts this hand: the smaller starting stack takes the lower place.
  const busted = setup.index.filter((ti) => s.table[ti]!.chips <= 1e-9).sort((a, b) => setup.stacks[setup.index.indexOf(a)]! - setup.stacks[setup.index.indexOf(b)]!);
  if (s.format.kind === 'cash') {
    for (const ti of busted) {
      if (s.format.rebuy || ti !== 0) {
        s.table[ti]!.chips = s.format.startBb;
        s.table[ti]!.rebuys++;
      } else s.table[ti]!.out = true;
    }
    if (s.format.stacks === 'reset') s.table.forEach((p) => !p.out && (p.chips = (s.format as CashFormat).startBb));
  } else {
    for (const ti of busted) {
      s.table[ti]!.out = true;
      s.table[ti]!.place = s.remaining;
      s.remaining--;
    }
  }
  s.hands.push({ hand: s.hand, level: Math.floor(s.hand / (s.format.kind === 'cash' ? 1 : s.format.handsPerLevel)), bb: lvl.bb, heroNet: s.table[0]!.chips - heroBefore, heroNetBb: (s.table[0]!.chips - heroBefore) / lvl.bb });
  s.hand++;
  if (s.format.kind === 'mtt') simulateField(s, rnd);
  // The button moves to the next player still in.
  const n = s.table.length;
  for (let k = 1; k <= n; k++) {
    const i = (s.button + k) % n;
    if (!s.table[i]!.out) {
      s.button = i;
      break;
    }
  }
  const hero = s.table[0]!;
  const left = s.table.filter((p) => !p.out).length + s.field.length;
  if (s.format.kind !== 'cash' && (hero.out || left === 1)) {
    if (!hero.out) hero.place = 1;
    s.heroPrize = prizeFor(s.format, hero.place!);
    s.finished = true;
  }
  if (s.format.kind === 'cash' && hero.out) s.finished = true;
  return s;
}

/**
 * The other tables of the multi-table simulation (not played): each hand one random player
 * there may bust (their chips go to another player there), and table balancing moves players to
 * the hero's table when it runs short and at the final table.
 */
function simulateField(s: Session, rnd: () => number) {
  const f = s.format as MttFormat;
  if (s.field.length >= 2 && rnd() < BUST_CHANCE) {
    const loser = Math.floor(rnd() * s.field.length);
    let winner = Math.floor(rnd() * (s.field.length - 1));
    if (winner >= loser) winner++;
    s.field[winner]! += s.field[loser]!;
    s.field.splice(loser, 1);
    s.remaining--;
  }
  const seated = () => s.table.filter((p) => !p.out).length;
  // Refill empty seats while the hero's table is short (and always at the final table).
  const want = s.field.length + seated() <= f.tableSize ? s.field.length + seated() : f.tableSize - 2;
  while (s.field.length && seated() < want) {
    const slot = s.table.findIndex((p) => p.out);
    const chips = s.field.shift()!;
    const bot: Personality = (['reference', 'nit', 'station', 'lag', 'overfolder', 'overbluffer'] as const)[Math.floor(rnd() * 6)]!;
    const player: Player = { name: `Bot ${s.hand}-${slot}`, chips, bot, out: false, rebuys: 0 };
    if (slot >= 0) s.table[slot] = player;
    else s.table.push(player);
  }
}

/** Chance per hand that someone at the other tables busts (simulation setting). */
export const BUST_CHANCE = 0.18;

/** Prize-pool shares still to be paid to the players left (for ICM at this table). */
export function remainingPayouts(s: Session): number[] {
  if (s.format.kind === 'cash') return [];
  return s.format.payouts.slice(0, s.remaining);
}

/** All-in EV for heads-up all-ins (D-090): what the hero's result would be on average given the equity when the money went in. */
export function allInEv(heroEquity: number, pot: number, heroContributed: number): number {
  return heroEquity * pot - heroContributed;
}
