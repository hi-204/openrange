/** Format a probability in [0, 1] as a percentage, e.g. 0.8523 → "85.23%". */
export function pct(x: number, digits = 2): string {
  return `${(x * 100).toFixed(digits)}%`;
}

/** Thousands separators for counts. */
export function count(n: number): string {
  return n.toLocaleString('en-US');
}
