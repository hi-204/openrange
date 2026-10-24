import { describe, expect, it } from 'vitest';
import { cellCombos, cellName, cellOf } from './hands';

describe('grid cells', () => {
  it('match the solver-core layout', () => {
    expect(cellName(cellOf('AhKh').index)).toBe('AKs');
    expect(cellName(cellOf('KdAh').index)).toBe('AKo');
    expect(cellName(cellOf('7c7d').index)).toBe('77');
    expect(cellOf('AsAh').index).toBe(0);
    expect(cellOf('2c2d').index).toBe(168);
    expect(cellOf('AhKh')).toEqual({ row: 0, col: 1, index: 1 });
    expect(cellOf('AhKd')).toEqual({ row: 1, col: 0, index: 13 });
  });

  it('count 1326 combos over the grid', () => {
    let total = 0;
    for (let i = 0; i < 169; i++) total += cellCombos(i);
    expect(total).toBe(1326);
  });
});
