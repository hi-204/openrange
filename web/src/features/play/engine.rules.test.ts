// Poker rules for the playing modes (D-090): full-ring seating and tricky side pots. Hand
// strengths are injected per player so each outcome is exact.
import { describe, expect, it } from 'vitest';
import { act, needsShowdown, newHand, settle, type GameState } from './engine';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
/** Strength by seat: `ranks[i]` for seat i (higher wins), looked up by the seat's hole cards. */
const byRank = (s: GameState, ranks: number[]) => (cards: string) => ranks[s.seats.findIndex((p) => cards.startsWith(p.cards.join('')))]!;
const total = (s: GameState) => s.seats.reduce((a, p) => a + p.stack, 0);

describe('poker rules', () => {
  it('seats a full ring: positions, blinds and first to act', () => {
    const s = newHand({ names: names(9), stacks: new Array(9).fill(100), hero: 0, button: 0, seed: 4 });
    expect(s.seats.map((p) => p.position)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO']);
    expect(s.bets.slice(0, 3)).toEqual([0, 0.5, 1]);
    expect(s.toAct).toBe(3);
    expect(() => newHand({ names: names(10), stacks: new Array(10).fill(100), hero: 0, button: 0, seed: 4 })).toThrow();
  });

  it('three all-ins of different sizes make a main pot and two side pots', () => {
    // Stacks 10 / 30 / 60 / 100; everyone all-in or calling. P0 best, then P1, P2, P3.
    let s = newHand({ names: names(4), stacks: [10, 30, 60, 100], hero: 0, button: 3, seed: 5 });
    // Button 3: SB = P0, BB = P1, first to act is P2.
    s = act(s, { kind: 'raise', to: 60 }); // P2 all-in
    s = act(s, { kind: 'call' }); // P3 calls 60
    s = act(s, { kind: 'call' }); // P0 all-in for 10
    s = act(s, { kind: 'call' }); // P1 all-in for 30
    expect(needsShowdown(s)).toBe(true);
    const before = total(s) + s.contributed.reduce((a, b) => a + b, 0);
    const end = settle(s, byRank(s, [4, 3, 2, 1]));
    // Main pot 4 × 10 = 40 to P0; side pot 1: 3 × 20 = 60 to P1; side pot 2: 2 × 30 = 60 to P2.
    expect(end.collected).toEqual([40, 60, 60, 0]);
    expect(end.seats.map((p) => p.stack)).toEqual([40, 60, 60, 40]);
    expect(total(end)).toBeCloseTo(before, 9);
  });

  it('a tie inside a side pot splits that pot only', () => {
    let s = newHand({ names: names(3), stacks: [20, 50, 50], hero: 0, button: 2, seed: 6 });
    // Button 2: SB = P0, BB = P1, P2 acts first.
    s = act(s, { kind: 'raise', to: 50 }); // P2 all-in
    s = act(s, { kind: 'call' }); // P0 all-in for 20
    s = act(s, { kind: 'call' }); // P1 all-in for 50
    // P0 best; P1 and P2 tie for the side pot.
    const end = settle(s, byRank(s, [9, 5, 5]));
    // Main pot 3 × 20 = 60 to P0; side pot 2 × 30 = 60 split 30 / 30.
    expect(end.collected).toEqual([60, 30, 30]);
  });

  it('chips of a player who folds stay in the pots they reached', () => {
    let s = newHand({ names: names(3), stacks: [100, 15, 100], hero: 0, button: 0, seed: 7 });
    // Button 0 acts first three-handed; SB = P1, BB = P2.
    s = act(s, { kind: 'raise', to: 40 }); // P0
    s = act(s, { kind: 'call' }); // P1 all-in for 15
    s = act(s, { kind: 'call' }); // P2 calls 40
    // Flop: P2 bets, P0 folds; P1 (all-in) and P2 go to showdown.
    s = act(s, { kind: 'raise', to: 20 }); // P2 bets 20
    s = act(s, { kind: 'fold' }); // P0 folds
    expect(needsShowdown(s)).toBe(true);
    // P1 has the best hand: wins the main pot only (3 × 15 = 45); P2 gets the rest.
    const end = settle(s, byRank(s, [1, 9, 5]));
    expect(end.collected[1]).toBeCloseTo(45, 9);
    expect(end.collected[2]).toBeCloseTo(25 + 25 + 0, 9); // P0's 25 and P2's 25 above 15; P2's uncalled 20 back
    expect(end.collected[0]).toBe(0);
  });
});
