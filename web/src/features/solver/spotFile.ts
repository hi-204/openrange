// Shareable spot files (D-091): the workbench form as JSON, validated on the way back in.

import { STREETS, type Form } from './spotForm';

export const SPOT_FORMAT = 'openrange.spot/1';

export function spotFileText(form: Form): string {
  return `${JSON.stringify({ format: SPOT_FORMAT, spot: form }, null, 2)}\n`;
}

const isStr = (x: unknown): x is string => typeof x === 'string';

/** Parse a spot file; returns the form or a readable reason it can't be used. */
export function parseSpotFile(text: string): { form: Form } | { error: string } {
  let v: unknown;
  try {
    v = JSON.parse(text);
  } catch {
    return { error: 'not a JSON file' };
  }
  const d = v as { format?: unknown; spot?: Record<string, unknown> };
  if (d?.format !== SPOT_FORMAT || !d.spot || typeof d.spot !== 'object') return { error: 'not an OpenRange spot file' };
  const s = d.spot;
  for (const k of ['board', 'pot', 'stack', 'oop', 'ip', 'allIn', 'rake', 'rakeCap', 'target', 'maxIterations', 'budgetMb'] as const) if (!isStr(s[k])) return { error: `"${k}" is missing or not text` };
  if (typeof s.simplify !== 'boolean') return { error: '"simplify" must be true or false' };
  const cards = String(s.board).replace(/\s+/g, '');
  if (!/^([2-9TJQKA][cdhs]){3,5}$/.test(cards)) return { error: 'the board must be 3 to 5 cards like "Qs Jh 4d"' };
  if (new Set(cards.match(/.{2}/g)).size !== cards.length / 2) return { error: 'the board repeats a card' };
  const streets = s.streets as Record<string, Record<string, unknown>> | undefined;
  if (!streets || typeof streets !== 'object') return { error: '"streets" is missing' };
  for (const st of STREETS) {
    const x = streets[st];
    if (!x || !['oopBet', 'oopRaise', 'ipBet', 'ipRaise', 'maxRaises'].every((k) => isStr(x[k]))) return { error: `the ${st} sizes are incomplete` };
  }
  return { form: s as unknown as Form };
}
