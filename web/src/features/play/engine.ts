// No-Limit Hold'em game engine for play mode (D-079). Pure and deterministic: a seeded deck,
// blinds 0.5/1 (amounts in bb), the full-raise rule, side pots and showdowns. The hand
// evaluator is injected (the WASM evaluator in the app and in tests).

import type { HandAction, Street } from '../review/handHistory';
import { mulberry32 } from '../trainer/preflop/deal';

export const DECK = [...'23456789TJQKA'].flatMap((r) => [...'cdhs'].map((s) => r + s));

export type Seat = { name: string; position: string; stack: number; cards: string[]; folded: boolean; allIn: boolean; hero: boolean };

export type GameState = {
  seats: Seat[];
  /** Index of the button. */
  button: number;
  street: Street;
  board: string[];
  deck: string[];
  /** Total each player has put in this hand, and this street. */
  contributed: number[];
  bets: number[];
  currentBet: number;
  /** Size of the last full raise (the minimum raise increment). */
  lastRaise: number;
  /** Has acted since the last full raise (then a raise isn't reopened for them). */
  acted: boolean[];
  toAct: number | null;
  history: HandAction[];
  ante: number;
  rake: { percent: number; capBb: number } | null;
  done: boolean;
  /** Set when the hand is over: what each player collected, and the cards shown. */
  collected: number[];
  shown: boolean[];
  rakeTaken: number;
};

export type Move = { kind: 'fold' } | { kind: 'check' } | { kind: 'call' } | { kind: 'raise'; to: number };

export type Legal = { fold: boolean; check: boolean; call: number | null; minTo: number | null; maxTo: number | null };

const POSITIONS: Record<number, string[]> = {
  2: ['BTN', 'BB'],
  3: ['BTN', 'SB', 'BB'],
  4: ['BTN', 'SB', 'BB', 'CO'],
  5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
  6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
};

const round = (x: number) => Math.round(x * 1e6) / 1e6;

export function shuffled(seed: number): string[] {
  const rnd = mulberry32(seed);
  const d = [...DECK];
  for (let i = d.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [d[i], d[j]] = [d[j]!, d[i]!];
  }
  return d;
}

/** Seats clockwise from the button get BTN, SB, BB, … (heads-up: the button is the SB). */
export function newHand(opts: { names: string[]; stacks: number[]; hero: number; button: number; seed: number; ante?: number; rake?: { percent: number; capBb: number } | null }): GameState {
  const n = opts.names.length;
  if (n < 2 || n > 6) throw new Error('play mode supports 2 to 6 players');
  const deck = shuffled(opts.seed);
  const names = POSITIONS[n]!;
  const seats: Seat[] = opts.names.map((name, i) => ({ name, position: names[(i - opts.button + n) % n]!, stack: opts.stacks[i]!, cards: [], folded: false, allIn: false, hero: i === opts.hero }));
  // Deal two cards each, starting left of the button.
  for (let r = 0; r < 2; r++) for (let k = 1; k <= n; k++) seats[(opts.button + k) % n]!.cards.push(deck.shift()!);
  const s: GameState = {
    seats,
    button: opts.button,
    street: 'preflop',
    board: [],
    deck,
    contributed: new Array(n).fill(0),
    bets: new Array(n).fill(0),
    currentBet: 0,
    lastRaise: 1,
    acted: new Array(n).fill(false),
    toAct: null,
    history: [],
    ante: opts.ante ?? 0,
    rake: opts.rake ?? null,
    done: false,
    collected: new Array(n).fill(0),
    shown: new Array(n).fill(false),
    rakeTaken: 0,
  };
  const pay = (i: number, amount: number, count: boolean) => {
    const a = Math.min(amount, s.seats[i]!.stack);
    s.seats[i]!.stack = round(s.seats[i]!.stack - a);
    s.contributed[i] = round(s.contributed[i]! + a);
    if (count) s.bets[i] = round(s.bets[i]! + a);
    if (s.seats[i]!.stack <= 0) s.seats[i]!.allIn = true;
    s.history.push({ street: 'preflop', player: s.seats[i]!.name, kind: 'post', amount: a, allIn: s.seats[i]!.allIn });
  };
  if (s.ante > 0) for (let i = 0; i < n; i++) pay(i, s.ante, false);
  const sb = n === 2 ? opts.button : (opts.button + 1) % n;
  const bb = (sb + 1) % n;
  pay(sb, 0.5, true);
  pay(bb, 1, true);
  s.currentBet = Math.max(...s.bets);
  s.toAct = nextToAct(s, bb);
  if (s.toAct === null) runOut(s);
  return s;
}

