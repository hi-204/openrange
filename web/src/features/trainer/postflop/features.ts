// Computed features of a postflop decision, from the solved node and exact equities (D-053).
// Everything is in the solver's frame (board and hands as the solver sees them).

import type { EquityRequest } from '../../../lib/wasm/protocol';

export const RANKS = 'AKQJT98765432';

export type Texture = {
  paired: boolean;
  /** Most cards of one suit on the board. */
  maxSuit: number;
  /** Some three board ranks fit inside a five-rank window (a straight is possible). */
  straightPossible: boolean;
  highCard: string;
};

export function texture(board: string[]): Texture {
  const ranks = board.map((c) => c[0]!);
  const suits = board.map((c) => c[1]!);
  const counts = new Map<string, number>();
  suits.forEach((s) => counts.set(s, (counts.get(s) ?? 0) + 1));
  // Straight ranks 1..14 with the ace also low.
  const values = new Set(ranks.flatMap((r) => (r === 'A' ? [14, 1] : [14 - RANKS.indexOf(r)])));
  let straightPossible = false;
  for (let low = 1; low <= 10; low++) {
    let n = 0;
    for (let v = low; v < low + 5; v++) if (values.has(v)) n++;
    if (n >= 3) straightPossible = true;
  }
  return {
    paired: new Set(ranks).size < ranks.length,
    maxSuit: Math.max(...counts.values()),
    straightPossible,
    highCard: [...ranks].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b))[0]!,
  };
}

/** A weighted range string ("AhKh:0.37, …") from a hand list and reach weights. */
export function rangeText(hands: string[], weights: number[], min = 1e-6): string {
  return hands
    .flatMap((h, i) => (weights[i]! > min ? [`${h}:${Math.min(1, weights[i]!).toFixed(6)}`] : []))
    .join(', ');
}

export function equityRequest(ranges: [string, string], board: string[]): EquityRequest {
  return { ranges, board: board.join(' '), dead: '', mode: 'exact' };
}

/** Amount to call, pot after calling, the price in equity, and the minimum defence frequency. */
export function price(pot: number, committed: [number, number], hero: 0 | 1) {
  const villain = 1 - hero;
  const toCall = Math.max(0, committed[villain]! - committed[hero]!);
  const potAfterCall = pot + toCall;
  return {
    toCall,
    potAfterCall,
    required: toCall > 0 ? toCall / potAfterCall : 0,
    // The opponent risks its whole street commitment to win the rest of the pot.
    mdf: toCall > 0 ? 1 - committed[villain]! / pot : 1,
  };
}

/** Hero's remaining stack: starting stack minus what it has put in since the spot started. */
export function remainingStack(startStack: number, startPot: number, pot: number, committed: [number, number], hero: 0 | 1): number {
  // Earlier streets were closed with equal contributions.
  const earlier = (pot - startPot - committed[0] - committed[1]) / 2;
  return startStack - earlier - committed[hero];
}

export type ComboEq = { combo: string; weight: number; equity: number };

/** Weighted average equity and the weight share of combos at or above `nut` equity. */
export function rangeSummary(perCombo: ComboEq[], nut: number) {
  let w = 0;
  let e = 0;
  let strong = 0;
  for (const c of perCombo) {
    w += c.weight;
    e += c.weight * c.equity;
    if (c.equity >= nut) strong += c.weight;
  }
  return { equity: w > 0 ? e / w : 0.5, nutShare: w > 0 ? strong / w : 0 };
}
