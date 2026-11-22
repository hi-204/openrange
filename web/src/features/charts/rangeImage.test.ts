import { describe, expect, it } from 'vitest';
import { cellName } from '../../lib/poker/hands';
import { CELL, gridLayout, HEADER, MARGIN } from './rangeImage';

const classes = Array.from({ length: 169 }, (_, i) => cellName(i));

describe('range image layout', () => {
  it('places classes in grid order and splits each cell by frequency', () => {
    const strategy = classes.map((n) => (n === 'AA' ? [0, 1] : n === 'AKs' ? [0.25, 0.75] : [1, 0]));
    const cells = gridLayout(classes, strategy, ['#ccc', '#e00']);
    expect(cells).toHaveLength(169);
    const aa = cells[0]!;
    expect([aa.x, aa.y]).toEqual([MARGIN, HEADER]);
    expect(aa.segments).toEqual([{ x: MARGIN, w: CELL, color: '#e00' }]);
    const aks = cells[1]!;
    expect(aks.segments.map((s) => s.w)).toEqual([0.25 * CELL, 0.75 * CELL]);
    expect(aks.segments[1]!.x).toBeCloseTo(aks.x + 0.25 * CELL, 9);
    // The last cell (22) is bottom-right.
    expect([cells[168]!.x, cells[168]!.y]).toEqual([MARGIN + 12 * CELL, HEADER + 12 * CELL]);
  });

  it('fades classes that never reach the decision', () => {
    const reach = classes.map((n) => (n === '72o' ? 0 : 1));
    const cells = gridLayout(classes, classes.map(() => [1]), ['#ccc'], reach);
    expect(cells.filter((c) => c.faded).map((c) => c.name)).toEqual(['72o']);
  });
});
