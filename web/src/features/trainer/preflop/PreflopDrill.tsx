import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { t, type MessageKey } from '../../../lib/i18n';
import { Cards } from '../../../lib/poker/Cards';
import { ProvenanceBadge } from '../../../lib/provenance/ProvenanceBadge';
import { loadJson, type ChartFile, type ChartIndexEntry } from '../../../lib/provenance/types';
import { solverClient } from '../../../lib/wasm/client';
import { familyLabel } from '../../charts/ChartsPage';
import { AnswerPanel, type ActionRow } from '../AnswerPanel';
import type { Claim } from '../explain/claims';
import { preflopClaims } from '../explain/preflop';
import { fmtBb, fmtLoss } from '../explain/render';
import { grade, type Category } from '../grading';
import { handType, recordAnswer } from '../session';
import { useDrillKeys } from '../shortcuts';
import type { FamilyState } from '../srs';
import { trainerStore, type TrainerSettings } from '../store';
import { candidates, deal, drillSources, mulberry32, scenarioOf, stackBand, type Dealt, type Difficulty, type Filters } from './deal';

const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SCENARIOS = ['first-in', 'vs-all-in', 'vs-open', 'squeeze', 'vs-3bet', 'vs-4bet', 'vs-5bet'];
const DIFFICULTIES: Difficulty[] = ['any', 'easy', 'medium', 'hard'];

type Answered = { chosen: number; category: Category | null; claims: Claim[]; loss: number | null };

function question(d: Dealt): string[] {
  const s = d.stack;
  if (d.doc.family === 'pushfold-hu') return [t('trainer.pf.headsUp', { stack: s }), d.chart.id.startsWith('sb-shove') ? t('trainer.pf.sbFirst') : t('trainer.pf.bbVsShove', { stack: s })];
  const intro = d.doc.family === 'cash-6max' ? t('trainer.pf.cash', { stack: s }) : t('trainer.pf.players', { n: d.doc.players ?? d.source.players, stack: s });
  return [intro, t('trainer.pf.youAre', { seat: d.chart.seat }), d.chart.line ? t('trainer.pf.action', { line: d.chart.line }) : t('trainer.pf.firstToAct')];
}

