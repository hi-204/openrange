import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useSettings } from '../../lib/settings/useSettings';
import { t, type MessageKey } from '../../lib/i18n';
import { CancelledError, SolverClient, solverClient, type Progress } from '../../lib/wasm/client';
import type { RunResult, SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { NodeBrowser, type Step } from './NodeBrowser';
import { RangePainter } from './WorkbenchParts';
import { activeStreets, PRESETS, STREETS, toSpot, type Form, type StreetForm, type StreetName } from './spotForm';

type Status =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; progress: Progress | null }
  | { kind: 'stopped'; result: RunResult }
  | { kind: 'cancelled' }
  | { kind: 'error'; message: string };

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

const STREET_LABEL: Record<StreetName, MessageKey> = { flop: 'solver.flop', turn: 'solver.turn', river: 'solver.river' };

function StreetFields({ name, value, onChange }: { name: StreetName; value: StreetForm; onChange: (v: StreetForm) => void }) {
  const set = (k: keyof StreetForm) => (v: string) => onChange({ ...value, [k]: v });
  const street = t(STREET_LABEL[name]);
  return (
    <fieldset className="grid gap-3 rounded-md border border-slate-200 p-3 sm:col-span-4 sm:grid-cols-5 dark:border-slate-800">
      <legend className="px-1 text-sm font-semibold">{street}</legend>
      <Field label={t('solver.oopBet', { street })} value={value.oopBet} onChange={set('oopBet')} />
      <Field label={t('solver.oopRaise', { street })} value={value.oopRaise} onChange={set('oopRaise')} />
      <Field label={t('solver.ipBet', { street })} value={value.ipBet} onChange={set('ipBet')} />
      <Field label={t('solver.ipRaise', { street })} value={value.ipRaise} onChange={set('ipRaise')} />
      <Field label={t('solver.maxRaises', { street })} value={value.maxRaises} onChange={set('maxRaises')} />
    </fieldset>
  );
}

