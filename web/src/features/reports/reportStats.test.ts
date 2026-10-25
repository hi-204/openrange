import { describe, expect, it } from 'vitest';
import { cbet, foldVsCbet, groupsOf, lead, summarize, type FlopRow } from './reportStats';

const row = (board: string, bet: number, eq: number): FlopRow => ({
  board,
  iterations: 50,
  exploitabilityPctPot: 0.5,
  bbFirst: { Check: 0.9, 'Bet 1.82': 0.1 },
  btnAfterCheck: { Check: 1 - bet, 'Bet 1.82': bet },
  bbVsCbet: { Fold: 0.4, Call: 0.6 },
  btnEquity: eq,
});

describe('flop report grouping', () => {
  it('reads frequencies by action type', () => {
    const r = row('Ks 7d 2c', 0.8, 0.6);
    expect(cbet(r)).toBe(0.8);
    expect(lead(r)).toBe(0.1);
    expect(foldVsCbet(r)).toBe(0.4);
  });

  it('classifies textures', () => {
    expect(groupsOf('Ks 7d 2c')).toEqual({ highCard: 'K', suits: 'rainbow', paired: false, straight: false });
    expect(groupsOf('Jh Th 9s')).toEqual({ highCard: 'J-T', suits: 'twotone', paired: false, straight: true });
    expect(groupsOf('8s 8d 3c')).toMatchObject({ highCard: '9-', paired: true });
    expect(groupsOf('Ah 9h 4h').suits).toBe('monotone');
  });

  it('averages each group, each flop counted once', () => {
    const g = summarize([row('Ks 7d 2c', 0.8, 0.6), row('Kh 9d 4c', 0.6, 0.5), row('As 7d 2c', 1, 0.7)], (r) => groupsOf(r.board).highCard);
    const k = g.find((x) => x.key === 'K')!;
    expect(k.flops).toBe(2);
    expect(k.cbet).toBeCloseTo(0.7, 12);
    expect(k.equity).toBeCloseTo(0.55, 12);
  });
});
