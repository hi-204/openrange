// Aggregated flop report helpers (D-077): group the per-flop results by texture.

import { texture } from '../trainer/postflop/features';

export type FlopRow = {
  board: string;
  iterations: number;
  exploitabilityPctPot: number;
  bbFirst: Record<string, number>;
  btnAfterCheck: Record<string, number>;
  bbVsCbet: Record<string, number>;
  btnEquity: number;
};

export type ReportFile = {
  provenance: import('../../lib/provenance/types').Provenance;
  spot: { name: string; oop: string; ip: string; pot: number; stack: number; raises: number; sizes: Record<string, number> };
  flops: FlopRow[];
};

/** Sum of the frequencies of the actions matching `re` (e.g. every bet size). */
export const share = (m: Record<string, number>, re: RegExp) => Object.entries(m).reduce((s, [k, v]) => s + (re.test(k) ? v : 0), 0);

export const cbet = (r: FlopRow) => share(r.btnAfterCheck, /^(Bet|All-in)/);
export const lead = (r: FlopRow) => share(r.bbFirst, /^(Bet|All-in)/);
export const foldVsCbet = (r: FlopRow) => share(r.bbVsCbet, /^Fold/);

const HIGH = (rank: string) => (rank === 'A' ? 'A' : rank === 'K' ? 'K' : rank === 'Q' ? 'Q' : 'JT'.includes(rank) ? 'J-T' : '9-');

/** The texture groups a flop belongs to. */
export function groupsOf(board: string): { highCard: string; suits: 'rainbow' | 'twotone' | 'monotone'; paired: boolean; straight: boolean } {
  const cards = board.split(/\s+/);
  const tex = texture(cards);
  return { highCard: HIGH(tex.highCard), suits: tex.maxSuit === 3 ? 'monotone' : tex.maxSuit === 2 ? 'twotone' : 'rainbow', paired: tex.paired, straight: tex.straightPossible };
}

export type Group = { key: string; flops: number; cbet: number; lead: number; fold: number; equity: number };

/** Averages per group (each flop counts once). */
export function summarize(rows: FlopRow[], keyOf: (r: FlopRow) => string): Group[] {
  const by = new Map<string, FlopRow[]>();
  for (const r of rows) by.set(keyOf(r), [...(by.get(keyOf(r)) ?? []), r]);
  const avg = (xs: FlopRow[], f: (r: FlopRow) => number) => xs.reduce((s, r) => s + f(r), 0) / xs.length;
  return [...by.entries()].map(([key, xs]) => ({ key, flops: xs.length, cbet: avg(xs, cbet), lead: avg(xs, lead), fold: avg(xs, foldVsCbet), equity: avg(xs, (r) => r.btnEquity) }));
}
