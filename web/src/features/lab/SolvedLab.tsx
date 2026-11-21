// Math Lab panels on a solved river spot (D-087): MDF and bluff share next to the solution, and a
// bet-sizing trainer graded by EV loss. The spot is the solver page's river example, solved in a
// worker of its own when the panel is opened.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Badge, ErrorState, Skeleton } from '../../lib/ui/components';
import { SolverClient, solverClient } from '../../lib/wasm/client';
import type { SolverInfo } from '../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../solver/spotForm';
import { CardRow } from '../table/Card';
import { grade, type Grade } from '../trainer/grading';
import { mulberry32 } from '../trainer/preflop/deal';
import { sizeRows, sizingProblem, type EquityFn, type NodeSource, type SizeRow, type SizingProblem } from './solvedRiver';

const SPOT = toSpot(PRESETS.river);
const TARGET = 0.3;
const MAX_ITERATIONS = 2000;
const BUDGET = 1.5e9;
/** Defence within this share of MDF is described as "near" it. */
const NEAR = 0.02;

type Solved = { info: SolverInfo; source: NodeSource; exploitabilityPct: number; checkIndex: number };

/** Solve the example river spot once per panel (a few seconds). */
function useSolvedRiver(start: boolean) {
  const [state, setState] = useState<{ kind: 'idle' | 'solving' } | { kind: 'ready'; solved: Solved } | { kind: 'error'; message: string }>({ kind: 'idle' });
  const client = useRef<SolverClient | null>(null);
  useEffect(() => () => client.current?.cancel(), []);
  useEffect(() => {
    if (!start || state.kind !== 'idle') return;
    setState({ kind: 'solving' });
    const c = new SolverClient();
    client.current = c;
    (async () => {
      const info = await c.call('solverStart', { spot: SPOT, budgetBytes: BUDGET, allowAbstraction: false });
      const result = await c.call('solverRun', { maxIterations: MAX_ITERATIONS, targetPct: TARGET });
      const source: NodeSource = (path) => c.call('solverNode', { path });
      const root = await source([]);
      const checkIndex = root.kind === 'action' ? root.actions.findIndex((a) => /^check/i.test(a)) : -1;
      setState({ kind: 'ready', solved: { info, source, exploitabilityPct: result.pctPot, checkIndex } });
    })().catch((e: Error) => setState({ kind: 'error', message: e.message }));
  }, [start, state.kind]);
  return state;
}

function SpotSummary() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <CardRow cards={SPOT.board.split(' ')} size="sm" />
      <p className="text-ink-muted">{t('lab.solved.spot', { pot: SPOT.pot, stack: SPOT.stack })}</p>
    </div>
  );
}

