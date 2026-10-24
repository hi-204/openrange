// Display helpers for the 13×13 hand grid. Poker logic itself lives in Rust; this only maps
// combo strings (e.g. "AhKd") to grid cells, using the same layout as solver-core:
// rows/columns A..2, pairs on the diagonal, suited above it, offsuit below.

export const RANKS = 'AKQJT98765432';

export type Cell = { row: number; col: number; index: number };

export function cellOf(combo: string): Cell {
  const a = RANKS.indexOf(combo[0]!.toUpperCase());
  const b = RANKS.indexOf(combo[2]!.toUpperCase());
  const suited = combo[1] === combo[3];
  const [hi, lo] = a <= b ? [a, b] : [b, a];
  const [row, col] = hi === lo ? [hi, hi] : suited ? [hi, lo] : [lo, hi];
  return { row, col, index: row * 13 + col };
}

export function cellName(index: number): string {
  const row = Math.floor(index / 13);
  const col = index % 13;
  if (row === col) return RANKS[row]! + RANKS[row]!;
  return row < col ? `${RANKS[row]}${RANKS[col]}s` : `${RANKS[col]}${RANKS[row]}o`;
}

/** Number of combos in a grid cell before card removal: 6 pairs, 4 suited, 12 offsuit. */
export function cellCombos(index: number): number {
  const row = Math.floor(index / 13);
  const col = index % 13;
  return row === col ? 6 : row < col ? 4 : 12;
}
