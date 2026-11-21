// Math Lab on a solved river spot (D-087): MDF and bluff share next to what the solution does,
// and a bet-sizing trainer that grades a size by its EV for one hand. Pure functions over solver
// nodes, so tests can run them on the same spot solved by the WASM engine.

import type { EquityRequest, EquityResult, SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { rangeText } from '../trainer/postflop/features';

export type NodeSource = (path: number[]) => Promise<SolverNode>;
export type EquityFn = (req: EquityRequest) => Promise<EquityResult>;
type ActionNode = SolverNode & { kind: 'action' };

const isAction = (n: SolverNode): n is ActionNode => n.kind === 'action';
const at = (n: ActionNode, a: number, h: number, hands: number) => n.strategy[a * hands + h]!;

export type SizeRow = {
  /** The bet as a share of the pot before it. */
  fraction: number;
  pot: number;
  bet: number;
  /** How often the bettor's range bets this size. */
  betFrequency: number;
  /** P ÷ (P + B). */
  mdf: number;
  /** Share of the defender's range that calls or raises. */
  defend: number;
  /** B ÷ (P + 2B). */
  bluffTheory: number;
  /** Share of the betting range with under 50% equity against the hands that continue; null if nobody continues. */
  bluffShare: number | null;
};

/**
 * For each bet size at `path` (a node where `bettor` acts first on the river): the defender's
 * response compared with MDF, and the bettor's bluff share compared with B ÷ (P + 2B).
 */
export async function sizeRows(info: SolverInfo, source: NodeSource, equity: EquityFn, path: number[]): Promise<SizeRow[]> {
  const node = await source(path);
  if (!isAction(node)) throw new Error('not a decision');
  const bettor = node.player;
  const defender = (1 - bettor) as 0 | 1;
  const nb = info.hands[bettor].length;
  const nd = info.hands[defender].length;
  const rows: SizeRow[] = [];
  const totalReach = node.reach[bettor].reduce((s, x) => s + x, 0);
  for (let a = 0; a < node.actions.length; a++) {
    if (!node.aggressive[a]) continue;
    const facing = await source([...path, a]);
    if (!isAction(facing)) continue;
    const pot = node.pot;
    const bet = facing.committed[bettor] - node.committed[bettor];
    const betting = node.reach[bettor].map((r, h) => r * at(node, a, h, nb));
    const betFrequency = betting.reduce((s, x) => s + x, 0) / totalReach;
    const fold = facing.actions.findIndex((x) => /^fold/i.test(x));
    const reachD = facing.reach[defender];
    const cont = reachD.map((r, h) => r * (1 - (fold >= 0 ? at(facing, fold, h, nd) : 0)));
    const defend = cont.reduce((s, x) => s + x, 0) / reachD.reduce((s, x) => s + x, 0);
    let bluffShare: number | null = null;
    if (cont.some((x) => x > 1e-9) && betting.some((x) => x > 1e-9)) {
      const r = await equity({ ranges: [rangeText(info.hands[bettor], betting), rangeText(info.hands[defender], cont)], board: node.board.join(''), dead: '', mode: 'exact' });
      if (!r.ok || r.method !== 'exact') throw new Error('exact river equity failed');
      const per = r.players[0]!.perCombo;
      const total = per.reduce((s, c) => s + c.weight, 0);
      bluffShare = per.filter((c) => c.equity < 0.5).reduce((s, c) => s + c.weight, 0) / total;
    }
    rows.push({ fraction: bet / pot, pot, bet, betFrequency, mdf: pot / (pot + bet), defend, bluffTheory: bet / (pot + 2 * bet), bluffShare });
  }
  return rows;
}

export type SizingProblem = { seat: 0 | 1; path: number[]; hand: string; actions: string[]; ev: number[]; strategy: number[] };

/**
 * A hand for the sizing trainer: drawn by how often it reaches the decision at `path`, among
 * hands with an EV for every action.
 */
export async function sizingProblem(info: SolverInfo, source: NodeSource, path: number[], rnd: () => number): Promise<SizingProblem> {
  const node = await source(path);
  if (!isAction(node)) throw new Error('not a decision');
  const n = info.hands[node.player].length;
  const k = node.actions.length;
  const ok = (h: number) => node.reach[node.player][h]! > 1e-6 && Array.from({ length: k }, (_, a) => node.evBb[a * n + h]).every((x) => x !== null);
  const weights = node.reach[node.player].map((r, h) => (ok(h) ? r : 0));
  const total = weights.reduce((s, x) => s + x, 0);
  let u = rnd() * total;
  let h = weights.findIndex((w) => (u -= w) < 0);
  if (h < 0) h = weights.findIndex((w) => w > 0);
  return {
    seat: node.player,
    path,
    hand: info.hands[node.player][h]!,
    actions: node.actions,
    ev: Array.from({ length: k }, (_, a) => node.evBb[a * n + h]!),
    strategy: Array.from({ length: k }, (_, a) => at(node, a, h, n)),
  };
}
