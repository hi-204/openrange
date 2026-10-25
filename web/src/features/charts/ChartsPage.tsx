import { useEffect, useId, useMemo, useState } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { ProvenanceBadge } from '../../lib/provenance/ProvenanceBadge';
import { loadJson, type Chart, type ChartFile, type ChartIndexEntry } from '../../lib/provenance/types';
import { actionColors } from '../solver/colors';
import { ClassGrid, UNREACHED } from './ClassGrid';

const COMBOS = (name: string) => (name.length === 2 ? 6 : name[2] === 's' ? 4 : 12);

function familyLabel(e: ChartIndexEntry): string {
  if (e.family === 'pushfold-hu') return t('charts.family.pushfoldHu');
  if (e.family.startsWith('pushfold-')) return t('charts.family.pushfoldMulti', { n: e.players });
  if (e.family === 'cash-6max') return t('charts.family.cash', { stacks: e.stacks.join('/') });
  return e.family;
}

function useChartFile(file: string | null) {
  const [doc, setDoc] = useState<ChartFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!file) return;
    let live = true;
    setDoc(null);
    loadJson<ChartFile>(`data/charts/${file}`)
      .then((d) => live && setDoc(d))
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [file]);
  return { doc, error };
}

/** Share of all 1326 combos taking each action, counting only hands that reach the spot. */
function shares(doc: ChartFile, chart: Chart): number[] {
  const out = chart.actions.map(() => 0);
  let total = 0;
  doc.classes.forEach((name, i) => {
    const w = COMBOS(name) * (chart.reach ? chart.reach[i]! : 1);
    total += w;
    chart.strategy[i]!.forEach((f, k) => (out[k]! += w * f));
  });
  return out.map((x) => (total > 0 ? x / total : 0));
}

function ChartView({ doc, chart, cell, setCell, title }: { doc: ChartFile; chart: Chart; cell: number | null; setCell: (c: number) => void; title?: string }) {
  const colors = actionColors(chart.actions, chart.actions.map((a) => /^(Raise|All-in)/.test(a)));
  const s = shares(doc, chart);
  return (
    <div className="space-y-2">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      <ul className="flex flex-wrap gap-3 text-sm" aria-label={t('charts.legend')}>
        {chart.actions.map((a, k) => (
          <li key={a} className="flex items-center gap-1">
            <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colors[k] }} />
            {a} <span className="font-mono">{pct(s[k]!, 1)}</span>
          </li>
        ))}
      </ul>
      <ClassGrid classes={doc.classes} strategy={chart.strategy} actions={chart.actions} colors={colors} reach={chart.reach} selected={cell} onSelect={setCell} label={chart.title} />
    </div>
  );
}

function CellDetail({ doc, chart, cell }: { doc: ChartFile; chart: Chart; cell: number }) {
  const name = doc.classes[cell]!;
  const reach = chart.reach?.[cell];
  if (reach !== undefined && reach < UNREACHED) return <p className="text-sm">{t('charts.notReached', { hand: name })}</p>;
  return (
    <table className="w-full text-left text-sm" data-testid="cell-detail">
      <caption className="mb-1 text-left font-medium">{t('charts.detail', { hand: name, combos: COMBOS(name) })}</caption>
      <thead>
        <tr>
          <th className="py-1">{t('charts.action')}</th>
          <th className="py-1">{t('charts.frequency')}</th>
          <th className="py-1">{t('charts.ev')}</th>
        </tr>
      </thead>
      <tbody>
        {chart.actions.map((a, k) => {
          const ev = chart.ev?.[cell]?.[k];
          const se = chart.evStdError?.[cell]?.[k];
          return (
            <tr key={a} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1">{a}</td>
              <td className="py-1 font-mono">{pct(chart.strategy[cell]![k]!, 1)}</td>
              <td className="py-1 font-mono">
                {ev === null || ev === undefined ? '—' : `${ev.toFixed(3)} bb`}
                {se !== null && se !== undefined && <span className="text-xs text-slate-500"> ± {se.toFixed(3)}</span>}
              </td>
            </tr>
          );
        })}
      </tbody>
      {reach !== undefined && (
        <tfoot>
          <tr>
            <td colSpan={3} className="pt-2 text-xs text-slate-600 dark:text-slate-400">
              {t('charts.reach', { pct: pct(reach, 0) })}
            </td>
          </tr>
        </tfoot>
      )}
    </table>
  );
}

