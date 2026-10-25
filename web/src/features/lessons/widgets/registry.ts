// Widget names and config checks (D-060). Pure so the lesson lint can run in Node; the React
// components live next to this file.

type Check = (c: Record<string, unknown>) => string[];

const str = (c: Record<string, unknown>, k: string, required = true): string[] =>
  c[k] === undefined ? (required ? [`missing "${k}"`] : []) : typeof c[k] === 'string' ? [] : [`"${k}" must be text`];
const num = (c: Record<string, unknown>, k: string, required = true): string[] =>
  c[k] === undefined ? (required ? [`missing "${k}"`] : []) : typeof c[k] === 'number' && Number.isFinite(c[k]) ? [] : [`"${k}" must be a number`];
const cards = (c: Record<string, unknown>, k: string, counts: number[], required = true): string[] => {
  const e = str(c, k, required);
  if (e.length || c[k] === undefined) return e;
  const n = String(c[k]).replace(/\s+/g, '').length / 2;
  return counts.includes(n) && /^([2-9TJQKA][cdhs])+$/.test(String(c[k]).replace(/\s+/g, '')) ? [] : [`"${k}" must be ${counts.join(' or ')} cards like "AhKd"`];
};

export const WIDGETS: Record<string, Check> = {
  ranker: (c) => (c.hands === undefined || (Array.isArray(c.hands) && c.hands.every((h) => typeof h === 'string')) ? [] : ['"hands" must be a list of card strings']),
  board: (c) => [...cards(c, 'hand', [2], false), ...cards(c, 'board', [3, 4, 5], false)],
  outs: (c) => [...cards(c, 'hero', [2]), ...cards(c, 'villain', [2]), ...cards(c, 'board', [3, 4])],
  combos: (c) => [...str(c, 'hand'), ...cards(c, 'dead', [1, 2, 3, 4, 5, 6, 7], false)],
  potodds: (c) => [...num(c, 'pot'), ...num(c, 'bet'), ...num(c, 'equity', false)],
  ev: (c) =>
    Array.isArray(c.outcomes) && c.outcomes.every((o) => o && typeof o === 'object' && typeof (o as { p: unknown }).p === 'number' && typeof (o as { value: unknown }).value === 'number')
      ? []
      : ['"outcomes" must be a list of {label, p, value}'],
  spr: (c) => [...num(c, 'stack'), ...num(c, 'pot')],
  sizing: (c) => [...num(c, 'pot'), ...num(c, 'bet')],
  grid: (c) => str(c, 'range'),
  chart: (c) => [...str(c, 'file'), ...str(c, 'chart')],
  advantage: (c) => [...str(c, 'a'), ...str(c, 'b'), ...cards(c, 'board', [3, 4, 5])],
  equity: (c) => [...(Array.isArray(c.ranges) && c.ranges.length === 2 ? [] : ['"ranges" must be two ranges']), ...cards(c, 'board', [0, 3, 4, 5], false)],
  table: (c) => (c.highlight === undefined || Array.isArray(c.highlight) ? [] : ['"highlight" must be a list of seats']),
  handflow: () => [],
  minisolver: (c) => str(c, 'spot'),
};
