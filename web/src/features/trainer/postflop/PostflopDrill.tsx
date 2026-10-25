import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { t, type MessageKey } from '../../../lib/i18n';
import { Cards } from '../../../lib/poker/Cards';
import { cellName, cellOf } from '../../../lib/poker/hands';
import { CancelledError, SolverClient, solverClient, type Progress } from '../../../lib/wasm/client';
import type { RunResult, SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { AnswerPanel, CategoryBadge, type ActionRow } from '../AnswerPanel';
import { fmtBb } from '../explain/render';
import type { Category } from '../grading';
import { mulberry32 } from '../preflop/deal';
import { recordAnswer } from '../session';
import { useDrillKeys } from '../shortcuts';
import type { FamilyState } from '../srs';
import { trainerStore, type TrainerSettings } from '../store';
import { decide, type DecisionResult } from './decision';
import { price, remainingStack } from './features';
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
  | { kind: 'answered'; node: ActionNode; result: DecisionResult }
  | { kind: 'over'; node: SolverNode };

const BUDGET = 1.5e9;

export function PostflopDrill() {
  const [spotId, setSpotId] = useState(DRILL_SPOTS[0]!.id);
  const [seatChoice, setSeatChoice] = useState<'0' | '1' | 'alt'>('alt');
  const [solve, setSolve] = useState<Solve>({ kind: 'idle' });
  const [phase, setPhase] = useState<Phase>({ kind: 'none' });
  const [grades, setGrades] = useState<(Category | null)[]>([]);
  const [families, setFamilies] = useState<Map<string, FamilyState>>(new Map());
  const [settings, setSettings] = useState<TrainerSettings>({ thresholds: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useRef<SolverClient | null>(null);
  const hand = useRef<PostflopHand | null>(null);
  const handCount = useRef(0);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const ids = { spot: useId(), seat: useId() };
  const spot = DRILL_SPOTS.find((s) => s.id === spotId)!;

  useEffect(() => {
    const store = trainerStore();
    store.families().then(setFamilies).catch(() => undefined);
    store.settings().then(setSettings).catch(() => undefined);
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
      const info = await c.call('solverStart', { spot: s.spot, budgetBytes: BUDGET, allowAbstraction: false });
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
    setPhase(r.kind === 'hero' ? { kind: 'decide', node: r.node } : { kind: 'over', node: r.node });
  }, [source]);

  const deal = useCallback(async () => {
    if (solve.kind !== 'ready') return;
    const seat = seatChoice === 'alt' ? ((handCount.current++ % 2) as 0 | 1) : (Number(seatChoice) as 0 | 1);
    hand.current = PostflopHand.deal(solve.info, solve.root, seat, rnd);
    setGrades([]);
    setError(null);
    try {
      await advance();
    } catch (e) {
      setError((e as Error).message);
    }
  }, [solve, seatChoice, rnd, advance]);

  // Deal the first hand as soon as the spot is solved.
  useEffect(() => {
    if (solve.kind === 'ready' && !hand.current) void deal();
  }, [solve, deal]);

  const answer = useCallback(
    async (chosen: number) => {
      if (phase.kind !== 'decide' || busy || solve.kind !== 'ready') return;
      setBusy(true);
      try {
        const h = hand.current!;
        const node = phase.node;
        const result = await decide(h, node, chosen, {
          exploitabilityPct: solve.result.pctPot,
          thresholds: settings.thresholds?.pctPot,
          equity: (request) => solverClient().call('equity', { request }),
        });
        setPhase({ kind: 'answered', node, result });
        setGrades((g) => [...g, result.grade?.category ?? null]);
        const facing = price(node.pot, [node.committed[0], node.committed[1]], h.heroSeat).toCall > 0;
        const seatName = h.heroSeat === 0 ? 'OOP' : 'IP';
        const street = node.street.toLowerCase();
        const graded = result.grade !== null;
        setFamilies(
          await recordAnswer(
            trainerStore(),
            {
              at: Date.now(),
              drill: 'postflop',
              graded,
              family: `postflop|${spotId}|${seatName}|${street}|${facing ? 'facing-bet' : 'first-or-checked-to'}`,
              reference: { spot: spotId, exploitabilityPct: solve.result.pctPot, iterations: solve.result.iterations },
              hand: h.hero,
              handClass: cellName(cellOf(h.hero).index),
              actions: node.actions,
              chosen,
              unit: 'pctPot',
              category: result.grade?.category ?? null,
              loss: result.grade?.loss ?? null,
              gradedLoss: result.grade?.gradedLoss ?? null,
              groups: { drill: 'postflop', reference: spotId, position: seatName, street, scenario: facing ? 'facing-bet' : 'first-or-checked-to', handClass: cellName(cellOf(h.hero).index) },
            },
            families,
          ),
        );
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [phase, busy, solve, settings, spotId, families],
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

  useDrillKeys(phase.kind === 'decide' ? phase.node.actions : null, answer, phase.kind === 'answered' ? proceed : phase.kind === 'over' ? deal : null);

  const h = hand.current;
  const running = solve.kind === 'starting' || solve.kind === 'running';
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <p className="max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('trainer.post.intro')}</p>
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_auto] sm:items-end">
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
            <label htmlFor={ids.seat} className="mb-1 block text-sm font-medium">{t('trainer.post.seatLabel')}</label>
            <select id={ids.seat} className="field" value={seatChoice} onChange={(e) => setSeatChoice(e.target.value as '0' | '1' | 'alt')}>
              {(['alt', '0', '1'] as const).map((k) => (
                <option key={k} value={k}>
                  {t(`trainer.post.seat.${k}` as MessageKey)}
                </option>
              ))}
            </select>
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
        <p className="text-xs text-slate-600 dark:text-slate-400">{t('trainer.post.inputs')}</p>
        <div role="status" aria-live="polite" className="text-sm" data-testid="postflop-status">
          {solve.kind === 'starting' && t('trainer.post.starting')}
          {solve.kind === 'running' && t('trainer.post.solving', { it: solve.progress?.iterations ?? 0, x: (solve.progress?.pctPot ?? 100).toFixed(2) })}
          {solve.kind === 'ready' && (
            <>
              {t('trainer.post.ready', { x: solve.result.pctPot.toFixed(2), s: (solve.result.elapsedMs / 1000).toFixed(1), it: solve.result.iterations })}
              {solve.result.reason !== 'target' && <> {t('trainer.post.notReached', { x: solve.result.pctPot.toFixed(2), target: spot.target })}</>}
            </>
          )}
          {solve.kind === 'cancelled' && t('trainer.post.cancelled')}
          {solve.kind === 'error' && <span className="text-amber-700 dark:text-amber-400">{t('trainer.post.error', { message: solve.message })}</span>}
        </div>
      </section>

      {error && <p className="text-amber-700 dark:text-amber-400">{t('trainer.post.error', { message: error })}</p>}

      {h && solve.kind === 'ready' && phase.kind !== 'none' && (
        <section className="card space-y-4" data-testid="postflop-hand">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('trainer.post.board')}</p>
              <Cards cards={h.board} size="xl" />
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('trainer.yourHand')}</p>
              <Cards cards={h.hero} size="xl" />
            </div>
            {phase.kind === 'over' && (
              <div data-testid="villain-cards">
                <p className="text-xs text-slate-600 dark:text-slate-400">{t('trainer.post.opponentHad')}</p>
                <Cards cards={h.villain} size="xl" />
              </div>
            )}
          </div>
          <p className="text-sm">
            {t('trainer.post.youAre', { seat: t(h.heroSeat === 0 ? 'trainer.post.oop' : 'trainer.post.ip') })}{' '}
            {'node' in phase &&
              t('trainer.post.pot', {
                pot: phase.node.pot.toFixed(1),
                stack: remainingStack(solve.info.spot.stack, solve.info.spot.pot, phase.node.pot, [phase.node.committed[0], phase.node.committed[1]], h.heroSeat).toFixed(1),
              })}
          </p>
          <div className="text-sm">
            <p className="font-medium">{t('trainer.post.history')}</p>
            <ol className="ml-5 list-decimal" data-testid="postflop-history">
              <li>{t('trainer.post.start', { street: spot.street })}</li>
              {h.steps.map((s, i) => (
                <li key={i}>
                  {s.kind === 'deal'
                    ? t('trainer.post.step.deal', { street: s.street, card: s.card })
                    : t(s.who === 'hero' ? 'trainer.post.step.hero' : 'trainer.post.step.villain', { label: s.label })}
                </li>
              ))}
            </ol>
          </div>

          {phase.kind === 'decide' && (
            <>
              <p className="font-medium" data-testid="your-move">
                {t('trainer.post.yourMove')}
              </p>
              <ul className="flex flex-wrap gap-2" aria-label={t('solver.actions')}>
                {phase.node.actions.map((a, i) => (
                  <li key={a}>
                    <button type="button" className="min-w-28 rounded-md border-2 border-slate-300 px-5 py-3 text-base font-semibold hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800" disabled={busy} onClick={() => void answer(i)}>
                      <span className="mr-2 text-xs text-slate-500">{i + 1}</span>
                      {a}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {phase.kind === 'over' && (
            <div className="space-y-2" data-testid="hand-over">
              <p className="font-medium">
                {t('trainer.post.handOver')}:{' '}
                {phase.node.kind === 'fold' ? t(phase.node.folder === h.heroSeat ? 'trainer.post.end.fold.hero' : 'trainer.post.end.fold.villain') : t('trainer.post.end.showdown')}
              </p>
              {grades.length > 0 && (
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {grades.map((g, i) => (
                    <CategoryBadge key={i} category={g} ungraded="notGraded" />
                  ))}
                </p>
              )}
              <button type="button" className="btn-primary" onClick={() => void deal()} autoFocus>
                {t('trainer.post.deal')}
              </button>
            </div>
          )}
        </section>
      )}

      {phase.kind === 'answered' && h && (
        <AnswerPanel
          category={phase.result.grade?.category ?? null}
          ungraded="notGraded"
          claims={phase.result.claims}
          hand={h.hero}
          rows={phase.node.actions.map<ActionRow>((action, a) => ({
            action,
            frequency: phase.result.ctx.strategy[a]!,
            ev: phase.result.ctx.ev[a] ?? null,
            evText: phase.result.ctx.ev[a] == null ? '—' : `${fmtBb(phase.result.ctx.ev[a]!)} (${((phase.result.ctx.ev[a]! / phase.node.pot) * 100).toFixed(1)}% pot)`,
            stdError: null,
          }))}
          chosen={phase.result.ctx.chosen}
          notes={[]}
          reference={null}
          lesson="trainer.lesson.postflop"
          nextLabel={t('trainer.post.continue')}
          onNext={() => void proceed()}
        />
      )}
    </div>
  );
}
