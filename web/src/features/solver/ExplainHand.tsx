import { useEffect, useState } from 'react';
import { cellName, cellOf } from '../../lib/poker/hands';
import { useSettings } from '../../lib/settings/useSettings';
import { Skeleton } from '../../lib/ui/components';
import { solverClient } from '../../lib/wasm/client';
import type { SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { buildCoach } from '../coach/coach';
import { CoachCard, type MathRow } from '../coach/CoachCard';
import { fmtBb, renderClaim } from '../trainer/explain/render';
import { decideAt, type DecisionResult } from '../trainer/postflop/decision';

type ActionNode = Extract<SolverNode, { kind: 'action' }>;

/** "Explain this node" for one hand: the coaching card for the solution's main play. */
export function ExplainHand({ info, node, hand, exploitabilityPct, rootReach }: { info: SolverInfo; node: ActionNode; hand: number; exploitabilityPct: number; rootReach?: number[][] }) {
  const detail = useSettings((s) => s.settings.coaching.detail);
  const [r, setR] = useState<DecisionResult | null>(null);
  const p = node.player;
  const n = info.hands[p].length;
  const probs = node.actions.map((_, a) => node.strategy[a * n + hand]!);
  const top = probs.indexOf(Math.max(...probs));
  useEffect(() => {
    let live = true;
    const start = rootReach?.[p]?.[hand];
    const share = start && start > 0 ? node.reach[p][hand]! / start : 1;
    decideAt(info, node, p, hand, share, top, { exploitabilityPct, equity: (request) => solverClient().call('equity', { request }) }).then((x) => live && setR(x));
    return () => {
      live = false;
    };
  }, [info, node, p, hand, top, exploitabilityPct, rootReach]);
  if (!r) return <Skeleton className="h-40" />;
  const combo = info.hands[p][hand]!;
  const rows: MathRow[] = node.actions.map((action, a) => {
    const ev = r.ctx.ev[a] ?? null;
    const evs = r.ctx.ev.filter((x): x is number => x !== null);
    return { action, frequency: probs[a]!, evText: ev === null ? '—' : fmtBb(ev), stdError: null, chosen: a === top, best: ev !== null && ev >= Math.max(...evs) - 1e-9 };
  });
  return (
    <CoachCard
      testId="explain-hand"
      card={buildCoach(r.claims, { seed: `explain|${combo}|${node.pot}|${node.board.join('')}`, drill: 'postflop', position: p === 0 ? 'OOP' : 'IP', hand: cellName(cellOf(combo).index), detail })}
      rows={rows}
      details={r.claims.flatMap(renderClaim)}
    />
  );
}
