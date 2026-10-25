import { useEffect, useRef, useState } from 'react';
import { t, type MessageKey } from '../../../lib/i18n';
import { CancelledError, SolverClient, type Progress } from '../../../lib/wasm/client';
import type { RunResult, SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { NodeBrowser, type Step } from '../../solver/NodeBrowser';
import { DRILL_SPOTS } from '../../trainer/postflop/spots';

type Config = Record<string, unknown>;

/** A preset spot solved in a worker on request, browsable node by node (with its accuracy). */
export function MiniSolver({ config }: { config: Config }) {
  const spot = DRILL_SPOTS.find((s) => s.id === config.spot);
  const client = useRef<SolverClient | null>(null);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'running'; p: Progress | null } | { kind: 'ready'; info: SolverInfo; result: RunResult } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const [path, setPath] = useState<Step[]>([]);
  const [node, setNode] = useState<SolverNode | null>(null);
  const [cell, setCell] = useState<number | null>(null);
  useEffect(() => () => client.current?.cancel(), []);
  useEffect(() => {
    if (state.kind !== 'ready' || !client.current) return;
    let live = true;
    client.current.call('solverNode', { path: path.map((p) => p.index) }).then((n) => live && setNode(n));
    return () => {
      live = false;
    };
  }, [state, path]);
  if (!spot) return <p>{t('widget.solver.missing')}</p>;
  const solve = async () => {
    client.current?.cancel();
    const c = new SolverClient();
    client.current = c;
    setPath([]);
    setNode(null);
    setState({ kind: 'running', p: null });
    try {
      const info = await c.call('solverStart', { spot: spot.spot, budgetBytes: 1.5e9, allowAbstraction: false });
      const result = await c.call('solverRun', { maxIterations: spot.maxIterations, targetPct: spot.target }, (p) => setState({ kind: 'running', p }));
      setState({ kind: 'ready', info, result });
    } catch (e) {
      if (!(e instanceof CancelledError)) setState({ kind: 'error', message: (e as Error).message });
    }
  };
  return (
    <div className="space-y-3">
      <p className="text-sm">{t(`trainer.post.spot.${spot.id}` as MessageKey)}</p>
      <p className="text-xs text-slate-600 dark:text-slate-400">{t('trainer.post.inputs')}</p>
      {state.kind === 'idle' && (
        <button type="button" className="btn-primary" onClick={() => void solve()}>
          {t('widget.solver.solve')}
        </button>
      )}
      {state.kind === 'running' && <p role="status">{t('trainer.post.solving', { it: state.p?.iterations ?? 0, x: (state.p?.pctPot ?? 100).toFixed(2) })}</p>}
      {state.kind === 'error' && <p className="text-amber-700 dark:text-amber-400">{state.message}</p>}
      {state.kind === 'ready' && (
        <>
          <p className="text-sm" data-testid="minisolver-status">
            {t('trainer.post.ready', { x: state.result.pctPot.toFixed(2), s: (state.result.elapsedMs / 1000).toFixed(1), it: state.result.iterations })}
          </p>
          {node && <NodeBrowser info={state.info} node={node} path={path} setPath={setPath} cell={cell} setCell={setCell} />}
        </>
      )}
    </div>
  );
}