export function ChartsPage() {
  const [index, setIndex] = useState<ChartIndexEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [stack, setStack] = useState<number | null>(null);
  const [chartId, setChartId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [cell, setCell] = useState<number | null>(null);
  const ids = { family: useId(), stack: useId(), chart: useId(), compare: useId() };

  useEffect(() => {
    loadJson<ChartIndexEntry[]>('data/charts/index.json')
      .then((ix) => {
        setIndex(ix);
        if (ix[0]) setFile(ix[0].file);
      })
      .catch((e: Error) => setError(e.message));
  }, []);
  const { doc, error: docError } = useChartFile(file);
  const entry = index?.find((e) => e.file === file) ?? null;

  const inStack = useMemo(() => (doc ? doc.charts.filter((c) => (c.stack ?? doc.stack) === stack) : []), [doc, stack]);
  useEffect(() => {
    if (!doc) return;
    const stacks = [...new Set(doc.charts.map((c) => c.stack ?? doc.stack!))];
    const s = stacks.includes(stack ?? -1) ? stack : (stacks.includes(10) ? 10 : stacks[stacks.length - 1]!);
    setStack(s);
  }, [doc]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!inStack.length) return;
    if (!inStack.some((c) => c.id === chartId)) setChartId(inStack[0]!.id);
    setCompareId(null);
  }, [inStack]); // eslint-disable-line react-hooks/exhaustive-deps

  const chart = inStack.find((c) => c.id === chartId) ?? null;
  const compare = inStack.find((c) => c.id === compareId) ?? null;
  const stacks = doc ? [...new Set(doc.charts.map((c) => c.stack ?? doc.stack!))].sort((a, b) => a - b) : [];
  const outOfBand = doc?.sanityBands?.filter((b) => !b.inBand) ?? [];

  if (error) return <p className="text-amber-700 dark:text-amber-400">{t('charts.loadError', { message: error })}</p>;
  if (!index) return <p>{t('charts.loading')}</p>;
  if (index.length === 0) return <p>{t('charts.none')}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('charts.heading')}</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('charts.intro')}</p>
      </div>

      <div className="card grid gap-4 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <label htmlFor={ids.family} className="mb-1 block text-sm font-medium">{t('charts.familyLabel')}</label>
          <select id={ids.family} className="field" value={file ?? ''} onChange={(e) => setFile(e.target.value)}>
            {index.map((e) => (
              <option key={e.file} value={e.file}>{familyLabel(e)}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={ids.stack} className="mb-1 block text-sm font-medium">{t('charts.stack')}</label>
          <select id={ids.stack} className="field" value={stack ?? ''} onChange={(e) => setStack(Number(e.target.value))}>
            {stacks.map((s) => (
              <option key={s} value={s}>{t('charts.bb', { n: s })}</option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={ids.chart} className="mb-1 block text-sm font-medium">{t('charts.spot')}</label>
            <select id={ids.chart} className="field" value={chartId ?? ''} onChange={(e) => { setChartId(e.target.value); setCell(null); }}>
              {inStack.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.compare} className="mb-1 block text-sm font-medium">{t('charts.compareWith')}</label>
            <select id={ids.compare} className="field" value={compareId ?? ''} onChange={(e) => setCompareId(e.target.value || null)}>
              <option value="">{t('charts.noCompare')}</option>
              {inStack.filter((c) => c.id !== chartId).map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {docError && <p className="text-amber-700 dark:text-amber-400">{t('charts.loadError', { message: docError })}</p>}
      {doc && entry && (
        <section className="space-y-3" aria-live="polite">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ProvenanceBadge p={doc.provenance} />
            {chart?.solve && <span className="text-slate-600 dark:text-slate-400">{t('charts.exactNote', { ex: chart.solve.exploitabilityBb.toExponential(1) })}</span>}
          </div>
          {doc.provenance.source === 'solver_approx' && (
            <p role="note" className="rounded-md border border-amber-600 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200" data-testid="approx-warning">
              {t('charts.approxWarning')}
            </p>
          )}
          {outOfBand.length > 0 && (
            <div role="alert" className="rounded-md border-2 border-red-700 bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200" data-testid="band-warning">
              <p className="font-semibold">{t('charts.bandHeading')}</p>
              <ul className="ml-5 list-disc">
                {outOfBand.map((b) => (
                  <li key={b.seat}>{t('charts.bandRow', { seat: b.seat, measured: pct(b.measured, 1), low: pct(b.low, 0), high: pct(b.high, 0) })}</li>
                ))}
              </ul>
              <p className="mt-1">{t('charts.bandNote')}</p>
            </div>
          )}
          {chart && (
            <div className={`grid gap-6 ${compare ? 'lg:grid-cols-2' : 'lg:grid-cols-[minmax(0,30rem)_1fr]'}`} data-testid="chart-view">
              <ChartView doc={doc} chart={chart} cell={cell} setCell={setCell} title={compare ? chart.title : undefined} />
              {compare ? (
                <ChartView doc={doc} chart={compare} cell={cell} setCell={setCell} title={compare.title} />
              ) : (
                <div className="space-y-3 text-sm">
                  {chart.line && <p className="text-slate-600 dark:text-slate-400">{t('charts.line', { line: chart.line })}</p>}
                  {cell === null ? <p>{t('charts.pickCell')}</p> : <CellDetail doc={doc} chart={chart} cell={cell} />}
                  <p className="text-xs text-slate-600 dark:text-slate-400">{t('charts.evNote', { unit: doc.evUnit })}</p>
                </div>
              )}
            </div>
          )}
          {compare && cell !== null && (
            <div className="grid gap-6 lg:grid-cols-2">
              <CellDetail doc={doc} chart={chart!} cell={cell} />
              <CellDetail doc={doc} chart={compare} cell={cell} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