export function SolverPage() {
  // The Solver section of Settings provides the defaults; each preset keeps its own spot.
  const solverSettings = useSettings((st) => st.settings.solver);
  const withSettings = (f: Form): Form => ({ ...f, target: String(solverSettings.targetPct), maxIterations: String(solverSettings.maxIterations), budgetMb: String(solverSettings.memoryMb), simplify: solverSettings.simplify });
  const [form, setForm] = useState<Form>(() => withSettings(PRESETS.river));
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [info, setInfo] = useState<SolverInfo | null>(null);
  const [path, setPath] = useState<Step[]>([]);
  const [node, setNode] = useState<SolverNode | null>(null);
  const [rootReach, setRootReach] = useState<number[][] | undefined>(undefined);
  const [cell, setCell] = useState<number | null>(null);
  // Node locks (D-076): their paths and labels, and the EVs before the first lock.
  const [locks, setLocks] = useState<{ path: Step[]; label: string }[]>([]);
  const [baseline, setBaseline] = useState<[number, number] | null>(null);
  const client = useRef<SolverClient | null>(null);
  const simplifyId = useId();
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  // Each page owns its worker; leaving the page frees the solver's memory.
  useEffect(() => () => client.current?.cancel(), []);

  const browsable = status.kind === 'stopped';
  useEffect(() => {
    if (!browsable || !client.current) return;
    let live = true;
    client.current
      .call('solverNode', { path: path.map((p) => p.index) })
      .then((n) => {
        if (!live) return;
        setNode(n);
        if (path.length === 0) setRootReach(n.reach);
      })
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

  async function guarded(f: () => Promise<void>) {
    try {
      await f();
    } catch (e) {
      setStatus(e instanceof CancelledError ? { kind: 'cancelled' } : { kind: 'error', message: (e as Error).message });
    }
  }

  function solve() {
    client.current?.cancel();
    const c = new SolverClient();
    client.current = c;
    setNode(null);
    setPath([]);
    setCell(null);
    setInfo(null);
    setLocks([]);
    setBaseline(null);
    setStatus({ kind: 'starting' });
    void guarded(async () => {
      const i = await c.call('solverStart', {
        spot: { ...toSpot(form), algorithm: solverSettings.algorithm },
        budgetBytes: Number(form.budgetMb) * 1e6,
        allowAbstraction: form.simplify,
      });
      setInfo(i);
      await run(c);
    });
  }

  const key = (p: Step[]) => p.map((s) => s.index).join('.');
  const explore = useCallback((p: number[]) => client.current!.call('solverNode', { path: p }), []);
  /** Lock the current node, then re-solve from scratch so the averages reflect the lock. */
  function lockHere(strategy: number[], label: string) {
    const c = client.current;
    if (!c || status.kind !== 'stopped') return;
    const at = path;
    if (!locks.length) setBaseline(status.result.evBb);
    void guarded(async () => {
      await c.call('solverLock', { path: at.map((s) => s.index), strategy });
      setLocks((l) => [...l.filter((x) => key(x.path) !== key(at)), { path: at, label }]);
      await c.call('solverReset', {});
      await run(c);
    });
  }
  function unlockAt(at: Step[]) {
    const c = client.current;
    if (!c) return;
    void guarded(async () => {
      await c.call('solverUnlock', { path: at.map((s) => s.index) });
      const left = locks.filter((x) => key(x.path) !== key(at));
      setLocks(left);
      if (!left.length) setBaseline(null);
      await c.call('solverReset', {});
      await run(c);
    });
  }

  const running = status.kind === 'running' || status.kind === 'starting';
  const progress = status.kind === 'running' ? status.progress : status.kind === 'stopped' ? status.result : null;
  const streets = activeStreets(form.board);

  // Live memory estimate from the solver's own estimator (count-only, no allocation), on the
  // shared quick worker so it never disturbs a running solve.
  const [estimate, setEstimate] = useState<{ bytes: number } | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      solverClient()
        .call('estimateMemory', { spot: toSpot(form) })
        .then((r) => live && setEstimate(r))
        .catch((e: Error) => live && setEstimate({ error: e.message }));
    }, 300);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [form]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('solver.heading')}</h2>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{t('solver.intro')}</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label={t('solver.examples')}>
        <span className="font-medium">{t('solver.examples')}:</span>
        {(['river', 'turn', 'flop'] as const).map((k) => (
          <button key={k} type="button" className="btn-secondary px-3 py-1" onClick={() => setForm(withSettings(PRESETS[k]))} disabled={running}>
            {t(`solver.preset.${k}`)}
          </button>
        ))}
      </div>

      <form
        className="card grid gap-4 sm:grid-cols-4"
        onSubmit={(e) => {
          e.preventDefault();
          solve();
        }}
      >
        <Field label={t('solver.board')} value={form.board} onChange={set('board')} />
        <Field label={t('solver.pot')} value={form.pot} onChange={set('pot')} />
        <Field label={t('solver.stack')} value={form.stack} onChange={set('stack')} />
        <Field label={t('solver.allIn')} value={form.allIn} onChange={set('allIn')} />
        <Field label={t('solver.oopRange')} value={form.oop} onChange={set('oop')} wide />
        <Field label={t('solver.ipRange')} value={form.ip} onChange={set('ip')} wide />
        <details className="sm:col-span-2">
          <summary className="cursor-pointer text-sm font-medium">{t('painter.summary')}</summary>
          <div className="mt-2 grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium">{t('solver.oopRange')}</p>
              <RangePainter value={form.oop} onChange={set('oop')} label={t('solver.oopRange')} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium">{t('solver.ipRange')}</p>
              <RangePainter value={form.ip} onChange={set('ip')} label={t('solver.ipRange')} />
            </div>
          </div>
        </details>
        {STREETS.filter((s) => streets.includes(s)).map((s) => (
          <StreetFields
            key={s}
            name={s}
            value={form.streets[s]}
            onChange={(v) => setForm((f) => ({ ...f, streets: { ...f.streets, [s]: v } }))}
          />
        ))}
        <Field label={t('solver.rake')} value={form.rake} onChange={set('rake')} />
        <Field label={t('solver.rakeCap')} value={form.rakeCap} onChange={set('rakeCap')} />
        <Field label={t('solver.target')} value={form.target} onChange={set('target')} />
        <Field label={t('solver.maxIterations')} value={form.maxIterations} onChange={set('maxIterations')} />
        <div>
          <Field label={t('solver.budget')} value={form.budgetMb} onChange={set('budgetMb')} />
          {estimate && 'bytes' in estimate && (
            <p className="mt-1 text-xs text-ink-muted" data-testid="memory-estimate" data-bytes={estimate.bytes}>
              {t('solver.estimate', { mb: (estimate.bytes / 1e6).toFixed(2) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm sm:col-span-3">
          <input
            id={simplifyId}
            type="checkbox"
            checked={form.simplify}
            onChange={(e) => setForm((f) => ({ ...f, simplify: e.target.checked }))}
          />
          <label htmlFor={simplifyId}>{t('solver.simplify')}</label>
        </div>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-4">
          <button type="submit" className="btn-primary" disabled={running}>
            {t('solver.solve')}
          </button>
          {status.kind === 'running' && (
            <button type="button" className="btn-secondary" onClick={() => void client.current?.call('solverPause', {})}>
              {t('solver.pause')}
            </button>
          )}
          {status.kind === 'stopped' && status.result.reason === 'paused' && (
            <button type="button" className="btn-secondary" onClick={() => client.current && void guarded(() => run(client.current!))}>
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

      <section aria-live="polite" className="space-y-2 text-sm" data-testid="solver-progress">
        {status.kind === 'starting' && <p>{t('solver.starting')}</p>}
        {status.kind === 'cancelled' && <p>{t('solver.cancelled')}</p>}
        {status.kind === 'error' && <p className="text-amber-700 dark:text-amber-400">{t('solver.error', { message: status.message })}</p>}
        {info && (
          <p className="text-ink-muted">
            {t('solver.info', {
              mb: (info.estimateBytes / 1e6).toFixed(1),
              oop: info.hands[0].length,
              ip: info.hands[1].length,
              nodes: info.expandedNodes.toLocaleString('en-US'),
            })}
            {info.symmetries > 1 && ` ${t('solver.symmetries', { n: info.symmetries })}`}
          </p>
        )}
        {info && info.abstraction.length > 0 && (
          <div role="note" className="rounded-md border border-amber-600 bg-amber-50 p-3 text-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="abstraction-warning">
            <p className="font-medium">{t('solver.abstractionHeading')}</p>
            <ul className="ml-5 list-disc">
              {info.abstraction.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <p className="mt-1 text-xs">{t('solver.abstractionNote')}</p>
          </div>
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
              {t(info && info.abstraction.length > 0 ? 'solver.badgeSimplified' : 'solver.badge', {
                algorithm: info?.algorithm ?? 'DCFR',
                iterations: status.result.iterations,
                pct: status.result.pctPot.toFixed(3),
              })}
            </span>{' '}
            {status.result.reason === 'target' && t('solver.reachedTarget')}
            {status.result.reason === 'max' && t('solver.hitMax')}
            {status.result.reason === 'paused' && t('solver.paused')}{' '}
            {t('solver.ev', { oop: status.result.evBb[0].toFixed(2), ip: status.result.evBb[1].toFixed(2) })}
          </p>
        )}
      </section>

      {locks.length > 0 && (
        <section className="card space-y-2 text-sm" data-testid="locks">
          <h2 className="font-semibold">{t('lock.listTitle', { n: locks.length })}</h2>
          <p className="text-ink-muted">{t('lock.listNote')}</p>
          {baseline && status.kind === 'stopped' && (
            <p data-testid="lock-ev">
              {t('lock.evChange', { oop: status.result.evBb[0].toFixed(2), ip: status.result.evBb[1].toFixed(2), oop0: baseline[0].toFixed(2), ip0: baseline[1].toFixed(2) })}
            </p>
          )}
          <ul className="space-y-1">
            {locks.map((l) => (
              <li key={key(l.path)} className="flex flex-wrap items-center gap-2">
                <button type="button" className="underline" onClick={() => setPath(l.path)}>
                  {l.path.length ? l.path.map((s) => s.label).join(' › ') : t('solver.root')}
                </button>
                <span className="text-ink-muted">{l.label}</span>
                <button type="button" className="btn-quiet !min-h-9 !px-2 text-xs" disabled={running} onClick={() => unlockAt(l.path)}>
                  {t('lock.unlock')}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {browsable && info && node && (
        <NodeBrowser
          info={info}
          node={node}
          path={path}
          setPath={setPath}
          cell={cell}
          setCell={setCell}
          exploitabilityPct={status.kind === 'stopped' ? status.result.pctPot : undefined}
          rootReach={rootReach}
          locking={{ busy: running, onLock: lockHere, onUnlock: () => unlockAt(path) }}
          explore={explore}
        />
      )}
    </div>
  );
}
