import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { pct } from '../../../lib/format';
import { t, type MessageKey } from '../../../lib/i18n';
import { cellName, cellOf } from '../../../lib/poker/hands';
import { useSettings } from '../../../lib/settings/useSettings';
import { ErrorState, ProgressBar, SegmentedControl } from '../../../lib/ui/components';
import { CancelledError, SolverClient, solverClient, type Progress } from '../../../lib/wasm/client';
import type { RunResult, SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { buildCoach } from '../../coach/coach';
import { CoachCard, type MathRow } from '../../coach/CoachCard';
import { StrategyGrid } from '../../solver/StrategyGrid';
import { ActionBar, actionColor } from '../../table/ActionBar';
import { PokerTable, type Seat } from '../../table/PokerTable';
import { fmtBb, renderClaim } from '../explain/render';
import { Hints, SessionSummary, TimerBadge, useCountdown, useFamilies, useQuickAdvance, type SessionAnswer } from '../flow';
import { mulberry32 } from '../preflop/deal';
import { useDrillKeys } from '../shortcuts';
import { trainerStore, type TrainerSettings } from '../store';
import { decide, type DecisionResult } from './decision';
import { price, remainingStack, texture } from './features';
import { PostflopHand, type ActionNode } from './hand';
import { DRILL_SPOTS, type DrillSpot } from './spots';

type Solve =
  | { kind: 'idle' }
  | { kind: 'starting' }
  | { kind: 'running'; progress: Progress | null }
  | { kind: 'ready'; info: SolverInfo; root: SolverNode; result: RunResult }
  | { kind: 'error'; message: string }
  | { kind: 'cancelled' };

type Phase =
  | { kind: 'none' }
  | { kind: 'decide'; node: ActionNode }
  | { kind: 'answered'; node: ActionNode; result: DecisionResult; timedOut: boolean }
  | { kind: 'over'; node: SolverNode };

const BUDGET = 1.5e9;

function hintsFor(h: PostflopHand, node: ActionNode): string[] {
  const out = [t(h.heroSeat === 0 ? 'flow.hint.oop' : 'flow.hint.ip')];
  const p = price(node.pot, [node.committed[0], node.committed[1]], h.heroSeat);
  if (p.toCall > 0) out.push(t('flow.hint.postPrice', { toCall: p.toCall.toFixed(1), required: pct(p.required, 1), mdf: pct(p.mdf, 0) }));
  const tex = texture(node.board);
  out.push(t('flow.hint.board', { board: node.board.join(' '), wet: t(tex.maxSuit >= 3 || tex.straightPossible ? 'coach.wet' : 'coach.dry') }));
  return out;
}

export function PostflopDrill({ spot: initialSpot }: { spot?: string }) {
  const app = useSettings((s) => s.settings);
  const [spotId, setSpotId] = useState(DRILL_SPOTS.some((s) => s.id === initialSpot) ? initialSpot! : DRILL_SPOTS[0]!.id);
  const [seatChoice, setSeatChoice] = useState<'0' | '1' | 'alt'>('alt');
  const [solve, setSolve] = useState<Solve>({ kind: 'idle' });
  const [phase, setPhase] = useState<Phase>({ kind: 'none' });
  const [trainer, setTrainer] = useState<TrainerSettings>({ thresholds: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, saveAnswer] = useFamilies((e) => setError(e.message));
  const [hintsUsed, setHintsUsed] = useState(0);
  const [session, setSession] = useState<SessionAnswer[]>([]);
  const [handGrades, setHandGrades] = useState<SessionAnswer[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const client = useRef<SolverClient | null>(null);
  const hand = useRef<PostflopHand | null>(null);
  const handCount = useRef(0);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const ids = { spot: useId() };
  const spot = DRILL_SPOTS.find((s) => s.id === spotId)!;

  useEffect(() => {
    const store = trainerStore();
    store.settings().then(setTrainer).catch(() => undefined);
    return () => client.current?.cancel();
  }, []);

  const source = useCallback((path: number[]) => client.current!.call('solverNode', { path }), []);

  async function prepare(s: DrillSpot) {
    client.current?.cancel();
    const c = new SolverClient();
    client.current = c;
    hand.current = null;
    setPhase({ kind: 'none' });
    setSolve({ kind: 'starting' });
    try {
      const info = await c.call('solverStart', { spot: { ...s.spot, algorithm: app.solver.algorithm }, budgetBytes: BUDGET, allowAbstraction: false });
      setSolve({ kind: 'running', progress: null });
      const result = await c.call('solverRun', { maxIterations: s.maxIterations, targetPct: s.target }, (p) => setSolve({ kind: 'running', progress: p }));
      const root = await c.call('solverNode', { path: [] });
      setSolve({ kind: 'ready', info, root, result });
    } catch (e) {
      setSolve(e instanceof CancelledError ? { kind: 'cancelled' } : { kind: 'error', message: (e as Error).message });
    }
  }

  const advance = useCallback(async () => {
    const h = hand.current!;
    const r = await h.advance(source);
    setHintsUsed(0);
    setPhase(r.kind === 'hero' ? { kind: 'decide', node: r.node } : { kind: 'over', node: r.node });
  }, [source]);

  const deal = useCallback(async () => {
    if (solve.kind !== 'ready') return;
    const seat = seatChoice === 'alt' ? ((handCount.current++ % 2) as 0 | 1) : (Number(seatChoice) as 0 | 1);
    hand.current = PostflopHand.deal(solve.info, solve.root, seat, rnd);
    setHandGrades([]);
    setError(null);
    try {
      await advance();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [solve, seatChoice, rnd, advance]);

  useEffect(() => {
    if (solve.kind === 'ready' && !hand.current) void deal();
  }, [solve, deal]);

  const answer = useCallback(
    async (chosen: number, timedOut = false) => {
      if (phase.kind !== 'decide' || busy || solve.kind !== 'ready') return;
      setBusy(true);
      try {
        const h = hand.current!;
        const node = phase.node;
        const result = await decide(h, node, chosen, {
          exploitabilityPct: solve.result.pctPot,
          thresholds: trainer.thresholds?.pctPot,
          equity: (request) => solverClient().call('equity', { request }),
        });
        // Time ran out: show the solution's main play, ungraded, and continue along it.
        if (timedOut) result.grade = null;
        setPhase({ kind: 'answered', node, result, timedOut });
        const facing = price(node.pot, [node.committed[0], node.committed[1]], h.heroSeat).toCall > 0;
        const seatName = h.heroSeat === 0 ? 'OOP' : 'IP';
        const street = node.street.toLowerCase();
        const family = `postflop|${spotId}|${seatName}|${street}|${facing ? 'facing-bet' : 'first-or-checked-to'}`;
        const cls = cellName(cellOf(h.hero).index);
        const entry: SessionAnswer = { family, label: t(`trainer.post.spot.${spotId}` as MessageKey), hand: h.hero, category: result.grade?.category ?? null, loss: result.grade?.loss ?? null, unit: 'pctPot', hints: hintsUsed };
        setSession((s) => [...s, entry]);
        setHandGrades((g) => [...g, entry]);
        saveAnswer(
            {
              at: Date.now(),
              drill: 'postflop',
              graded: !timedOut && result.grade !== null,
              family,
              reference: { spot: spotId, exploitabilityPct: solve.result.pctPot, iterations: solve.result.iterations },
              hand: h.hero,
              handClass: cls,
              actions: node.actions,
              chosen,
              unit: 'pctPot',
              category: result.grade?.category ?? null,
              loss: result.grade?.loss ?? null,
              gradedLoss: result.grade?.gradedLoss ?? null,
              hints: hintsUsed,
              groups: { drill: 'postflop', reference: spotId, position: seatName, street, scenario: facing ? 'facing-bet' : 'first-or-checked-to', handClass: cls },
            },
            app.training.srs,
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [phase, busy, solve, trainer, spotId, hintsUsed, app, saveAnswer],
  );

  const proceed = useCallback(async () => {
    if (phase.kind !== 'answered') return;
    hand.current!.play(phase.node, phase.result.ctx.chosen);
    try {
      await advance();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [phase, advance]);

  const timeUp = useCallback(() => {
    if (phase.kind !== 'decide' || !hand.current) return;
    const n = hand.current.info.hands[hand.current.heroSeat].length;
    const hi = hand.current.heroIndex();
    const probs = phase.node.actions.map((_, a) => phase.node.strategy[a * n + hi]!);
    void answer(probs.indexOf(Math.max(...probs)), true);
  }, [phase, answer]);
  const left = useCountdown(app.training.timerSeconds, phase.kind === 'decide', timeUp);
  const autoPending = useQuickAdvance(app.training.autoAdvance, phase.kind === 'answered', () => void proceed());
  useDrillKeys(phase.kind === 'decide' ? phase.node.actions : null, (i) => void answer(i), phase.kind === 'answered' ? () => void proceed() : phase.kind === 'over' ? () => void deal() : null);

  const h = hand.current;
  const running = solve.kind === 'starting' || solve.kind === 'running';

  let table = null;
  if (h && solve.kind === 'ready' && phase.kind !== 'none') {
    const node = phase.node;
    const committed: [number, number] = [node.committed[0], node.committed[1]];
    const seats: Seat[] = ([0, 1] as const).map((p) => {
      const isHero = p === h.heroSeat;
      const folded = phase.kind === 'over' && node.kind === 'fold' && node.folder === p;
      return {
        name: isHero ? t('table.you') : t('table.opponent'),
        position: p === 0 ? 'OOP' : 'IP',
        stack: remainingStack(solve.info.spot.stack, solve.info.spot.pot, node.pot, committed, p),
        status: folded ? 'folded' : 'active',
        hero: isHero,
        cards: isHero ? [h.hero.slice(0, 2), h.hero.slice(2, 4)] : phase.kind === 'over' ? [h.villain.slice(0, 2), h.villain.slice(2, 4)] : null,
        bet: committed[p] > 0 ? committed[p] : undefined,
        toAct: isHero && phase.kind === 'decide',
      };
    });
    const history = [t('trainer.post.start', { street: spot.street }), ...h.steps.map((s) => (s.kind === 'deal' ? t('trainer.post.step.deal', { street: s.street, card: s.card }) : t(s.who === 'hero' ? 'trainer.post.step.hero' : 'trainer.post.step.villain', { label: s.label })))];
    table = <PokerTable seats={seats} pot={node.pot - committed[0] - committed[1]} board={h.board} history={history} summary={t(`trainer.post.spot.${spotId}` as MessageKey)} button={1} />;
  }

  const answeredPhase = phase.kind === 'answered' ? phase : null;
  const result = answeredPhase?.result ?? null;
  const rows: MathRow[] = answeredPhase && result
    ? answeredPhase.node.actions.map((action, a) => {
        const ev = result.ctx.ev[a] ?? null;
        const evs = result.ctx.ev.filter((x): x is number => x !== null);
        return { action, frequency: result.ctx.strategy[a]!, evText: ev === null ? '—' : `${fmtBb(ev)} (${((ev / answeredPhase.node.pot) * 100).toFixed(1)}% pot)`, stdError: null, chosen: a === result.ctx.chosen, best: ev !== null && ev >= Math.max(...evs) - 1e-9 };
      })
    : [];

  return (
    <div className="space-y-5">
      <section className="card space-y-4">
        <p className="max-w-prose text-sm text-ink-muted">{t('trainer.post.intro')}</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_auto_auto] sm:items-end">
          <div>
            <label htmlFor={ids.spot} className="mb-1 block text-sm font-medium">{t('trainer.post.spotLabel')}</label>
            <select id={ids.spot} className="field" value={spotId} disabled={running} onChange={(e) => setSpotId(e.target.value)}>
              {DRILL_SPOTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {t(`trainer.post.spot.${s.id}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium">{t('trainer.post.seatLabel')}</p>
            <SegmentedControl
              label={t('trainer.post.seatLabel')}
              value={seatChoice}
              onChange={setSeatChoice}
              options={[
                { value: 'alt', label: t('trainer.post.seat.alt') },
                { value: '0', label: t('flow.seat.oop') },
                { value: '1', label: t('flow.seat.ip') },
              ]}
            />
          </div>
          {running ? (
            <button type="button" className="btn-secondary" onClick={() => client.current?.cancel()}>
              {t('trainer.post.cancel')}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => void prepare(spot)}>
              {t('trainer.post.prepare')}
            </button>
          )}
        </div>
        <p className="text-xs text-ink-muted">{t('trainer.post.inputs')}</p>
        <div role="status" aria-live="polite" className="space-y-2 text-sm" data-testid="postflop-status">
          {solve.kind === 'starting' && t('trainer.post.starting')}
          {solve.kind === 'running' && (
            <>
              <p>{t('trainer.post.solving', { it: solve.progress?.iterations ?? 0, x: (solve.progress?.pctPot ?? 100).toFixed(2) })}</p>
              <ProgressBar label={t('flow.solveProgress')} value={solve.progress ? Math.min(1, solve.progress.iterations / spot.maxIterations) : 0} />
            </>
          )}
          {solve.kind === 'ready' && (
            <p>
              {t('trainer.post.ready', { x: solve.result.pctPot.toFixed(2), s: (solve.result.elapsedMs / 1000).toFixed(1), it: solve.result.iterations })}
              {solve.result.reason !== 'target' && <> {t('trainer.post.notReached', { x: solve.result.pctPot.toFixed(2), target: spot.target })}</>}
            </p>
          )}
          {solve.kind === 'cancelled' && t('trainer.post.cancelled')}
        </div>
      </section>

      {(error || solve.kind === 'error') && <ErrorState title={t('flow.errorTitle')} message={t('trainer.post.error', { message: error ?? (solve.kind === 'error' ? solve.message : '') })} next={<button type="button" className="btn-secondary" onClick={() => void prepare(spot)}>{t('flow.tryAgain')}</button>} />}

      {showSummary && (
        <SessionSummary
          answers={session}
          onClose={() => setShowSummary(false)}
          onDrillWeak={() => {
            setSession([]);
            setShowSummary(false);
            void deal();
          }}
        />
      )}

      {table && !showSummary && h && (
        <section className="space-y-4" data-testid="postflop-hand">
          {table}
          {phase.kind === 'decide' && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium" data-testid="your-move">
                  {t('trainer.post.yourMove')}
                </p>
                <TimerBadge left={left} />
              </div>
              <ActionBar actions={phase.node.actions} onAction={(i) => void answer(i)} disabled={busy} potBb={phase.node.pot} />
              {app.training.hints && <Hints hints={hintsFor(h, phase.node)} used={hintsUsed} onUse={() => setHintsUsed((x) => x + 1)} />}
            </>
          )}
          {phase.kind === 'over' && (
            <div className="card space-y-3" data-testid="hand-over">
              <p className="font-medium">
                {t('trainer.post.handOver')}: {phase.node.kind === 'fold' ? t(phase.node.folder === h.heroSeat ? 'trainer.post.end.fold.hero' : 'trainer.post.end.fold.villain') : t('trainer.post.end.showdown')}
              </p>
              {handGrades.length > 0 && <p className="text-sm text-ink-muted">{t('trainer.post.summary', { list: handGrades.map((g) => (g.category ? t(`trainer.category.${g.category}` as MessageKey) : t('trainer.category.notGraded'))).join(', ') })}</p>}
              <span data-testid="villain-cards" className="sr-only">
                {h.villain}
              </span>
              <button type="button" className="btn-primary" onClick={() => void deal()} autoFocus>
                {t('trainer.post.deal')}
              </button>
            </div>
          )}
        </section>
      )}

      {phase.kind === 'answered' && h && result && !showSummary && (
        <CoachCard
          card={
            phase.timedOut
              ? { tone: 'ungraded', category: null, verdict: t('flow.timeUp', { best: phase.node.actions[result.ctx.chosen]! }), why: [], keyIdea: t('flow.timeUpIdea'), lookFor: t('coach.look.postflop'), recommended: [phase.node.actions[result.ctx.chosen]!], learnMore: { topic: t('coach.topic.postflop'), href: '#/learn/4.1' } }
              : buildCoach(result.claims, { seed: `${spotId}|${h.path.join('.')}|${h.hero}|${result.ctx.chosen}`, drill: 'postflop', position: h.heroSeat === 0 ? 'OOP' : 'IP', hand: cellName(cellOf(h.hero).index), detail: app.coaching.detail })
          }
          rows={rows}
          details={result.claims.flatMap(renderClaim)}
          extra={
            <div className="max-w-sm space-y-1">
              <p className="text-xs text-ink-muted">{t('flow.gridNotePost', { hand: cellName(cellOf(h.hero).index) })}</p>
              <StrategyGrid
                hands={h.info.hands[h.heroSeat]}
                reach={phase.node.reach[h.heroSeat]}
                strategy={phase.node.strategy}
                actions={phase.node.actions}
                colors={phase.node.actions.map((_, i) => actionColor(phase.node.actions, i))}
                selected={cellOf(result.ctx.heroCombo).index}
                onSelect={() => undefined}
              />
            </div>
          }
          footer={<p>{autoPending ? t('flow.autoNext') : t('trainer.nextHint')}</p>}
          nextLabel={t('trainer.post.continue')}
          onNext={() => void proceed()}
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
