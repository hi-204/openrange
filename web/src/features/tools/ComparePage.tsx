// Compare views (D-091): any two charts side by side (across files and stacks), with a grid of
// the differences and the hands that differ most.

import { useEffect, useId, useMemo, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { cellName } from '../../lib/poker/hands';
import { loadJson, type ChartFile, type ChartIndexEntry } from '../../lib/provenance/types';
import { ErrorState, SegmentedControl, Skeleton } from '../../lib/ui/components';
import { familyLabel } from '../charts/ChartsPage';
import { ClassGrid } from '../charts/ClassGrid';
import { chartDiff, rangeShare, type Measure } from '../charts/compare';

const NAMES = Array.from({ length: 169 }, (_, i) => cellName(i));
type Pick = { file: string; chart: string };

function Picker({ label, index, docs, value, onChange }: { label: string; index: ChartIndexEntry[]; docs: Map<string, ChartFile>; value: Pick; onChange: (p: Pick) => void }) {
  const ids = { file: useId(), chart: useId() };
  const doc = docs.get(value.file);
  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-semibold">{label}</legend>
      <label htmlFor={ids.file} className="block text-sm">
        {t('compare.file')}
      </label>
      <select id={ids.file} className="field" value={value.file} onChange={(e) => onChange({ file: e.target.value, chart: docs.get(e.target.value)?.charts[0]?.id ?? '' })}>
        {index.map((e) => (
          <option key={e.file} value={e.file}>
            {familyLabel(e)}
          </option>
        ))}
      </select>
      <label htmlFor={ids.chart} className="block text-sm">
        {t('compare.chart')}
      </label>
      <select id={ids.chart} className="field" value={value.chart} onChange={(e) => onChange({ ...value, chart: e.target.value })}>
        {(doc?.charts ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
    </fieldset>
  );
}

export function ComparePage() {
  const [index, setIndex] = useState<ChartIndexEntry[] | null>(null);
  const [docs, setDocs] = useState<Map<string, ChartFile>>(new Map());
  const [a, setA] = useState<Pick>({ file: 'cash-6max-100bb.json', chart: 'first-in-CO' });
  const [b, setB] = useState<Pick>({ file: 'cash-6max-100bb.json', chart: 'first-in-BTN' });
  const [measure, setMeasure] = useState<Measure>('plays');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const ix = await loadJson<ChartIndexEntry[]>('data/charts/index.json');
      const all = new Map<string, ChartFile>();
      await Promise.all(ix.map(async (e) => all.set(e.file, await loadJson<ChartFile>(`data/charts/${e.file}`))));
      setIndex(ix);
      setDocs(all);
    })().catch((e: Error) => setError(e.message));
  }, []);

  const A = docs.get(a.file) && { doc: docs.get(a.file)!, chart: docs.get(a.file)!.charts.find((c) => c.id === a.chart)! };
  const B = docs.get(b.file) && { doc: docs.get(b.file)!, chart: docs.get(b.file)!.charts.find((c) => c.id === b.chart)! };
  const diff = useMemo(() => (A?.chart && B?.chart ? chartDiff(NAMES, A, B, measure) : null), [A, B, measure]);

  if (error) return <ErrorState title={t('flow.errorTitle')} message={error} />;
  if (!index) return <Skeleton className="h-64" />;
  return (
    <div className="space-y-5" data-testid="compare">
      <p className="max-w-prose text-sm text-ink-muted">{t('compare.intro')}</p>
      <section className="card grid gap-4 md:grid-cols-2">
        <Picker label={t('compare.a')} index={index} docs={docs} value={a} onChange={setA} />
        <Picker label={t('compare.b')} index={index} docs={docs} value={b} onChange={setB} />
      </section>
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('compare.measure')}</p>
        <SegmentedControl label={t('compare.measure')} value={measure} onChange={setMeasure} size="sm" options={(['plays', 'aggressive'] as const).map((m) => ({ value: m, label: t(`compare.measure.${m}` as MessageKey) }))} />
      </div>
      {A?.chart && B?.chart && diff && (
        <>
          <p className="text-sm" data-testid="compare-shares">
            {t('compare.shares', { a: A.chart.title, pa: pct(rangeShare(A.doc, A.chart, measure), 1), b: B.chart.title, pb: pct(rangeShare(B.doc, B.chart, measure), 1) })}
          </p>
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('compare.diffGrid', { a: A.chart.title, b: B.chart.title })}</p>
              <ClassGrid classes={NAMES} strategy={diff.cells.map((c) => [1 - Math.abs(c.d), Math.max(c.d, 0), Math.max(-c.d, 0)])} actions={[t('compare.same'), t('compare.moreA'), t('compare.moreB')]} colors={['transparent', '#0072B2', '#E69F00']} selected={null} onSelect={() => undefined} label={t('compare.diffGrid', { a: A.chart.title, b: B.chart.title })} />
              <p className="text-xs text-ink-muted">{t('compare.legend')}</p>
            </div>
            <div className="space-y-2 text-sm" data-testid="compare-largest">
              <p className="font-medium">{t('compare.largest')}</p>
              {diff.largest.length === 0 ? (
                <p>{t('compare.none')}</p>
              ) : (
                <ul className="space-y-0.5">
                  {diff.largest.map((c) => (
                    <li key={c.name} className="num">
                      {t('compare.row', { hand: c.name, a: pct(c.a, 0), b: pct(c.b, 0) })}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-ink-muted">{t('compare.note')}</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
