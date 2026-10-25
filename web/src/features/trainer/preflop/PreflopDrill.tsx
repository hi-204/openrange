import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { pct } from '../../../lib/format';
import { t, type MessageKey } from '../../../lib/i18n';
import { ProvenanceBadge } from '../../../lib/provenance/ProvenanceBadge';
import { loadJson, type ChartFile, type ChartIndexEntry } from '../../../lib/provenance/types';
import { useSettings } from '../../../lib/settings/useSettings';
import { Accordion, ErrorState, Skeleton } from '../../../lib/ui/components';
import { solverClient } from '../../../lib/wasm/client';
import { ClassGrid } from '../../charts/ClassGrid';
import { familyLabel } from '../../charts/ChartsPage';
import { buildCoach, type CoachCard as Card } from '../../coach/coach';
import { CoachCard, type MathRow } from '../../coach/CoachCard';
import { ActionBar, actionColor } from '../../table/ActionBar';
import { PokerTable } from '../../table/PokerTable';
import { playersBehind, preflopTable } from '../../table/preflopTable';
import { preflopClaims } from '../explain/preflop';
import { fmtBb, renderClaim } from '../explain/render';
import { Hints, SessionSummary, TimerBadge, useCountdown, useQuickAdvance, type SessionAnswer } from '../flow';
import { grade } from '../grading';
import { handType, recordAnswer } from '../session';
import { useDrillKeys } from '../shortcuts';
import type { FamilyState } from '../srs';
import { trainerStore, type TrainerSettings } from '../store';
import { candidates, deal, drillSources, mulberry32, scenarioOf, stackBand, type Candidate, type Dealt, type Difficulty, type Filters } from './deal';

const SEATS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
const SCENARIOS = ['first-in', 'vs-all-in', 'vs-open', 'squeeze', 'vs-3bet', 'vs-4bet', 'vs-5bet'];
const DIFFICULTIES: Difficulty[] = ['any', 'easy', 'medium', 'hard'];

type Answered = { chosen: number | null; card: Card; details: string[] };

const playersOf = (d: Dealt) => (d.doc.family === 'pushfold-hu' ? 2 : (d.doc.players ?? d.source.players));
const seatOf = (d: Dealt) => (d.chart.seat ? d.chart.seat : d.chart.id.startsWith('sb-shove') ? 'SB' : 'BB');

/** Hints that point at what matters without giving the answer away. */
function hintsFor(d: Dealt): string[] {
  const out: string[] = [];
  const seat = seatOf(d);
  const players = playersOf(d);
  const scenario = scenarioOf(d.chart);
  if (scenario === 'first-in') out.push(t('flow.hint.position', { seat, n: playersBehind(players, seat) }));
  else out.push(t('flow.hint.facing', { seat }));
  out.push(t(`flow.hint.hand.${handType(d.handClass)}` as MessageKey, { hand: d.handClass }));
  if (d.doc.family === 'pushfold-hu' && seat === 'BB') out.push(t('flow.hint.price', { required: pct((d.stack - 1) / (2 * d.stack), 1) }));
  if (d.doc.family === 'pushfold-hu' && seat === 'SB') out.push(t('flow.hint.shove'));
  return out;
}

