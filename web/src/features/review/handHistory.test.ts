// Hand-history parsing on original sample hands written for these tests (not real histories).
import { describe, expect, it } from 'vitest';
import { parseFile, parseHand, positions, splitHands } from './handHistory';
import { GG, STARS } from './samples';

describe('hand-history parsing', () => {
  it('splits a file into hands', () => {
    expect(splitHands(`${STARS}\n\n\n${GG}`)).toHaveLength(2);
  });

  it('PokerStars: seats, positions, hero, board, actions in bb, all-in and winnings', () => {
    const h = parseHand(STARS);
    expect(h.site).toBe('PokerStars');
    expect(h.id).toBe('100000000001');
    expect(h.bigBlind).toBe(1);
    expect(h.hero).toBe('Hero');
    expect(h.heroCards).toEqual(['Ah', 'Kd']);
    expect(h.board).toEqual(['Qs', 'Jh', '7d', 'Tc', '2s']);
    expect(h.seats.find((s) => s.name === 'Hero')!.position).toBe('CO');
    expect(h.seats.find((s) => s.name === 'Fox Trot')!.position).toBe('BB');
    expect(h.seats.find((s) => s.name === 'Bravo')!.stack).toBe(120.5);
    const pre = h.actions.filter((a) => a.street === 'preflop' && a.kind !== 'post');
    expect(pre.map((a) => `${a.player} ${a.kind}`)).toEqual(['Alpha fold', 'Bravo fold', 'Hero raise', 'Delta fold', 'Echo fold', 'Fox Trot call']);
    expect(pre[2]).toMatchObject({ amount: 2.5, to: 2.5 });
    const flopRaise = h.actions.find((a) => a.street === 'flop' && a.kind === 'raise')!;
    expect(flopRaise).toMatchObject({ player: 'Fox Trot', amount: 6, to: 6 });
    const shove = h.actions.find((a) => a.street === 'turn' && a.kind === 'raise')!;
    expect(shove).toMatchObject({ player: 'Hero', amount: 30, allIn: true });
    expect(h.collected.Hero).toBe(76.5);
    expect(h.shown['Fox Trot']).toEqual(['Qd', 'Jd']);
  });

  it('GGPoker: blinds in bb, an uncalled bet comes off the pot, summary winnings', () => {
    const h = parseHand(GG);
    expect(h.site).toBe('GGPoker');
    expect(h.bigBlind).toBe(0.5);
    expect(h.hero).toBe('Hero');
    expect(h.seats.map((s) => s.position)).toEqual(['BTN', 'SB', 'BB']);
    const raise = h.actions.find((a) => a.player === 'zz9' && a.kind === 'raise')!;
    expect(raise).toMatchObject({ amount: 7.5, to: 8.5 }); // $4.25 is 8.5 bb; 1 bb was already posted
    const bet = h.actions.find((a) => a.street === 'flop' && a.kind === 'bet')!;
    expect(bet.amount).toBe(0); // uncalled, returned
    expect(h.collected.zz9).toBe(17.5);
  });

  it('reports hands it cannot read instead of guessing', () => {
    const bad = `PokerStars Hand #1: Omaha Pot Limit ($0.50/$1.00 USD)\nTable 'X' 6-max Seat #1 is the button\n`;
    const r = parseFile(`${bad}\n${GG}`);
    expect(r.hands).toHaveLength(1);
    expect(r.errors[0]!.reason).toMatch(/No-Limit Hold'em/);
  });

  it('positions go clockwise from the button', () => {
    // Seats 1, 2, 3, 5 and 6 with the button on 5: BTN 5, SB 6, BB 1, then UTG 2 and CO 3.
    const p = positions([1, 2, 3, 5, 6], 5);
    expect([...p.entries()].sort((a, b) => a[0] - b[0])).toEqual([
      [1, 'BB'],
      [2, 'UTG'],
      [3, 'CO'],
      [5, 'BTN'],
      [6, 'SB'],
    ]);
  });
});
