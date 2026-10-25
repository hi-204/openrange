import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { t, type MessageKey } from '../../../lib/i18n';
import { useSettings } from '../../../lib/settings/useSettings';
import { ErrorState, SegmentedControl, Skeleton } from '../../../lib/ui/components';
import { solverClient } from '../../../lib/wasm/client';
import { mathCoach } from '../../coach/coach';
import { CoachCard } from '../../coach/CoachCard';
import { CardRow } from '../../table/Card';
import { mulberry32 } from '../preflop/deal';
import { trainerStore } from '../store';
import { check, generate, MATH_DRILLS, type Engine, type MathDrillId, type MathProblem, type Step } from './drills';

const engine: Engine = {
  outs: async (hero, villain, board) => {
    const r = await solverClient().call('countOuts', { hero, villain, board });
    if (!r.ok) throw new Error(r.error);
    return r;
  },
  equity: async (a, b, board) => {
    const r = await solverClient().call('equity', { request: { ranges: [a, b], board, dead: '', mode: 'exact' } });
    if (!r.ok) throw new Error(r.error);
    return r.players[0]!.equity;
  },
};

const stepText = (s: Step) => t(s.key as MessageKey, s.params);
const split = (c: string) => c.match(/.{2}/g) ?? [];

function answerText(p: MathProblem): string {
  if (p.kind === 'percent') return `${(p.answer * 100).toFixed(1)}%`;
  if (p.kind === 'choice') return p.choices![p.answer]!;
  return String(p.answer);
}

export function MathDrill({ drill: initial }: { drill?: string }) {
  const detail = useSettings((s) => s.settings.coaching.detail);
  const [drill, setDrill] = useState<MathDrillId>(MATH_DRILLS.some((d) => d.id === initial) ? (initial as MathDrillId) : 'potodds');
  const [problem, setProblem] = useState<MathProblem | null>(null);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<{ correct: boolean; given: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const inputId = useId();

  const next = useCallback(async () => {
    setProblem(null);
    setResult(null);
    setInput('');
    try {
      setProblem(await generate(drill, rnd, engine));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [drill, rnd]);
  useEffect(() => {
    void next();
  }, [next]);

  const submit = async (value: string) => {
    if (!problem || result) return;
    const correct = check(problem, value);
    const given = problem.kind === 'choice' ? (problem.choices![Number(value)] ?? value) : value;
    setResult({ correct, given });
    await trainerStore().addMath({ at: Date.now(), drill, correct, given, answer: answerText(problem) });
  };

  const steps = problem ? problem.steps.map(stepText) : [];
  const shown = detail === 'simple' ? steps.slice(-1) : steps;

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <p className="text-sm font-medium">{t('math.pick')}</p>
        <SegmentedControl
          label={t('math.pick')}
          value={drill}
          onChange={setDrill}
          size="sm"
          options={MATH_DRILLS.map((d) => ({ value: d.id, label: t(`math.drill.${d.id}` as MessageKey) }))}
        />
      </div>
      {error && <ErrorState title={t('flow.errorTitle')} message={error} />}
      {!problem && !error && <Skeleton className="h-40" />}
      {problem && (
        <section className="card space-y-4" data-testid="math-problem">
          <p className="text-lg font-medium">{stepText(problem.prompt)}</p>
          {problem.cards && (
            <div className="flex flex-wrap gap-6">
              {(['hero', 'villain', 'board', 'known'] as const).map((k) =>
                problem.cards![k] ? (
                  <div key={k}>
                    <p className="eyebrow mb-1">{t(`math.cards.${k}` as MessageKey)}</p>
                    <CardRow cards={split(problem.cards![k]!)} size="sm" />
                  </div>
                ) : null,
              )}
            </div>
          )}
          {problem.kind === 'choice' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {problem.choices!.map((c, i) => (
                <button key={c} type="button" className="btn-secondary" disabled={!!result} onClick={() => void submit(String(i))}>
                  {c}
                </button>
              ))}
            </div>
          ) : (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit(input);
              }}
            >
              <div>
                <label htmlFor={inputId} className="mb-1 block text-sm font-medium">
                  {t('math.answer')}
                </label>
                <input id={inputId} className="field num w-40" inputMode="decimal" autoFocus value={input} disabled={!!result} placeholder={problem.kind === 'percent' ? t('math.placeholder') : t('math.countPlaceholder')} onChange={(e) => setInput(e.target.value)} />
              </div>
              <button type="submit" className="btn-primary" disabled={!!result || !input.trim()}>
                {t('math.check')}
              </button>
            </form>
          )}
        </section>
      )}
      {problem && result && (
        <CoachCard
          card={{ ...mathCoach(result.correct, drill, result.given, answerText(problem), shown, `${drill}|${problem.prompt.key}|${JSON.stringify(problem.facts)}`) }}
          nextLabel={t('math.next')}
          onNext={() => void next()}
          testId="math-answer"
        />
      )}
    </div>
  );
}
