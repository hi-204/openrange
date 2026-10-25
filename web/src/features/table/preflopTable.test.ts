import { describe, expect, it } from 'vitest';
import { playersBehind, preflopTable, seatsFor } from './preflopTable';

describe('preflop table picture', () => {
  it('lays out seats for each table size', () => {
    expect(seatsFor(2)).toEqual(['SB', 'BB']);
    expect(seatsFor(3)).toEqual(['BTN', 'SB', 'BB']);
    expect(seatsFor(6)).toEqual(['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB']);
    expect(seatsFor(9)).toHaveLength(9);
  });

  it('applies the action line: folds, raises, all-ins and blinds', () => {
    const p = preflopTable({ players: 6, stack: 100, line: 'UTG fold, HJ raise 2.5, CO fold', hero: 'BTN', heroCards: ['Ah', 'Kd'], heroLabel: 'You' });
    const by = Object.fromEntries(p.seats.map((s) => [s.position, s]));
    expect(by.UTG!.status).toBe('folded');
    expect(by.HJ!.bet).toBe(2.5);
    expect(by.HJ!.stack).toBe(97.5);
    expect(by.SB!.bet).toBe(0.5);
    expect(by.BB!.bet).toBe(1);
    expect(by.BTN).toMatchObject({ hero: true, toAct: true, name: 'You', cards: ['Ah', 'Kd'] });
    expect(p.history).toEqual(['UTG folds', 'HJ raises to 2.5 bb', 'CO folds']);
    const shove = preflopTable({ players: 3, stack: 10, line: 'BTN fold, SB all-in 10', hero: 'BB', heroCards: ['7c', '7d'], heroLabel: 'You' });
    expect(shove.seats.find((s) => s.position === 'SB')).toMatchObject({ status: 'allin', stack: 0, bet: 10 });
  });

  it('counts players still to act', () => {
    expect(playersBehind(6, 'UTG')).toBe(5);
    expect(playersBehind(6, 'BTN')).toBe(2);
    expect(playersBehind(6, 'BB')).toBe(0);
    expect(playersBehind(2, 'SB')).toBe(1);
  });
});
