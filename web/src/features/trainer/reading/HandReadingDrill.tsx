// Hand-reading drill (D-089): read the opponent's action in a solved spot, paint the hands they
// take it with, then compare with the solution's range.

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { pct } from '../../../lib/format';
import { t, type MessageKey } from '../../../lib/i18n';
import { cellName } from '../../../lib/poker/hands';
import { ErrorState, Skeleton } from '../../../lib/ui/components';
import { CancelledError, SolverClient } from '../../../lib/wasm/client';
import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { ClassGrid } from '../../charts/ClassGrid';
import { CardRow } from '../../table/Card';
import { DRILL_SPOTS } from '../postflop/spots';
import { mulberry32 } from '../preflop/deal';
import { combosOfClass } from '../ranges/rangeScore';
import { READING_TASKS, readingTarget, scoreReading, type ReadingTarget } from './reading';

const NAMES = Array.from({ length: 169 }, (_, i) => cellName(i));
const BUDGET = 1.5e9;
type Solved = { info: SolverInfo; source: (path: number[]) => Promise<SolverNode> };
const taskKey = (i: number) => `${READING_TASKS[i]!.spot}|${READING_TASKS[i]!.id}`;

export function HandReadingDrill() {
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const [taskIndex, setTaskIndex] = useState(() => Math.floor(rnd() * READING_TASKS.length));
  const [target, setTarget] = useState<ReadingTarget | null>(null);
  const [picked, setPicked] = useState<boolean[]>(() => NAMES.map(() => false));
  const [checked, setChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const solved = useRef(new Map<string, { client: SolverClient; solved: Promise<Solved> }>());
  const id = useId();
  const task = READING_TASKS[taskIndex]!;

  useEffect(
    () => () => {
      solved.current.forEach((s) => s.client.cancel());
      solved.current.clear();
    },
    [],
  );

  const solve = useCallback((spotId: string): Promise<Solved> => {
    const have = solved.current.get(spotId);
    if (have) return have.solved;
    const spot = DRILL_SPOTS.find((d) => d.id === spotId)!;
    const client = new SolverClient();
    const p = (async () => {
      const info = await client.call('solverStart', { spot: spot.spot, budgetBytes: BUDGET, allowAbstraction: false });
      await client.call('solverRun', { maxIterations: spot.maxIterations, targetPct: spot.target });
      return { info, source: (path: number[]) => client.call('solverNode', { path }) };
    })();
    solved.current.set(spotId, { client, solved: p });
    return p;
  }, []);

  useEffect(() => {
    setTarget(null);
    setChecked(false);
    setPicked(NAMES.map(() => false));
    setError(null);
    let alive = true;
    solve(task.spot)
      .then((s) => readingTarget(s.info, s.source, task.line))
      .then((x) => alive && setTarget(x))
      .catch((e: Error) => alive && !(e instanceof CancelledError) && setError(e.message));
    return () => {
      alive = false;
    };
  }, [task, solve]);

  const score = checked && target ? scoreReading(target, picked) : null;
  const actorName = (p: 0 | 1) => t(p === 0 ? 'reading.actor.oop' : 'reading.actor.ip');
  const tag = (p: 0 | 1) => t(p === 0 ? 'reading.oop' : 'reading.ip');
  const yours = picked.map((p) => [p ? 0 : 1, p ? 1 : 0]);
  const solution = target ? target.frequency.map((f) => [1 - f, f]) : [];
  const reachShare = target ? target.weight.map((w, i) => w / combosOfClass(NAMES[i]!)) : undefined;
  const actionLabel = target ? target.labels.at(-1)! : '';

  return (
    <div className="space-y-4" data-testid="reading-drill">
      <p className="max-w-prose text-sm text-ink-muted">{t('reading.intro')}</p>
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor={id} className="mb-1 block text-sm font-medium">
            {t('reading.taskLabel')}
          </label>
          <select id={id} className="field" value={taskIndex} onChange={(e) => setTaskIndex(Number(e.target.value))}>
            {READING_TASKS.map((x, i) => (
              <option key={taskKey(i)} value={i}>
                {t(`trainer.post.spot.${x.spot}` as MessageKey)}: {t(`reading.task.${x.id}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" className="btn-secondary" onClick={() => setTaskIndex(Math.floor(rnd() * READING_TASKS.length))}>
          {t('reading.random')}
        </button>
      </div>
      {error && <ErrorState title={t('flow.errorTitle')} message={error} />}
      {!target && !error && (
        <div className="space-y-2">
          <p className="text-sm text-ink-muted">{t('reading.solving')}</p>
          <Skeleton className="h-64" />
        </div>
      )}
      {target && (
        <section className="card space-y-3">
          <CardRow cards={target.board} size="sm" />
          <p className="text-lg font-medium" data-testid="reading-task">
            {t('reading.prompt', { line: target.labels.map((l, i) => `${tag(target.who[i]!)}: ${l}`).join(' → '), actor: actorName(target.actor), action: actionLabel })}
          </p>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('reading.yours')}</p>
              <ClassGrid classes={NAMES} strategy={yours} actions={[t('widget.grid.out'), t('widget.grid.in')]} colors={['transparent', '#E69F00']} selected={null} onSelect={(i) => !checked && setPicked((p) => p.map((v, j) => (j === i ? !v : v)))} label={t('reading.yours')} />
            </div>
            {checked && (
              <div className="space-y-2" data-testid="reading-solution">
                <p className="text-sm font-medium">{t('reading.solution', { actor: actorName(target.actor), action: actionLabel })}</p>
                <ClassGrid classes={NAMES} strategy={solution} actions={[t('reading.other'), actionLabel]} colors={['transparent', '#0072B2']} reach={reachShare} selected={null} onSelect={() => undefined} label={t('reading.solution', { actor: actorName(target.actor), action: actionLabel })} />
              </div>
            )}
          </div>
          {score && (
            <div className="space-y-1 text-sm" data-testid="reading-score">
              <p className="font-medium">{t('reading.result', { recall: pct(score.recall, 0), precision: pct(score.precision, 0) })}</p>
              {score.missedHands.length > 0 && <p>{t('reading.missed', { hands: score.missedHands.slice(0, 8).join(', ') })}</p>}
              {score.extraHands.length > 0 && <p>{t('reading.extra', { hands: score.extraHands.slice(0, 8).join(', ') })}</p>}
              {score.impossible.length > 0 && <p>{t('reading.impossible', { hands: score.impossible.slice(0, 8).join(', ') })}</p>}
              <p className="text-xs text-ink-muted">{t('reading.note')}</p>
            </div>
          )}
          <div className="flex gap-2">
            {!checked ? (
              <button type="button" className="btn-primary" onClick={() => setChecked(true)}>
                {t('reading.check')}
              </button>
            ) : (
              <button type="button" className="btn-primary" onClick={() => setTaskIndex(Math.floor(rnd() * READING_TASKS.length))}>
                {t('reading.next')}
              </button>
            )}
            {!checked && (
              <button type="button" className="btn-quiet" onClick={() => setPicked(NAMES.map(() => false))}>
                {t('ranges.clear')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
