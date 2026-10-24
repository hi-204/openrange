import { useEffect, useId, useRef, useState } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { cellName, cellOf } from '../../lib/poker/hands';
import { CancelledError, SolverClient, type Progress } from '../../lib/wasm/client';
import type { RunResult, SolverInfo, SolverNode, SpotJson } from '../../lib/wasm/protocol';
import { actionColors } from './colors';
import { StrategyGrid } from './StrategyGrid';

// Example inputs (the user edits them). These are ranges typed into a form, not solver output.
const EXAMPLE = {
  board: 'Qs Jh 7d 4c 2s',
  pot: '10',
  stack: '90',
  oop: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, ATo+, KTo+, QTo+, JTo',
  ip: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A5o+, K9o+, Q9o+, J9o+, T9o',
  oopBet: '33, 75, 150',
  oopRaise: '100',
  ipBet: '33, 75, 150',
  ipRaise: '100',
  maxRaises: '2',
  allIn: '67',
  rake: '0',
  rakeCap: '0',
  target: '0.3',
  maxIterations: '2000',
  budgetMb: '1000',
};

type Form = typeof EXAMPLE;
type Status =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; progress: Progress | null }
  | { kind: 'stopped'; result: RunResult }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

function toSpot(f: Form): SpotJson {
  const sizes = {
    oop: { bet: f.oopBet, raise: f.oopRaise },
    ip: { bet: f.ipBet, raise: f.ipRaise },
  };
  return {
    board: f.board,
    pot: Number(f.pot),
    stack: Number(f.stack),
    ranges: { oop: f.oop, ip: f.ip },
    sizes: { default: sizes },
    maxRaises: Number(f.maxRaises),
    allInThreshold: Number(f.allIn) / 100,
    rake: { percent: Number(f.rake), capBb: Number(f.rakeCap) },
  };
}

function Field({ label, value, onChange, wide }: { label: string; value: string; onChange: (v: string) => void; wide?: boolean }) {
  const id = useId();
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoComplete="off" />
    </div>
  );
}

