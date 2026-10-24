import { useEffect, useId, useRef, useState } from 'react';
import { count, pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { CancelledError, solverClient } from '../../lib/wasm/client';
import type { EquityMode, EquityResult, ParsedRange } from '../../lib/wasm/protocol';

const MAX_PLAYERS = 6;

type Run =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'done'; result: EquityResult }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string };

/** Range input with live validation through the solver (single source of parsing truth). */
function RangeField({
  n,
  value,
  onChange,
  onRemove,
}: {
  n: number;
  value: string;
  onChange: (v: string) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const [parsed, setParsed] = useState<ParsedRange | null>(null);
  useEffect(() => {
    if (!value.trim()) {
      setParsed(null);
      return;
    }
    let live = true;
    const timer = setTimeout(() => {
      solverClient()
        .call('parseRange', { text: value })
        .then((p) => live && setParsed(p))
        .catch(() => {});
    }, 150);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [value]);

  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor={id} className="text-sm font-medium">
          {t('equity.player', { n })}
        </label>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs underline" aria-label={t('equity.removePlayer', { n })}>
            ✕
          </button>
        )}
      </div>
      <input
        id={id}
        className="field"
        value={value}
        placeholder={t('equity.rangePlaceholder')}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={parsed?.ok === false}
        aria-describedby={`${id}-hint`}
        spellCheck={false}
        autoComplete="off"
      />
      <p id={`${id}-hint`} className="mt-1 min-h-5 text-xs text-slate-600 dark:text-slate-400">
        {parsed?.ok === true &&
          t(parsed.combos === 1 ? 'equity.combo' : 'equity.combos', {
            combos: count(parsed.combos),
            canonical: parsed.canonical,
          })}
        {parsed?.ok === false && <span className="text-amber-700 dark:text-amber-400">{parsed.error}</span>}
      </p>
    </div>
  );
}

export function EquityPage() {
  const [ranges, setRanges] = useState(['AhKh', 'QQ+, AKo']);
  const [board, setBoard] = useState('');
  const [dead, setDead] = useState('');
  const [mode, setMode] = useState<EquityMode>('auto');
  const [run, setRun] = useState<Run>({ kind: 'idle' });
  const runId = useRef(0);
  const ids = { board: useId(), dead: useId(), mode: useId() };

  async function calculate() {
    const my = ++runId.current;
    setRun({ kind: 'running' });
    try {
      const result = await solverClient().call('equity', { request: { ranges, board, dead, mode } });
      if (my === runId.current) setRun({ kind: 'done', result });
    } catch (e) {
      if (my !== runId.current) return;
      setRun(e instanceof CancelledError ? { kind: 'cancelled' } : { kind: 'failed', message: (e as Error).message });
    }
  }

  function cancel() {
    runId.current++;
    solverClient().cancel();
    setRun({ kind: 'cancelled' });
  }

  const result = run.kind === 'done' ? run.result : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('equity.heading')}</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('equity.intro')}</p>
      </div>

      <form
        className="card space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void calculate();
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          {ranges.map((r, i) => (
            <RangeField
              key={i}
              n={i + 1}
              value={r}
              onChange={(v) => setRanges((rs) => rs.map((x, j) => (j === i ? v : x)))}
              onRemove={ranges.length > 2 ? () => setRanges((rs) => rs.filter((_, j) => j !== i)) : undefined}
            />
          ))}
        </div>
        {ranges.length < MAX_PLAYERS && (
          <button type="button" className="btn-secondary" onClick={() => setRanges((rs) => [...rs, ''])}>
            {t('equity.addPlayer')}
          </button>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.board} className="mb-1 block text-sm font-medium">
              {t('equity.board')}
            </label>
            <input
              id={ids.board}
              className="field"
              value={board}
              placeholder={t('equity.boardPlaceholder')}
              onChange={(e) => setBoard(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor={ids.dead} className="mb-1 block text-sm font-medium">
              {t('equity.dead')}
            </label>
            <input
              id={ids.dead}
              className="field"
              value={dead}
              onChange={(e) => setDead(e.target.value)}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
          <div>
            <label htmlFor={ids.mode} className="mb-1 block text-sm font-medium">
              {t('equity.method')}
            </label>
            <select id={ids.mode} className="field" value={mode} onChange={(e) => setMode(e.target.value as EquityMode)}>
              <option value="auto">{t('equity.method.auto')}</option>
              <option value="exact">{t('equity.method.exact')}</option>
              <option value="montecarlo">{t('equity.method.montecarlo')}</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={run.kind === 'running'}>
            {run.kind === 'running' ? t('equity.running') : t('equity.calculate')}
          </button>
          {run.kind === 'running' && (
            <button type="button" className="btn-secondary" onClick={cancel}>
              {t('equity.cancel')}
            </button>
          )}
        </div>
      </form>

      <div aria-live="polite" data-testid="equity-result">
        {run.kind === 'cancelled' && <p className="text-sm">{t('equity.cancelled')}</p>}
        {run.kind === 'failed' && <p className="text-sm text-amber-700 dark:text-amber-400">{t('equity.error', { message: run.message })}</p>}
        {result && !result.ok && (
          <p className="text-sm text-amber-700 dark:text-amber-400">{t('equity.error', { message: result.error })}</p>
        )}
        {result?.ok && (
          <section className="card space-y-3">
            <span className="inline-block rounded-full border border-sky-700 px-2 py-0.5 text-xs text-sky-800 dark:border-sky-400 dark:text-sky-300">
              {t('equity.liveBadge')}
            </span>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="py-1 font-medium">{t('equity.col.player')}</th>
                  <th className="py-1 font-medium">{t('equity.col.equity')}</th>
                  {result.method === 'montecarlo' && <th className="py-1 font-medium">{t('equity.col.win')}</th>}
                  <th className="py-1 font-medium">{t('equity.col.tie')}</th>
                </tr>
              </thead>
              <tbody>
                {result.players.map((p, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <td className="py-1">
                      {t('equity.player', { n: i + 1 })} <span className="font-mono text-xs">{ranges[i]}</span>
                    </td>
                    <td className="py-1 font-mono" data-testid={`equity-${i}`}>
                      {pct(p.equity)}
                      {'stdError' in p && <span className="text-xs text-slate-500"> ± {pct(p.stdError)}</span>}
                    </td>
                    {'win' in p && <td className="py-1 font-mono">{pct(p.win)}</td>}
                    <td className="py-1 font-mono">{pct(p.tie)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {result.method === 'exact'
                ? t('equity.exactNote', { runouts: count(result.runouts) })
                : t('equity.mcNote', { samples: count(result.samples), seed: result.seed })}
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