export function PreflopDrill({ files: initialFiles }: { files?: string[] }) {
  const app = useSettings((s) => s.settings);
  const [index, setIndex] = useState<ChartIndexEntry[] | null>(null);
  const [docs, setDocs] = useState<Map<string, ChartFile>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<Filters | null>(null);
  const [onlyFamilies, setOnlyFamilies] = useState<string[] | null>(null);
  const [families, setFamilies] = useState<Map<string, FamilyState>>(new Map());
  const [trainer, setTrainer] = useState<TrainerSettings>({ thresholds: null });
  const [dealt, setDealt] = useState<Dealt | null>(null);
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<SessionAnswer[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const ids = { min: useId(), max: useId(), difficulty: useId() };

  useEffect(() => {
    loadJson<ChartIndexEntry[]>('data/charts/index.json')
      .then((ix) => {
        setIndex(ix);
        const graded = drillSources(ix).filter((s) => s.graded).map((s) => s.file);
        const wanted = initialFiles?.filter((f) => ix.some((e) => e.file === f));
        setFilters({ files: wanted?.length ? wanted : graded, seats: [], scenarios: [], stackMin: 0, stackMax: 100, difficulty: 'any' });
      })
      .catch((e: Error) => setError(e.message));
    const store = trainerStore();
    store.families().then(setFamilies).catch((e: Error) => setError(e.message));
    store.settings().then(setTrainer).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the chart files the filters use, each once. (Re-requesting files still in flight let
  // a late duplicate response rebuild the pool and re-deal over an answer.)
  const requested = useRef(new Set<string>());
  useEffect(() => {
    if (!filters) return;
    for (const f of filters.files) {
      if (requested.current.has(f)) continue;
      requested.current.add(f);
      loadJson<ChartFile>(`data/charts/${f}`)
        .then((d) => setDocs((m) => (m.has(f) ? m : new Map(m).set(f, d))))
        .catch((e: Error) => setError(e.message));
    }
  }, [filters]);

  const sources = useMemo(() => (index ? drillSources(index) : []), [index]);
  const ready = !!filters && filters.files.every((f) => docs.has(f));
  const pool = useMemo(() => {
    if (!filters || !ready) return null;
    const loaded = sources.filter((s) => docs.has(s.file)).map((source) => ({ source, doc: docs.get(source.file)! }));
    const all = candidates(loaded, filters);
    if (!onlyFamilies) return all;
    const weak = new Map<string, Candidate[]>([...all].filter(([k]) => onlyFamilies.includes(k)));
    return weak.size ? weak : all;
  }, [filters, ready, sources, docs, onlyFamilies]);

  const next = useCallback(() => {
    if (!pool) return;
    setAnswered(null);
    setHintsUsed(0);
    setDealt(deal(pool, families, Date.now(), rnd));
  }, [pool, families, rnd]);

  // Deal when the pool changes (first load or new filters).
  useEffect(() => {
    if (pool) {
      setAnswered(null);
      setHintsUsed(0);
      setDealt(deal(pool, families, Date.now(), rnd));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pool]);

  const coachContext = (d: Dealt, chosen: number) => ({
    seed: `${d.family}|${d.chart.id}|${d.handClass}|${chosen}`,
    drill: 'preflop' as const,
    position: seatOf(d),
    hand: d.handClass,
    playersBehind: scenarioOf(d.chart) === 'first-in' ? playersBehind(playersOf(d), seatOf(d)) : undefined,
    detail: app.coaching.detail,
  });

  const answer = useCallback(
    async (chosen: number) => {
      if (!dealt || answered || busy) return;
      setBusy(true);
      try {
        const { chart, doc, classIndex: k, source } = dealt;
        const ev = chart.ev![k]!;
        const se = chart.evStdError?.[k] ?? null;
        const strategy = chart.strategy[k]!;
        const g = source.graded ? grade({ ev, evStdError: se, strategy, chosen, unit: 'bb', thresholds: trainer.thresholds?.bb }) : null;
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
        setAnswered({ chosen, card: buildCoach(claims, coachContext(dealt, chosen)), details: claims.flatMap(renderClaim) });
        setSession((s) => [...s, { family: dealt.family, label: chart.title, hand: dealt.handClass, category: g?.category ?? null, loss: g?.loss ?? null, unit: 'bb', hints: hintsUsed }]);
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
            hints: hintsUsed,
            groups: { drill: 'preflop', reference: doc.family, position: chart.seat, scenario: scenarioOf(chart), stack: stackBand(doc.family, dealt.stack), handType: handType(dealt.handClass), handClass: dealt.handClass },
          },
          families,
          app.training.srs,
        );
        setFamilies(updated);
      } catch (e) {
        setError(t('trainer.saveError', { message: e instanceof Error ? e.message : String(e) }));
      } finally {
        setBusy(false);
      }
    },
    [dealt, answered, busy, trainer, families, hintsUsed, app], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Timer: running out shows the answer, ungraded.
  const timeUp = useCallback(() => {
    if (!dealt || answered) return;
    const k = dealt.classIndex;
    const strat = dealt.chart.strategy[k]!;
    const best = dealt.chart.actions[strat.indexOf(Math.max(...strat))]!;
    setAnswered({
      chosen: null,
      card: { tone: 'ungraded', category: null, verdict: t('flow.timeUp', { best }), why: [], keyIdea: t('flow.timeUpIdea'), lookFor: t('coach.look.ranges'), recommended: [best], learnMore: { topic: t('coach.topic.ranges'), href: '#/learn/1.5' } },
      details: [],
    });
  }, [dealt, answered]);
  const left = useCountdown(app.training.timerSeconds, !!dealt && !answered, timeUp);
  const autoPending = useQuickAdvance(app.training.autoAdvance, !!answered, next);
  useDrillKeys(dealt && !answered ? dealt.chart.actions : null, (i) => void answer(i), answered ? next : null);

  if (error) return <ErrorState title={t('flow.errorTitle')} message={t('trainer.loadError', { message: error })} next={<button type="button" className="btn-secondary" onClick={() => location.reload()}>{t('flow.reload')}</button>} />;
  if (!index || !filters)
    return (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-64" />
        <Skeleton className="h-14" />
      </div>
    );

  const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const expert = app.mode === 'expert';

  const filtersPanel = (
    <Accordion title={t('trainer.filters')} defaultOpen={expert} testId="preflop-filters">
      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('trainer.filters.sources')}</legend>
          {sources.map((s) => (
            <label key={s.file} className="flex min-h-9 items-center gap-2 text-sm">
              <input type="checkbox" checked={filters.files.includes(s.file)} onChange={() => setFilters({ ...filters, files: toggle(filters.files, s.file) })} />
              {familyLabel(index.find((e) => e.file === s.file)!)}
            </label>
          ))}
          <p className="mt-1 text-xs text-ink-muted">{t('trainer.filters.practiceNote')}</p>
        </fieldset>
        <fieldset>
          <legend className="mb-1 text-sm font-medium">{t('trainer.filters.seats')}</legend>
          <div className="flex flex-wrap gap-3">
            {SEATS.map((seat) => (
              <label key={seat} className="flex min-h-9 items-center gap-1 text-sm">
                <input type="checkbox" checked={filters.seats.includes(seat)} onChange={() => setFilters({ ...filters, seats: toggle(filters.seats, seat) })} />
                {seat}
              </label>
            ))}
          </div>
          <p className="mt-3 mb-1 text-sm font-medium">{t('trainer.filters.scenarios')}</p>
          <div className="flex flex-wrap gap-3">
            {SCENARIOS.map((sc) => (
              <label key={sc} className="flex min-h-9 items-center gap-1 text-sm">
                <input type="checkbox" checked={filters.scenarios.includes(sc)} onChange={() => setFilters({ ...filters, scenarios: toggle(filters.scenarios, sc) })} />
                {t(`trainer.scenario.${sc}` as MessageKey)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={ids.min} className="mb-1 block text-sm font-medium">{t('trainer.filters.stackMin')}</label>
            <input id={ids.min} className="field num" type="number" min={0} value={filters.stackMin} onChange={(e) => setFilters({ ...filters, stackMin: Number(e.target.value) })} />
          </div>
          <div>
            <label htmlFor={ids.max} className="mb-1 block text-sm font-medium">{t('trainer.filters.stackMax')}</label>
            <input id={ids.max} className="field num" type="number" min={0} value={filters.stackMax} onChange={(e) => setFilters({ ...filters, stackMax: Number(e.target.value) })} />
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
    </Accordion>
  );

  let table = null;
  if (dealt) {
    const players = playersOf(dealt);
    const seat = seatOf(dealt);
    const line = dealt.chart.line ?? (seat === 'BB' && dealt.doc.family === 'pushfold-hu' ? `SB all-in ${dealt.stack}` : '');
    const pic = preflopTable({ players, stack: dealt.stack, line, hero: seat, heroCards: [dealt.combo.slice(0, 2), dealt.combo.slice(2, 4)], heroLabel: t('table.you') });
    const fam = dealt.doc.family === 'cash-6max' ? t('flow.spot.cash') : players === 2 ? t('flow.spot.hu') : t('flow.spot.players', { n: players });
    table = <PokerTable seats={pic.seats} pot={pic.pot} board={[]} history={pic.history} summary={`${fam} · ${dealt.stack} bb · ${dealt.chart.title}`} />;
  }

  const k = dealt?.classIndex ?? 0;
  const rows: MathRow[] = dealt
    ? dealt.chart.actions.map((action, a) => {
        const ev = dealt.chart.ev?.[k]?.[a] ?? null;
        const evs = dealt.chart.ev?.[k]?.filter((x): x is number => x !== null) ?? [];
        return { action, frequency: dealt.chart.strategy[k]![a]!, evText: ev === null ? '—' : fmtBb(ev), stdError: dealt.chart.evStdError?.[k]?.[a] ?? null, chosen: answered?.chosen === a, best: ev !== null && ev >= Math.max(...evs) - 1e-9 };
      })
    : [];

  return (
    <div className="space-y-5">
      {filtersPanel}
      {onlyFamilies && (
        <p className="flex flex-wrap items-center gap-2 text-sm">
          {t('flow.weakOnly')}
          <button type="button" className="btn-quiet" onClick={() => setOnlyFamilies(null)}>
            {t('flow.allSpots')}
          </button>
        </p>
      )}
      {!ready && <Skeleton className="h-64" />}
      {ready && !dealt && <p data-testid="no-spots">{t('trainer.filters.none')}</p>}
      {showSummary && (
        <SessionSummary
          answers={session}
          onClose={() => setShowSummary(false)}
          onDrillWeak={(f) => {
            setOnlyFamilies(f);
            setSession([]);
            setShowSummary(false);
          }}
        />
      )}
      {dealt && !showSummary && (
        <section className="space-y-4" data-testid="preflop-question" aria-label={t('flow.question')}>
          {table}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium" id="pf-q">
              {answered ? t('flow.answered') : t('flow.yourMove')}
            </p>
            <TimerBadge left={left} />
          </div>
          <ActionBar actions={dealt.chart.actions} onAction={(i) => void answer(i)} disabled={!!answered || busy} chosen={answered?.chosen ?? null} />
          {!answered && app.training.hints && <Hints hints={hintsFor(dealt)} used={hintsUsed} onUse={() => setHintsUsed((h) => h + 1)} />}
        </section>
      )}
      {dealt && answered && !showSummary && (
        <CoachCard
          card={answered.card}
          rows={rows}
          details={answered.details}
          extra={
            <div className="max-w-sm space-y-1">
              <p className="text-xs text-ink-muted">{t('flow.gridNote', { hand: dealt.handClass })}</p>
              <ClassGrid classes={dealt.doc.classes} strategy={dealt.chart.strategy} actions={dealt.chart.actions} colors={dealt.chart.actions.map((_, i) => actionColor(dealt.chart.actions, i))} reach={dealt.chart.reach} selected={k} onSelect={() => undefined} label={dealt.chart.title} />
            </div>
          }
          footer={
            <>
              <p>{t('trainer.answer.combo', { hand: dealt.handClass })}</p>
              <p className="flex flex-wrap items-center gap-2">
                {t('trainer.answer.reference')}: {dealt.chart.title} <ProvenanceBadge p={dealt.doc.provenance} />
              </p>
              <p>{autoPending ? t('flow.autoNext') : t('trainer.nextHint')}</p>
            </>
          }
          onNext={next}
        />
      )}
      {session.length > 0 && !showSummary && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-ink-muted" data-testid="session-tally">
          <span>{t('flow.sessionCount', { n: session.length })}</span>
          <button type="button" className="btn-secondary" onClick={() => setShowSummary(true)} data-testid="end-session">
            {t('flow.endSession')}
          </button>
        </div>
      )}
    </div>
  );
}
