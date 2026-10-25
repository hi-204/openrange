import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { fmtLoss } from './explain/render';
import { CATEGORIES, DEFAULT_THRESHOLDS, type Thresholds, type Unit } from './grading';
import type { FamilyState } from './srs';
import { groupStats, MIN_SAMPLE, type GradedAnswer } from './stats';
import { exportAll, importAll, trainerStore, type AnswerRecord, type TrainerSettings } from './store';

const DIMENSIONS = ['drill', 'reference', 'position', 'scenario', 'street', 'stack', 'handType'];
const UNITS: Unit[] = ['bb', 'pctPot'];

function when(ms: number): string {
  return new Date(ms).toLocaleString();
}

function Stats({ answers }: { answers: AnswerRecord[] }) {
  const graded: GradedAnswer[] = useMemo(
    () => answers.filter((a) => a.graded && a.category && a.loss !== null).map((a) => ({ unit: a.unit, loss: a.loss!, category: a.category!, groups: a.groups })),
    [answers],
  );
  const stats = useMemo(() => groupStats(graded, DIMENSIONS), [graded]);
  return (
    <>
      {UNITS.map((unit) => {
        const inUnit = graded.filter((a) => a.unit === unit);
        if (!inUnit.length) return null;
        const counts = CATEGORIES.map((c) => `${t(`trainer.category.${c}` as MessageKey)} ${inUnit.filter((a) => a.category === c).length}`);
        return (
          <section key={unit} className="card space-y-4" data-testid={`stats-${unit}`}>
            <h3 className="font-semibold">{t(`review.unit.${unit}` as MessageKey)}</h3>
            <p className="text-sm">{t('review.categories', { list: counts.join(', ') })}</p>
            {DIMENSIONS.map((dim) => {
              const rows = stats.filter((s) => s.unit === unit && s.dimension === dim);
              if (rows.length < 2 && dim !== 'drill') return null;
              return (
                <table key={dim} className="w-full text-left text-sm">
                  <caption className="mb-1 text-left font-medium">{t('review.byDimension', { dimension: t(`review.dim.${dim}` as MessageKey) })}</caption>
                  <thead>
                    <tr>
                      <th className="py-1">{t('review.col.group')}</th>
                      <th className="py-1">{t('review.col.n')}</th>
                      <th className="py-1">{t('review.col.loss')}</th>
                      <th className="py-1">{t('review.col.errors')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.value} className="border-t border-slate-100 dark:border-slate-800" data-leak={r.leak}>
                        <td className="py-1">
                          {r.value}
                          {r.leak && <span className="ml-2 rounded border border-[#D55E00] px-1 text-xs font-semibold text-[#a34700] dark:text-[#ff8f4a]">{t('review.leak')}</span>}
                        </td>
                        <td className="py-1 font-mono">{r.n}</td>
                        {r.enough ? (
                          <>
                            <td className="py-1 font-mono">
                              {fmtLoss(r.meanLoss, unit)}
                              {r.lossInterval && <span className="text-xs text-slate-500"> ({fmtLoss(Math.max(0, r.lossInterval.low), unit)} – {fmtLoss(r.lossInterval.high, unit)})</span>}
                            </td>
                            <td className="py-1 font-mono">
                              {pct(r.errorRate, 0)} <span className="text-xs text-slate-500">({pct(r.errorInterval.low, 0)} – {pct(r.errorInterval.high, 0)})</span>
                            </td>
                          </>
                        ) : (
                          <td className="py-1 text-slate-500" colSpan={2}>
                            {t('review.notEnough', { n: r.n, min: MIN_SAMPLE })}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              );
            })}
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('review.leakNote', { min: MIN_SAMPLE })}</p>
          </section>
        );
      })}
    </>
  );
}

function ThresholdSettings({ settings, onSave }: { settings: TrainerSettings; onSave: (s: TrainerSettings) => Promise<void> }) {
  const base = settings.thresholds ?? DEFAULT_THRESHOLDS;
  const [draft, setDraft] = useState<Record<Unit, string[]>>({ bb: base.bb.map(String), pctPot: base.pctPot.map(String) });
  const [message, setMessage] = useState<string | null>(null);
  const id = useId();
  const save = async () => {
    const parsed = UNITS.map((u) => draft[u].map(Number));
    if (parsed.some((ts) => ts.some((x, i) => !(x > 0) || (i > 0 && x <= ts[i - 1]!)))) {
      setMessage(t('review.invalid'));
      return;
    }
    await onSave({ thresholds: { bb: parsed[0] as Thresholds, pctPot: parsed[1] as Thresholds } });
    setMessage(t('review.saved'));
  };
  return (
    <section className="card space-y-3">
      <h3 className="font-semibold">{t('review.settings')}</h3>
      <p className="text-xs text-slate-600 dark:text-slate-400">{t('review.settingsNote')}</p>
      {UNITS.map((u) => (
        <div key={u} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.slice(0, 4).map((c, i) => (
            <div key={c}>
              <label htmlFor={`${id}-${u}-${i}`} className="mb-1 block text-xs">
                {t('review.thresholdLabel', { unit: u === 'bb' ? 'bb' : '% pot', category: t(`trainer.category.${c}` as MessageKey) })}
              </label>
              <input
                id={`${id}-${u}-${i}`}
                className="field"
                inputMode="decimal"
                value={draft[u][i]}
                onChange={(e) => setDraft((d) => ({ ...d, [u]: d[u].map((x, k) => (k === i ? e.target.value : x)) }))}
              />
            </div>
          ))}
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={() => void save()}>
          {t('review.save')}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            setDraft({ bb: DEFAULT_THRESHOLDS.bb.map(String), pctPot: DEFAULT_THRESHOLDS.pctPot.map(String) });
            void onSave({ thresholds: null }).then(() => setMessage(t('review.saved')));
          }}
        >
          {t('review.defaults')}
        </button>
      </div>
      {message && <p role="status" className="text-sm">{message}</p>}
    </section>
  );
}

export function ReviewPage() {
  const [answers, setAnswers] = useState<AnswerRecord[] | null>(null);
  const [families, setFamilies] = useState<Map<string, FamilyState>>(new Map());
  const [settings, setSettings] = useState<TrainerSettings>({ thresholds: null });
  const [message, setMessage] = useState<string | null>(null);
  const fileId = useId();
  const store = trainerStore();

  const reload = useCallback(async () => {
    setAnswers(await store.answers());
    setFamilies(await store.families());
    setSettings(await store.settings());
  }, [store]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const download = async () => {
    const blob = new Blob([JSON.stringify(await exportAll(store), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `openrange-trainer-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const upload = async (file: File) => {
    try {
      const n = await importAll(store, JSON.parse(await file.text()));
      setMessage(t('review.imported', { n }));
      await reload();
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const reset = async () => {
    if (!window.confirm(t('review.resetConfirm'))) return;
    await store.reset();
    setMessage(t('review.resetDone'));
    await reload();
  };

  if (!answers) return <p>{t('review.loading')}</p>;
  const now = Date.now();
  const fam = [...families.values()];
  const due = fam.filter((f) => f.due <= now).length;
  const next = fam.length ? Math.min(...fam.map((f) => f.due)) : null;
  const gradedCount = answers.filter((a) => a.graded && a.category).length;

  return (
    <div className="space-y-4" data-testid="review">
      {answers.length === 0 ? (
        <p className="card">{t('review.empty')}</p>
      ) : (
        <>
          <p className="text-sm" data-testid="review-summary">
            {t('review.summary', { n: answers.length, graded: gradedCount, practice: answers.length - gradedCount })}
          </p>
          <Stats answers={answers} />
          <section className="card space-y-2">
            <h3 className="font-semibold">{t('review.schedule')}</h3>
            <p className="text-sm">{fam.length ? t('review.scheduleSummary', { families: fam.length, due, next: next === null || next <= now ? t('review.now') : when(next) }) : t('review.scheduleNone')}</p>
          </section>
          <section className="card">
            <table className="w-full text-left text-sm">
              <caption className="mb-1 text-left font-semibold">{t('review.recent')}</caption>
              <thead>
                <tr>
                  <th className="py-1">{t('review.col.when')}</th>
                  <th className="py-1">{t('review.col.hand')}</th>
                  <th className="py-1">{t('review.col.answer')}</th>
                  <th className="py-1">{t('review.col.grade')}</th>
                  <th className="py-1">{t('review.col.lossShort')}</th>
                </tr>
              </thead>
              <tbody>
                {answers
                  .slice(-20)
                  .reverse()
                  .map((a, i) => (
                    <tr key={a.id ?? i} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 text-xs">{when(a.at)}</td>
                      <td className="py-1 font-mono">{a.hand}</td>
                      <td className="py-1">{a.actions[a.chosen]}</td>
                      <td className="py-1">{a.category ? t(`trainer.category.${a.category}` as MessageKey) : t(a.drill === 'postflop' ? 'trainer.category.notGraded' : 'trainer.category.practice')}</td>
                      <td className="py-1 font-mono">{a.loss === null ? '—' : fmtLoss(a.loss, a.unit)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </section>
        </>
      )}
      <ThresholdSettings
        key={JSON.stringify(settings)}
        settings={settings}
        onSave={async (s) => {
          await store.putSettings(s);
          setSettings(s);
        }}
      />
      <section className="card space-y-3">
        <h3 className="font-semibold">{t('review.data')}</h3>
        <p className="text-xs text-slate-600 dark:text-slate-400">{t('review.dataNote')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-secondary" onClick={() => void download()}>
            {t('review.export')}
          </button>
          <label htmlFor={fileId} className="btn-secondary cursor-pointer">
            {t('review.import')}
          </label>
          <input id={fileId} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <button type="button" className="btn-secondary" onClick={() => void reset()}>
            {t('review.reset')}
          </button>
        </div>
        {message && (
          <p role="status" className="text-sm">
            {message}
          </p>
        )}
      </section>
    </div>
  );
}
