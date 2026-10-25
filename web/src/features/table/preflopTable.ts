// Build a table picture for a preflop chart decision from the chart's action line
// ("UTG fold, HJ all-in 5, CO fold"), the stack and the hero's seat.

import type { Seat } from './PokerTable';

export const SEAT_ORDER = ['UTG', 'UTG1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

/** Seats for an n-handed table, in preflop acting order (the last n of the full order). */
export function seatsFor(players: number): string[] {
  if (players === 2) return ['SB', 'BB'];
  const six = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  if (players <= 6) return six.slice(6 - players);
  return SEAT_ORDER.slice(SEAT_ORDER.length - players);
}

export type PreflopPicture = { seats: Seat[]; pot: number; history: string[] };

export function preflopTable(opts: { players: number; stack: number; line: string; hero: string; heroCards: string[]; heroLabel: string; ante?: number }): PreflopPicture {
  const names = seatsFor(opts.players);
  const bet = new Map<string, number>(names.map((n) => [n, 0]));
  const status = new Map<string, Seat['status']>(names.map((n) => [n, 'active']));
  bet.set('SB', 0.5);
  bet.set('BB', 1);
  if (opts.players === 2) {
    // Heads-up: the button is the small blind.
    bet.set('SB', 0.5);
  }
  const history: string[] = [];
  let top = 1;
  for (const step of opts.line.split(',').map((s) => s.trim()).filter(Boolean)) {
    const [seat = '', verb = '', amount] = step.split(/\s+/);
    if (!bet.has(seat)) continue;
    if (verb === 'fold') {
      status.set(seat, 'folded');
      history.push(`${seat} folds`);
    } else if (verb === 'call') {
      bet.set(seat, Math.min(opts.stack, top));
      history.push(`${seat} calls`);
    } else if (verb === 'raise' || verb === 'all-in') {
      const to = Number(amount ?? opts.stack);
      top = Math.max(top, to);
      bet.set(seat, to);
      if (verb === 'all-in' || to >= opts.stack) status.set(seat, 'allin');
      history.push(verb === 'all-in' ? `${seat} all-in ${to} bb` : `${seat} raises to ${to} bb`);
    }
  }
  const seats: Seat[] = names.map((n) => {
    const b = bet.get(n) ?? 0;
    const hero = n === opts.hero;
    return {
      name: hero ? opts.heroLabel : n,
      position: n,
      stack: Math.max(0, opts.stack - b),
      status: status.get(n)!,
      hero,
      cards: hero ? opts.heroCards : null,
      bet: b > 0 ? b : undefined,
      toAct: hero,
    };
  });
  return { seats, pot: 0, history };
}

/** Players who still act after the hero preflop when everyone before has folded or acted. */
export function playersBehind(players: number, hero: string): number {
  const names = seatsFor(players);
  const i = names.indexOf(hero);
  return i < 0 ? 0 : names.length - 1 - i;
}