export function PreflopDrill() {
  const [index, setIndex] = useState<ChartIndexEntry[] | null>(null);
  const [docs, setDocs] = useState<Map<string, ChartFile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [families, setFamilies] = useState<Map<string, FamilyState>>(new Map());
  const [settings, setSettings] = useState<TrainerSettings>({ thresholds: null });
  const [dealt, setDealt] = useState<Dealt | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [busy, setBusy] = useState(false);
  const [tally, setTally] = useState({ n: 0, loss: 0 });
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const ids = { min: useId(), max: useId(), difficulty: useId() };

  useEffect(() => {
    loadJson<ChartIndexEntry[]>('data/charts/index.json')
      .then((ix) => {
        setIndex(ix);
        setFilters({ files: drillSources(ix).filter((s) => s.graded).map((s) => s.file), seats: [], scenarios: [], stackMin: 0, stackMax: 100, difficulty: 'any' });
      })
      .catch((e: Error) => setError(e.message));
    const store = trainerStore();
    store.families().then(setFamilies).catch((e: Error) => setError(e.message));
    store.settings().then(setSettings).catch(() => undefined);
  }, []);

  // Load the chart files the filters use.
  useEffect(() => {
    if (!filters) return;
    for (const f of filters.files) {
      if (docs.has(f)) continue;
      loadJson<ChartFile>(`data/charts/${f}`)
        .then((d) => setDocs((m) => new Map(m).set(f, d)))
        .catch((e: Error) => setError(e.message));
    }
  }, [filters, docs]);

  const sources = useMemo(() => (index ? drillSources(index) : []), [index]);
  const ready = !!filters && filters.files.every((f) => docs.has(f));
  const pool = useMemo(() => {
    if (!filters || !ready) return null;
    const loaded = sources.filter((s) => docs.has(s.file)).map((source) => ({ source, doc: docs.get(source.file)! }));
    return candidates(loaded, filters);
  }, [filters, ready, sources, docs]);

  const next = useCallback(() => {
    if (!pool) return;
    setAnswered(null);
    setDealt(deal(pool, families, Date.now(), rnd));
  }, [pool, families, rnd]);

  // Deal when the pool changes (first load or new filters).
  useEffect(() => {
    if (pool) {
      setAnswered(null);
      setDealt(deal(pool, families, Date.now(), rnd));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const answer = useCallback(
    async (chosen: number) => {
      if (!dealt || answered || busy) return;
      setBusy(true);
      try {
        const { chart, doc, classIndex: k, source } = dealt;
        const ev = chart.ev![k]!;
        const se = chart.evStdError?.[k] ?? null;
        const strategy = chart.strategy[k]!;
        const g = source.graded ? grade({ ev, evStdError: se, strategy, chosen, unit: 'bb', thresholds: settings.thresholds?.bb }) : null;
        let headsUp;
        if (doc.family === 'pushfold-hu') {
          const role = chart.id.startsWith('sb-shove') ? ('shove' as const) : ('call' as const);
          const other = doc.charts.find((c) => c.id === (role === 'shove' ? `bb-call-${dealt.stack}` : `sb-shove-${dealt.stack}`));
          if (other) {
            const r = await solverClient().call('preflopMatchup', { hero: dealt.handClass, villain: other.strategy.map((row) => row[1]!) });
            headsUp = { stack: dealt.stack, role, matchup: r.combos };
          }
        }
        const claims = preflopClaims({ actions: chart.actions, ev, evStdError: se, strategy, chosen, grade: g, headsUp });
        setAnswered({ chosen, category: g?.category ?? null, claims, loss: g?.loss ?? null });
        if (g) setTally((x) => ({ n: x.n + 1, loss: x.loss + g.loss }));
        const scenario = scenarioOf(chart);
        const updated = await recordAnswer(
          trainerStore(),
          {
            at: Date.now(),
            drill: 'preflop',
            graded: source.graded,
            family: dealt.family,
            reference: { file: source.file, chart: chart.id, source: doc.provenance.source, gitCommit: doc.provenance.gitCommit },
            hand: dealt.combo,
            handClass: dealt.handClass,
            actions: chart.actions,
            chosen,
            unit: 'bb',
            category: g?.category ?? null,
            loss: g?.loss ?? null,
            gradedLoss: g?.gradedLoss ?? null,
            groups: { drill: 'preflop', reference: doc.family, position: chart.seat, scenario, stack: stackBand(doc.family, dealt.stack), handType: handType(dealt.handClass), handClass: dealt.handClass },
          },
          families,
        );
        setFamilies(updated);
      } catch (e) {
        setError(t('trainer.saveError', { message: e instanceof Error ? e.message : String(e) }));
      } finally {
        setBusy(false);
      }
    },
    [dealt, answered, busy, settings, families],
  );

  useDrillKeys(dealt && !answered ? dealt.chart.actions : null, answer, answered ? next : null);

  if (error) return <p className="text-amber-700 dark:text-amber-400">{t('trainer.loadError', { message: error })}</p>;
  if (!index || !filters) return <p>{t('trainer.loading')}</p>;

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const rows: ActionRow[] = dealt
    ? dealt.chart.actions.map((action, a) => {
        const ev = dealt.chart.ev?.[dealt.classIndex]?.[a] ?? null;
        return { action, frequency: dealt.chart.strategy[dealt.classIndex]![a]!, ev, evText: ev === null ? '—' : fmtBb(ev), stdError: dealt.chart.evStdError?.[dealt.classIndex]?.[a] ?? null };
      })
    : [];

  return (
    <div className="space-y-4">
      <details className="card" data-testid="preflop-filters">
        <summary className="cursor-pointer font-medium">{t('trainer.filters')}</summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('trainer.filters.sources')}</legend>
            {sources.map((s) => (
              <label key={s.file} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={filters.files.includes(s.file)} onChange={() => setFilters({ ...filters, files: toggle(filters.files, s.file) })} />
                {familyLabel(index.find((e) => e.file === s.file)!)}
              </label>
            ))}
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{t('trainer.filters.practiceNote')}</p>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">{t('trainer.filters.seats')}</legend>
            <div className="flex flex-wrap gap-3">
              {SEATS.map((seat) => (
                <label key={seat} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={filters.seats.includes(seat)} onChange={() => setFilters({ ...filters, seats: toggle(filters.seats, seat) })} />
                  {seat}
                </label>
              ))}
            </div>
            <legend className="mb-1 mt-3 text-sm font-medium">{t('trainer.filters.scenarios')}</legend>
            <div className="flex flex-wrap gap-3">
              {SCENARIOS.map((sc) => (
                <label key={sc} className="flex items-center gap-1 text-sm">
                  <input type="checkbox" checked={filters.scenarios.includes(sc)} onChange={() => setFilters({ ...filters, scenarios: toggle(filters.scenarios, sc) })} />
                  {t(`trainer.scenario.${sc}` as MessageKey)}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={ids.min} className="mb-1 block text-sm font-medium">{t('trainer.filters.stackMin')}</label>
              <input id={ids.min} className="field" type="number" min={0} value={filters.stackMin} onChange={(e) => setFilters({ ...filters, stackMin: Number(e.target.value) })} />
            </div>
            <div>
              <label htmlFor={ids.max} className="mb-1 block text-sm font-medium">{t('trainer.filters.stackMax')}</label>
              <input id={ids.max} className="field" type="number" min={0} value={filters.stackMax} onChange={(e) => setFilters({ ...filters, stackMax: Number(e.target.value) })} />
            </div>
          </div>
          <div>
            <label htmlFor={ids.difficulty} className="mb-1 block text-sm font-medium">{t('trainer.filters.difficulty')}</label>
            <select id={ids.difficulty} className="field" value={filters.difficulty} onChange={(e) => setFilters({ ...filters, difficulty: e.target.value as Difficulty })}>
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>
                  {t(`trainer.difficulty.${d}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </details>

      {!ready && <p>{t('trainer.loading')}</p>}
      {ready && !dealt && <p data-testid="no-spots">{t('trainer.filters.none')}</p>}
      {dealt && (
        <section className="card space-y-4" data-testid="preflop-question" aria-labelledby="pf-q">
          <div className="space-y-1 text-sm" id="pf-q">
            {question(dealt).map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-600 dark:text-slate-400">{t('trainer.yourHand')}</span>
            <Cards cards={dealt.combo} size="xl" />
          </div>
          <ul className="flex flex-wrap gap-2" aria-label={t('solver.actions')}>
            {dealt.chart.actions.map((a, i) => (
              <li key={a}>
                <button
                  type="button"
                  className={`min-w-28 rounded-md border-2 px-5 py-3 text-base font-semibold ${answered?.chosen === i ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900' : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'}`}
                  disabled={!!answered || busy}
                  onClick={() => answer(i)}
                  aria-keyshortcuts={String(i + 1)}
                >
                  <span className="mr-2 text-xs text-slate-500">{i + 1}</span>
                  {a}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {dealt && answered && (
        <AnswerPanel
          category={answered.category}
          claims={answered.claims}
          hand={dealt.handClass}
          rows={rows}
          chosen={answered.chosen}
          notes={[t('trainer.answer.combo', { hand: dealt.handClass })]}
          reference={
            <span className="inline-flex flex-wrap items-center gap-2">
              {t('trainer.answer.reference')}: {dealt.chart.title} <ProvenanceBadge p={dealt.doc.provenance} />
            </span>
          }
          lesson={dealt.doc.family.startsWith('pushfold') ? 'trainer.lesson.pushFold' : 'trainer.lesson.ranges'}
          onNext={next}
        />
      )}
      {tally.n > 0 && <p className="text-sm text-slate-600 dark:text-slate-400" data-testid="session-tally">{t('trainer.session', { n: tally.n, loss: fmtLoss(tally.loss / tally.n, 'bb') })}</p>}
    </div>
  );
}
