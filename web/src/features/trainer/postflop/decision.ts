// Everything about one hero decision in a postflop drill: grade, features and claims.

import type { EquityRequest, EquityResult } from '../../../lib/wasm/protocol';
import type { Claim } from '../explain/claims';
import { postflopClaims, type PostflopContext } from '../explain/postflop';
import { grade, type Grade, type Thresholds } from '../grading';
import { equityRequest, price, rangeText, type ComboEq } from './features';
import { OFF_PATH_REACH, type ActionNode, type PostflopHand } from './hand';

export type EquityFn = (req: EquityRequest) => Promise<EquityResult>;

export type DecisionResult = { ctx: PostflopContext; grade: Grade | null; claims: Claim[] };

async function exact(equity: EquityFn, ranges: [string, string], board: string[]) {
  if (!ranges[0] || !ranges[1]) return null;
  const r = await equity(equityRequest(ranges, board));
  if (!r.ok || r.method !== 'exact') return null;
  return r;
}

export async function decide(
  hand: PostflopHand,
  node: ActionNode,
  chosen: number,
  opts: { exploitabilityPct: number; thresholds?: Thresholds; equity: EquityFn },
): Promise<DecisionResult> {
  const hero = hand.heroSeat;
  const villain = (1 - hero) as 0 | 1;
  const info = hand.info;
  const n = info.hands[hero].length;
  const hi = hand.heroIndex();
  const ev = node.actions.map((_, a) => node.evBb[a * n + hi] ?? null);
  const strategy = node.actions.map((_, a) => node.strategy[a * n + hi]!);
  const reachShare = hand.heroReachShare(node);
  const offPath = reachShare < OFF_PATH_REACH;
  const g = offPath
    ? null
    : grade({ ev, strategy, chosen, unit: 'pctPot', potBb: node.pot, noiseFloorPct: opts.exploitabilityPct, thresholds: opts.thresholds });
  const heroCombo = info.hands[hero][hi]!;
  const villainText = rangeText(info.hands[villain], node.reach[villain]);
  const heroText = rangeText(info.hands[hero], node.reach[hero]);
  const single = await exact(opts.equity, [heroCombo, villainText], node.board);
  const rvr = await exact(opts.equity, [heroText, villainText], node.board);
  const perCombo = (i: number): ComboEq[] | null => (rvr && rvr.method === 'exact' ? rvr.players[i]!.perCombo : null);

  const committed: [number, number] = [node.committed[0], node.committed[1]];
  const fold = node.actions.indexOf('Fold');
  let heroDefend: number | null = null;
  if (price(node.pot, committed, hero).toCall > 0 && fold >= 0) {
    const reach = node.reach[hero];
    let w = 0;
    let stay = 0;
    for (let h = 0; h < n; h++) {
      w += reach[h]!;
      stay += reach[h]! * (1 - node.strategy[fold * n + h]!);
    }
    heroDefend = w > 0 ? stay / w : null;
  }

  const ctx: PostflopContext = {
    actions: node.actions,
    ev,
    strategy,
    chosen,
    grade: g,
    reachShare,
    offPath,
    street: node.street,
    board: node.board,
    pot: node.pot,
    committed,
    heroSeat: hero,
    startStack: info.spot.stack,
    startPot: info.spot.pot,
    exploitabilityPct: opts.exploitabilityPct,
    heroCombo,
    heroEquity: single && single.method === 'exact' ? single.players[0]!.equity : null,
    heroRange: perCombo(0),
    villainRange: perCombo(1),
    heroDefend,
  };
  return { ctx, grade: g, claims: postflopClaims(ctx) };
}