/** The next player after `from` who still has a decision, or null if the round is over. */
function nextToAct(s: GameState, from: number): number | null {
  const n = s.seats.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k) % n;
    const p = s.seats[i]!;
    if (p.folded || p.allIn) continue;
    if (!s.acted[i] || s.bets[i]! < s.currentBet) return i;
  }
  return null;
}

const live = (s: GameState) => s.seats.map((p, i) => ({ p, i })).filter(({ p }) => !p.folded);

export function legal(s: GameState): Legal {
  if (s.toAct === null || s.done) return { fold: false, check: false, call: null, minTo: null, maxTo: null };
  const i = s.toAct;
  const p = s.seats[i]!;
  const toCall = round(s.currentBet - s.bets[i]!);
  const maxTo = round(s.bets[i]! + p.stack);
  // Others who can still act (a raise needs someone to answer it).
  const others = s.seats.some((q, j) => j !== i && !q.folded && !q.allIn);
  const canRaise = others && !s.acted[i] && maxTo > s.currentBet;
  const minTo = canRaise ? Math.min(maxTo, round(s.currentBet + s.lastRaise)) : null;
  return { fold: toCall > 0, check: toCall <= 0, call: toCall > 0 ? Math.min(toCall, p.stack) : null, minTo, maxTo: canRaise ? maxTo : null };
}

export function act(prev: GameState, move: Move): GameState {
  const s: GameState = structuredClone(prev);
  const i = s.toAct;
  if (i === null || s.done) throw new Error('nobody is to act');
  const p = s.seats[i]!;
  const l = legal(s);
  const record = (kind: HandAction['kind'], amount: number, to?: number) => s.history.push({ street: s.street, player: p.name, kind, amount, to, allIn: p.allIn });
  const put = (amount: number) => {
    const a = Math.min(amount, p.stack);
    p.stack = round(p.stack - a);
    s.bets[i] = round(s.bets[i]! + a);
    s.contributed[i] = round(s.contributed[i]! + a);
    if (p.stack <= 0) p.allIn = true;
    return a;
  };
  if (move.kind === 'fold') {
    if (!l.fold) throw new Error('nothing to fold to: check instead');
    p.folded = true;
    record('fold', 0);
  } else if (move.kind === 'check') {
    if (!l.check) throw new Error('there is a bet to call');
    record('check', 0);
  } else if (move.kind === 'call') {
    if (l.call === null) throw new Error('nothing to call');
    record('call', put(l.call));
  } else {
    if (l.minTo === null || l.maxTo === null) throw new Error('raising is not allowed here');
    const to = round(Math.min(l.maxTo, Math.max(l.minTo, move.to)));
    const before = s.currentBet;
    const added = put(to - s.bets[i]!);
    const increment = round(to - before);
    // Preflop the blinds are the first bet, so every aggressive action is a raise.
    record(s.street !== 'preflop' && before === 0 ? 'bet' : 'raise', added, to);
    s.currentBet = to;
    // A full raise reopens the betting; a short all-in doesn't (it only has to be called).
    if (increment >= s.lastRaise) {
      s.lastRaise = increment;
      s.acted = s.acted.map((_, j) => j === i);
    }
  }
  s.acted[i] = true;
  advance(s, i);
  return s;
}

function advance(s: GameState, last: number) {
  const players = live(s);
  if (players.length === 1) return finish(s, [players[0]!.i]);
  const next = nextToAct(s, last);
  if (next !== null) {
    s.toAct = next;
    return;
  }
  // Betting round over. Return any uncalled part of the top bet.
  returnUncalled(s);
  const canAct = players.filter(({ p }) => !p.allIn).length;
  if (s.street === 'river' || canAct <= 1) return runOut(s);
  nextStreet(s);
}