export function SolverPage() {
  const [form, setForm] = useState<Form>(EXAMPLE);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [info, setInfo] = useState<SolverInfo | null>(null);
  const [path, setPath] = useState<{ index: number; label: string }[]>([]);
  const [node, setNode] = useState<SolverNode | null>(null);
  const [cell, setCell] = useState<number | null>(null);
  const client = useRef<SolverClient | null>(null);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Each page owns its worker; leaving the page frees the solver's memory.
  useEffect(() => () => client.current?.cancel(), []);

  const browsable = status.kind === 'stopped';
  useEffect(() => {
    if (!browsable || !client.current) return;
    let live = true;
    client.current
      .call('solverNode', { path: path.map((p) => p.index) })
      .then((n) => live && setNode(n))
      .catch((e: Error) => live && setStatus({ kind: 'error', message: e.message }));
    return () => {
      live = false;
    };
  }, [browsable, path]);

  async function run(c: SolverClient) {
    setStatus({ kind: 'running', progress: null });
    const result = await c.call(
      'solverRun',
      { maxIterations: Number(form.maxIterations), targetPct: Number(form.target) },
      (p) => setStatus({ kind: 'running', progress: p }),
    );
    setStatus({ kind: 'stopped', result });
  }

  async function solve() {
    client.current?.cancel();
    const c = new SolverClient();
    client.current = c;
    setNode(null);
    setPath([]);
    setCell(null);
    setInfo(null);
    setStatus({ kind: 'starting' });
    try {
      const i = await c.call('solverStart', { spot: toSpot(form), budgetBytes: Number(form.budgetMb) * 1e6 });
      setInfo(i);
      await run(c);
    } catch (e) {
      setStatus(e instanceof CancelledError ? { kind: 'cancelled' } : { kind: 'error', message: (e as Error).message });
    }
  }

  async function resume() {
    if (!client.current) return;
    try {
      await run(client.current);
    } catch (e) {
      setStatus(e instanceof CancelledError ? { kind: 'cancelled' } : { kind: 'error', message: (e as Error).message });
    }
  }

  const running = status.kind === 'running' || status.kind === 'starting';
  const progress = status.kind === 'running' ? status.progress : status.kind === 'stopped' ? status.result : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('solver.heading')}</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('solver.intro')}</p>
      </div>

      <form
        className="card grid gap-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          void solve();
        }}
      >
        <Field label={t('solver.board')} value={form.board} onChange={set('board')} />
        <Field label={t('solver.pot')} value={form.pot} onChange={set('pot')} />
        <Field label={t('solver.stack')} value={form.stack} onChange={set('stack')} />
        <Field label={t('solver.maxRaises')} value={form.maxRaises} onChange={set('maxRaises')} />
        <Field label={t('solver.oopRange')} value={form.oop} onChange={set('oop')} wide />
        <Field label={t('solver.ipRange')} value={form.ip} onChange={set('ip')} wide />
        <Field label={t('solver.oopBet')} value={form.oopBet} onChange={set('oopBet')} />
        <Field label={t('solver.oopRaise')} value={form.oopRaise} onChange={set('oopRaise')} />
        <Field label={t('solver.ipBet')} value={form.ipBet} onChange={set('ipBet')} />
        <Field label={t('solver.ipRaise')} value={form.ipRaise} onChange={set('ipRaise')} />
        <Field label={t('solver.allIn')} value={form.allIn} onChange={set('allIn')} />
        <Field label={t('solver.rake')} value={form.rake} onChange={set('rake')} />
        <Field label={t('solver.rakeCap')} value={form.rakeCap} onChange={set('rakeCap')} />
        <Field label={t('solver.budget')} value={form.budgetMb} onChange={set('budgetMb')} />
        <Field label={t('solver.target')} value={form.target} onChange={set('target')} />
        <Field label={t('solver.maxIterations')} value={form.maxIterations} onChange={set('maxIterations')} />
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2">
          <button type="submit" className="btn-primary" disabled={running}>
            {t('solver.solve')}
          </button>
          {status.kind === 'running' && (
            <button type="button" className="btn-secondary" onClick={() => void client.current?.call('solverPause', {})}>
              {t('solver.pause')}
            </button>
          )}
          {status.kind === 'stopped' && status.result.reason === 'paused' && (
            <button type="button" className="btn-secondary" onClick={() => void resume()}>
              {t('solver.resume')}
            </button>
          )}
          {running && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                client.current?.cancel();
                client.current = null;
              }}
            >
              {t('solver.cancel')}
            </button>
          )}
        </div>
      </form>

      <section aria-live="polite" className="space-y-1 text-sm" data-testid="solver-progress">
        {status.kind === 'starting' && <p>{t('solver.starting')}</p>}
        {status.kind === 'cancelled' && <p>{t('solver.cancelled')}</p>}
        {status.kind === 'error' && <p className="text-amber-700 dark:text-amber-400">{t('solver.error', { message: status.message })}</p>}
        {info && (
          <p className="text-slate-600 dark:text-slate-400">
            {t('solver.info', {
              mb: (info.estimateBytes / 1e6).toFixed(1),
              oop: info.hands[0].length,
              ip: info.hands[1].length,
              nodes: info.actionNodes,
            })}
          </p>
        )}
        {progress && (
          <p>
            {t('solver.progress', {
              iterations: progress.iterations,
              pct: progress.pctPot.toFixed(3),
              bb: progress.bb.toFixed(3),
              seconds: (progress.elapsedMs / 1000).toFixed(1),
            })}
          </p>
        )}
        {status.kind === 'stopped' && (
          <p>
            <span className="mr-2 inline-block rounded-full border border-sky-700 px-2 py-0.5 text-xs text-sky-800 dark:border-sky-400 dark:text-sky-300" data-testid="solver-badge">
              {t('solver.badge', {
                algorithm: info?.algorithm ?? 'DCFR',
                iterations: status.result.iterations,
                pct: status.result.pctPot.toFixed(3),
              })}
            </span>
            {status.result.reason === 'target' && t('solver.reachedTarget')}
            {status.result.reason === 'max' && t('solver.hitMax')}
            {status.result.reason === 'paused' && t('solver.paused')}
            {' '}
            {t('solver.ev', { oop: status.result.evBb[0].toFixed(2), ip: status.result.evBb[1].toFixed(2) })}
          </p>
        )}
      </section>

      {browsable && info && node && <NodeBrowser info={info} node={node} path={path} setPath={setPath} cell={cell} setCell={setCell} />}
    </div>
  );
}