function Rows({ rows, label }: { rows: SizeRow[]; label: string }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{label}</p>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={label}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-ink-muted">
              <th className="py-1 pr-3">{t('lab.solved.size')}</th>
              <th className="py-1 pr-3">{t('lab.solved.betFreq')}</th>
              <th className="py-1 pr-3">{t('lab.solved.mdf')}</th>
              <th className="py-1 pr-3">{t('lab.solved.defend')}</th>
              <th className="py-1 pr-3">{t('lab.solved.bluffTheory')}</th>
              <th className="py-1">{t('lab.solved.bluffShare')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.bet} className="border-t border-line num">
                <td className="py-1 pr-3">{t('lab.solved.sizeValue', { bet: r.bet, frac: pct(r.fraction, 0) })}</td>
                <td className="py-1 pr-3">{pct(r.betFrequency, 1)}</td>
                <td className="py-1 pr-3">{pct(r.mdf, 1)}</td>
                <td className="py-1 pr-3">{pct(r.defend, 1)}</td>
                <td className="py-1 pr-3">{pct(r.bluffTheory, 1)}</td>
                <td className="py-1">{r.bluffShare === null ? '—' : pct(r.bluffShare, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {rows.map((r) => (
          <li key={r.bet}>
            {t(Math.abs(r.defend - r.mdf) < NEAR ? 'lab.solved.defendNear' : r.defend > r.mdf ? 'lab.solved.defendMore' : 'lab.solved.defendLess', { bet: r.bet, defend: pct(r.defend, 1), mdf: pct(r.mdf, 1), near: NEAR * 100 })}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** MDF and bluff share against the solution, for both players' first bets on this river. */
export function MdfComparison() {
  const [open, setOpen] = useState(false);
  const state = useSolvedRiver(open);
  const [rows, setRows] = useState<{ first: SizeRow[]; afterCheck: SizeRow[] } | null>(null);
  useEffect(() => {
    if (state.kind !== 'ready') return;
    const { info, source, checkIndex } = state.solved;
    const equity: EquityFn = (req) => solverClient().call('equity', { request: req });
    (async () => setRows({ first: await sizeRows(info, source, equity, []), afterCheck: checkIndex >= 0 ? await sizeRows(info, source, equity, [checkIndex]) : [] }))().catch(() => setRows(null));
  }, [state]);
  return (
    <section className="card space-y-3" data-testid="mdf-solved">
      <h3 className="text-base font-semibold">{t('lab.solved.mdfTitle')}</h3>
      <p className="max-w-prose text-sm text-ink-muted">{t('lab.solved.mdfIntro')}</p>
      {!open && (
        <button type="button" className="btn-secondary" onClick={() => setOpen(true)} data-testid="mdf-solve">
          {t('lab.solved.solve')}
        </button>
      )}
      {state.kind === 'solving' && <Skeleton className="h-24" />}
      {state.kind === 'error' && <ErrorState title={t('flow.errorTitle')} message={state.message} />}
      {state.kind === 'ready' && (
        <>
          <SpotSummary />
          <p className="text-xs text-ink-muted">{t('lab.solved.accuracy', { pct: state.solved.exploitabilityPct.toFixed(2) })}</p>
          {!rows ? (
            <Skeleton className="h-24" />
          ) : (
            <>
              <Rows rows={rows.first} label={t('lab.solved.first')} />
              {rows.afterCheck.length > 0 && <Rows rows={rows.afterCheck} label={t('lab.solved.afterCheck')} />}
              <p className="max-w-prose text-xs text-ink-muted">{t('lab.solved.definitions')}</p>
            </>
          )}
        </>
      )}
    </section>
  );
}

/** Pick a size for a hand on the solved river; graded by EV loss against the best action. */
export function SizingTrainer() {
  const [open, setOpen] = useState(false);
  const state = useSolvedRiver(open);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const [problem, setProblem] = useState<SizingProblem | null>(null);
  const [picked, setPicked] = useState<{ chosen: number; grade: Grade } | null>(null);
  const next = useCallback(async () => {
    if (state.kind !== 'ready') return;
    const { info, source, checkIndex } = state.solved;
    setPicked(null);
    const path = rnd() < 0.5 || checkIndex < 0 ? [] : [checkIndex];
    setProblem(await sizingProblem(info, source, path, rnd));
  }, [state, rnd]);
  useEffect(() => {
    void next();
  }, [next]);
  const choose = (chosen: number) => {
    if (!problem || picked || state.kind !== 'ready') return;
    setPicked({ chosen, grade: grade({ ev: problem.ev, strategy: problem.strategy, chosen, unit: 'pctPot', potBb: SPOT.pot, noiseFloorPct: state.solved.exploitabilityPct }) });
  };
  const best = problem ? Math.max(...problem.ev) : 0;
  return (
    <section className="card space-y-3" data-testid="sizing-trainer">
      <h3 className="text-base font-semibold">{t('lab.solved.sizingTitle')}</h3>
      <p className="max-w-prose text-sm text-ink-muted">{t('lab.solved.sizingIntro')}</p>
      {!open && (
        <button type="button" className="btn-primary" onClick={() => setOpen(true)} data-testid="sizing-solve">
          {t('lab.solved.solve')}
        </button>
      )}
      {state.kind === 'solving' && <Skeleton className="h-24" />}
      {state.kind === 'error' && <ErrorState title={t('flow.errorTitle')} message={state.message} />}
      {state.kind === 'ready' && problem && (
        <>
          <SpotSummary />
          <div className="flex flex-wrap items-center gap-4">
            <div>
              <p className="eyebrow mb-1">{t('lab.cards.hero')}</p>
              <CardRow cards={[problem.hand.slice(0, 2), problem.hand.slice(2)]} size="sm" />
            </div>
            <p className="text-sm">{t(problem.path.length ? 'lab.solved.youIp' : 'lab.solved.youOop')}</p>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('lab.solved.pick')}>
            {problem.actions.map((a, i) => (
              <button key={a} type="button" className={picked?.chosen === i ? 'btn-primary' : 'btn-secondary'} disabled={!!picked} onClick={() => choose(i)}>
                {a}
              </button>
            ))}
          </div>
          {picked && (
            <div className="space-y-2" data-testid="sizing-result" aria-live="polite">
              <p className="flex items-center gap-2 font-medium">
                <Badge tone={picked.grade.category === 'best' ? 'good' : picked.grade.category === 'acceptable' ? 'accent' : 'warn'}>{t(`trainer.category.${picked.grade.category}` as MessageKey)}</Badge>
                {picked.grade.lossBb < 1e-9 ? t('lab.solved.bestPick') : t('lab.solved.loss', { loss: picked.grade.lossBb.toFixed(2), best: picked.grade.bestActions.map((i) => problem.actions[i]).join(' / ') })}
              </p>
              <table className="text-sm">
                <thead>
                  <tr className="text-ink-muted">
                    <th className="py-1 pr-4 text-left">{t('lab.solved.action')}</th>
                    <th className="py-1 pr-4 text-left">{t('lab.solved.ev')}</th>
                    <th className="py-1 text-left">{t('lab.solved.mix')}</th>
                  </tr>
                </thead>
                <tbody>
                  {problem.actions.map((a, i) => (
                    <tr key={a} className="num" data-best={problem.ev[i] === best ? 'true' : 'false'}>
                      <td className="py-0.5 pr-4">{a}</td>
                      <td className="py-0.5 pr-4">{problem.ev[i]!.toFixed(2)} bb</td>
                      <td className="py-0.5">{pct(problem.strategy[i]!, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="max-w-prose text-xs text-ink-muted">{t('lab.solved.sizingNote')}</p>
              <button type="button" className="btn-primary" onClick={() => void next()}>
                {t('lab.next')}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
