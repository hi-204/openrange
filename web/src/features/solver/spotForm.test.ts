import { describe, expect, it } from 'vitest';
import { activeStreets, PRESETS, toSpot } from './spotForm';

describe('spot form', () => {
  it('shows only the streets a board still has to play', () => {
    expect(activeStreets('Qs Jh 4d')).toEqual(['flop', 'turn', 'river']);
    expect(activeStreets('QsJh4d7c')).toEqual(['turn', 'river']);
    expect(activeStreets('Qs Jh 4d 7c 2s')).toEqual(['river']);
  });

  it('builds per-street sizes and raise caps', () => {
    const spot = toSpot(PRESETS.turn);
    expect(spot.sizes.turn!.ip.bet).toBe('50, 100');
    expect(spot.maxRaises).toEqual({ flop: 1, turn: 1, river: 0 });
    expect(spot.allInThreshold).toBeCloseTo(0.67);
  });
});