function NodeBrowser({
  info,
  node,
  path,
  setPath,
  cell,
  setCell,
}: {
  info: SolverInfo;
  node: SolverNode;
  path: { index: number; label: string }[];
  setPath: (p: { index: number; label: string }[]) => void;
  cell: number | null;
  setCell: (c: number | null) => void;
}) {
  const crumbs = (
    <nav aria-label={t('solver.path')} className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" className="underline" onClick={() => setPath([])}>
        {t('solver.root')}
      </button>
      {path.map((p, i) => (
        <span key={i}>
          {' › '}
          <button type="button" className="underline" onClick={() => setPath(path.slice(0, i + 1))}>
            {p.label}
          </button>
        </span>
      ))}
    </nav>
  );

  if (node.kind !== 'action') {
    return (
      <section className="card space-y-2">
        {crumbs}
        <p>{node.kind === 'fold' ? t('solver.foldEnd', { who: node.folder === 0 ? 'OOP' : 'IP' }) : t('solver.showdownEnd')}</p>
      </section>
    );
  }

  const hands = info.hands[node.player];
  const n = hands.length;
  const reach = node.reach[node.player];
  const colors = actionColors(node.actions, node.aggressive);
  const totalReach = reach.reduce((s, w) => s + w, 0);
  const overall = node.actions.map((_, a) => hands.reduce((s, _h, i) => s + reach[i]! * node.strategy[a * n + i]!, 0) / totalReach);
  const combos = cell === null ? [] : hands.map((h, i) => ({ h, i })).filter(({ h, i }) => cellOf(h).index === cell && reach[i]! > 0);

  return (
    <section className="card space-y-4" data-testid="node-browser">
      {crumbs}
      <p className="text-sm">
        {t('solver.nodeHeader', {
          who: node.player === 0 ? t('solver.oop') : t('solver.ip'),
          pot: node.pot.toFixed(2),
          board: node.board.join(' '),
        })}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label={t('solver.actions')}>
        {node.actions.map((label, a) => (
          <li key={a}>
            <button
              type="button"
              className="btn-secondary flex items-center gap-2"
              onClick={() => {
                setCell(null);
                setPath([...path, { index: a, label: `${node.player === 0 ? 'OOP' : 'IP'} ${label}` }]);
              }}
            >
              <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colors[a] }} />
              {label} <span className="font-mono">{pct(overall[a]!, 1)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <StrategyGrid hands={hands} reach={reach} strategy={node.strategy} actions={node.actions} colors={colors} selected={cell} onSelect={setCell} />
        <div className="text-sm">
          {cell === null ? (
            <p className="text-slate-600 dark:text-slate-400">{t('solver.pickCell')}</p>
          ) : combos.length === 0 ? (
            <p>{t('solver.notInRange', { hand: cellName(cell) })}</p>
          ) : (
            <table className="w-full text-left">
              <caption className="mb-1 text-left font-medium">{t('solver.combosOf', { hand: cellName(cell) })}</caption>
              <thead>
                <tr>
                  <th className="py-1">{t('solver.combo')}</th>
                  <th className="py-1">{t('solver.weight')}</th>
                  {node.actions.map((a, k) => (
                    <th key={k} className="py-1">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combos.map(({ h, i }) => (
                  <tr key={h} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 font-mono">{h}</td>
                    <td className="py-1 font-mono">{pct(reach[i]!, 0)}</td>
                    {node.actions.map((_, a) => {
                      const ev = node.evBb[a * n + i];
                      return (
                        <td key={a} className="py-1 font-mono">
                          {pct(node.strategy[a * n + i]!, 0)}
                          <span className="block text-xs text-slate-500">{ev === null || ev === undefined ? '—' : `${ev.toFixed(2)} bb`}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{t('solver.evNote')}</p>
        </div>
      </div>
    </section>
  );
}
