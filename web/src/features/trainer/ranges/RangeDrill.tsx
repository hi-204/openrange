// Range-building drill (D-075): paint a range on the grid, then compare it with a chart.
// Exact heads-up push/fold charts are graded references; the 6-max cash opens are approximate
// and shown as practice.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { t } from '../../../lib/i18n';
import { cellName, cellOf } from '../../../lib/poker/hands';
import { ProvenanceBadge } from '../../../lib/provenance/ProvenanceBadge';
import { loadJson, type ChartFile } from '../../../lib/provenance/types';
import { Skeleton } from '../../../lib/ui/components';
import { solverClient } from '../../../lib/wasm/client';
import { ClassGrid } from '../../charts/ClassGrid';
import { COMBO_STRINGS } from '../../lessons/widgets/cards';
import { actionColors } from '../../solver/colors';
import { mulberry32 } from '../preflop/deal';
import { scoreRange } from './rangeScore';

const NAMES = Array.from({ length: 169 }, (_, i) => cellName(i));
const STACKS = [5, 8, 10, 12, 15, 20];
const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB'];
type Source = 'hu' | 'cash';
type Task = { source: Source; file: string; chart: string; prompt: string };

function pickTask(source: Source, rnd: () => number): Task {
  if (source === 'hu') {
    const stack = STACKS[Math.floor(rnd() * STACKS.length)]!;
    const shove = rnd() < 0.5;
    return { source, file: 'pushfold-hu.json', chart: `${shove ? 'sb-shove' : 'bb-call'}-${stack}`, prompt: t(shove ? 'ranges.task.shove' : 'ranges.task.call', { stack }) };
  }
  const seat = SEATS[Math.floor(rnd() * SEATS.length)]!;
  return { source, file: 'cash-6max-100bb.json', chart: `first-in-${seat}`, prompt: t('ranges.task.open', { seat }) };
}

export function RangeDrill() {
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const [source, setSource] = useState<Source>('hu');
  const [task, setTask] = useState<Task>(() => pickTask('hu', rnd));
  const [docs, setDocs] = useState<Map<string, ChartFile>>(new Map());
  const [picked, setPicked] = useState<boolean[]>(() => NAMES.map(() => false));
  const [text, setText] = useState('');
  const [textError, setTextError] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (docs.has(task.file)) return;
    loadJson<ChartFile>(`data/charts/${task.file}`).then(
      (d) => setDocs((m) => new Map(m).set(task.file, d)),
      (e: Error) => setError(e.message),
    );
  }, [task.file, docs]);

  const doc = docs.get(task.file);
  const chart = doc?.charts.find((c) => c.id === task.chart);
  const target = useMemo(() => {
    if (!doc || !chart) return null;
    const k = chart.actions.length - 1; // the shove, call or raise
    return NAMES.map((n) => chart.strategy[doc.classes.indexOf(n)]![k]!);
  }, [doc, chart]);

  const next = useCallback(
    (s: Source = source) => {
      setTask(pickTask(s, rnd));
      setPicked(NAMES.map(() => false));
      setChecked(false);
      setText('');
    },
    [rnd, source],
  );

  const fromText = async () => {
    setTextError(null);
    try {
      const r = await solverClient().call('parseRange', { text });
      if (!r.ok) return setTextError(r.error);
      const sum = new Array(169).fill(0);
      const count = new Array(169).fill(0);
      COMBO_STRINGS.forEach((c, i) => {
        const k = cellOf(c).index;
        sum[k] += r.weights[i]!;
        count[k]++;
      });
      setPicked(sum.map((s, k) => s / count[k] >= 0.5));
    } catch (e) {
      setTextError((e as Error).message);
    }
  };

  if (error) return <p className="text-amber-700 dark:text-amber-400">{error}</p>;
  const score = checked && target ? scoreRange(target, picked) : null;
  const mine = picked.map((p) => [p ? 0 : 1, p ? 1 : 0]);
  return (
    <div className="space-y-4" data-testid="range-drill">
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="sr-only">{t('ranges.source')}</legend>
        {(['hu', 'cash'] as const).map((s) => (
          <label key={s} className="flex items-center gap-2">
            <input
              type="radio"
              name="range-source"
              checked={source === s}
              onChange={() => {
                setSource(s);
                next(s);
              }}
            />
            {t(s === 'hu' ? 'ranges.source.hu' : 'ranges.source.cash')}
          </label>
        ))}
      </fieldset>
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold" data-testid="range-task">
          {task.prompt}
        </h2>
        <p className="text-sm text-ink-muted">{t('ranges.how')}</p>
        {!target ? (
          <Skeleton className="h-64" />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('ranges.yours', { combos: picked.reduce((s, p, i) => s + (p ? (NAMES[i]!.length === 2 ? 6 : NAMES[i]!.endsWith('s') ? 4 : 12) : 0), 0) })}</p>
              <ClassGrid
                classes={NAMES}
                strategy={mine}
                actions={[t('widget.grid.out'), t('widget.grid.in')]}
                colors={['transparent', '#E69F00']}
                selected={null}
                onSelect={(i) => !checked && setPicked((p) => p.map((v, j) => (j === i ? !v : v)))}
                label={t('ranges.yoursLabel')}
              />
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-48 flex-1">
                  <label htmlFor="range-text" className="mb-1 block text-sm font-medium">
                    {t('ranges.type')}
                  </label>
                  <input id="range-text" className="field" value={text} disabled={checked} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder="22+, A2s+, KTo+" />
                </div>
                <button type="button" className="btn-secondary" disabled={checked || !text.trim()} onClick={() => void fromText()}>
                  {t('ranges.fill')}
                </button>
                <button type="button" className="btn-quiet" disabled={checked} onClick={() => setPicked(NAMES.map(() => false))}>
                  {t('ranges.clear')}
                </button>
              </div>
              {textError && <p className="text-sm text-amber-700 dark:text-amber-400">{textError}</p>}
            </div>
            {score && chart && doc && (
              <div className="space-y-2" data-testid="range-result">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium">{chart.title}</span>
                  <ProvenanceBadge p={doc.provenance} />
                </div>
                <ClassGrid classes={doc.classes} strategy={chart.strategy} actions={chart.actions} colors={actionColors(chart.actions, chart.actions.map((a) => /^(Raise|All-in)/.test(a)))} reach={chart.reach} selected={null} onSelect={() => undefined} label={chart.title} />
              </div>
            )}
          </div>
        )}
        {score && (
          <div className="space-y-1 text-sm" data-testid="range-score">
            <p className="font-medium">{t('ranges.result', { off: score.error.toFixed(0), best: score.bestError.toFixed(0), chart: score.chartCombos.toFixed(0) })}</p>
            <p>{t('ranges.detail', { hit: score.hit.toFixed(0), missed: score.missed.toFixed(0), extra: score.extra.toFixed(0) })}</p>
            {score.missedHands.length > 0 && <p>{t('ranges.missedHands', { hands: score.missedHands.slice(0, 8).join(', ') })}</p>}
            {score.extraHands.length > 0 && <p>{t('ranges.extraHands', { hands: score.extraHands.slice(0, 8).join(', ') })}</p>}
            {task.source === 'cash' && <p className="text-xs text-ink-muted">{t('ranges.practice')}</p>}
          </div>
        )}
        <div className="flex gap-2">
          {!checked ? (
            <button type="button" className="btn-primary" disabled={!target} onClick={() => setChecked(true)}>
              {t('ranges.check')}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => next()}>
              {t('ranges.next')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