function returnUncalled(s: GameState) {
  const sorted = [...s.bets].sort((a, b) => b - a);
  const [top, second] = [sorted[0]!, sorted[1] ?? 0];
  if (top <= second) return;
  const i = s.bets.indexOf(top);
  const back = round(top - second);
  s.bets[i] = second;
  s.contributed[i] = round(s.contributed[i]! - back);
  s.seats[i]!.stack = round(s.seats[i]!.stack + back);
  s.seats[i]!.allIn = false;
  for (let k = s.history.length - 1; k >= 0; k--) {
    const a = s.history[k]!;
    if (a.player === s.seats[i]!.name && a.amount > 0) {
      a.amount = round(Math.max(0, a.amount - back));
      break;
    }
  }
}

function nextStreet(s: GameState) {
  const order: Street[] = ['preflop', 'flop', 'turn', 'river'];
  s.street = order[order.indexOf(s.street) + 1]!;
  s.board.push(...s.deck.splice(0, s.street === 'flop' ? 3 : 1));
  s.bets = s.bets.map(() => 0);
  s.currentBet = 0;
  s.lastRaise = 1;
  s.acted = s.acted.map(() => false);
  s.toAct = nextToAct(s, s.button);
}

/** Deal the rest of the board; the showdown waits for `settle`. */
function runOut(s: GameState) {
  returnUncalled(s);
  while (s.board.length < 5) s.board.push(s.deck.shift()!);
  s.street = 'river';
  s.toAct = null;
}

function finish(s: GameState, winners: number[]) {
  returnUncalled(s);
  const pot = s.contributed.reduce((a, b) => a + b, 0);
  const rake = takeRake(s, pot);
  for (const w of winners) s.collected[w] = round(s.collected[w]! + (pot - rake) / winners.length);
  for (const w of winners) s.seats[w]!.stack = round(s.seats[w]!.stack + (pot - rake) / winners.length);
  s.toAct = null;
  s.done = true;
}

function takeRake(s: GameState, pot: number) {
  // No flop, no drop.
  if (!s.rake || s.board.length < 3) return 0;
  const r = Math.min(s.rake.capBb, (pot * s.rake.percent) / 100);
  s.rakeTaken = round(r);
  return s.rakeTaken;
}

/** True when the hand needs a showdown (all betting is over but several players remain). */
export const needsShowdown = (s: GameState) => !s.done && s.toAct === null && live(s).length > 1;

/** Showdown with side pots, using `strength` (higher is better) for each live player's 7 cards. */
export function settle(prev: GameState, strength: (cards: string) => number): GameState {
  const s: GameState = structuredClone(prev);
  if (!needsShowdown(s)) return s;
  const players = live(s);
  const value = new Map(players.map(({ p, i }) => [i, strength(p.cards.join('') + s.board.join(''))]));
  players.forEach(({ i }) => (s.shown[i] = true));
  const total = s.contributed.reduce((a, b) => a + b, 0);
  const rake = takeRake(s, total);
  // Side pots: each contribution level is won by the best live hand that reached it.
  const levels = [...new Set(s.contributed.filter((c) => c > 0))].sort((a, b) => a - b);
  let prevLevel = 0;
  for (const level of levels) {
    const layer = s.contributed.reduce((a, c) => a + Math.max(0, Math.min(c, level) - prevLevel), 0);
    let eligible = players.filter(({ i }) => s.contributed[i]! >= level).map(({ i }) => i);
    // Chips above every live player's contribution (from players who folded later) go to the
    // live players who put in the most.
    if (!eligible.length) {
      const top = Math.max(...players.map(({ i }) => s.contributed[i]!));
      eligible = players.filter(({ i }) => s.contributed[i] === top).map(({ i }) => i);
    }
    prevLevel = level;
    if (layer <= 0) continue;
    const best = Math.max(...eligible.map((i) => value.get(i)!));
    const winners = eligible.filter((i) => value.get(i) === best);
    const share = (layer * (1 - rake / total)) / winners.length;
    for (const w of winners) s.collected[w] = round(s.collected[w]! + share);
  }
  s.collected.forEach((c, i) => (s.seats[i]!.stack = round(s.seats[i]!.stack + c)));
  s.done = true;
  return s;
}
