// A multi-part Math Lab drill (D-087): every part is graded, then the coaching card shows each
// answer and the worked solution. Attempts are saved with the math drills (drill "lab.<id>").

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { useSettings } from '../../lib/settings/useSettings';
import { ErrorState, Skeleton } from '../../lib/ui/components';
import { solverClient } from '../../lib/wasm/client';
import { labCoach } from '../coach/coach';
import { CoachCard } from '../coach/CoachCard';
import { CardRow } from '../table/Card';
import { mulberry32 } from '../trainer/preflop/deal';
import { trainerStore } from '../trainer/store';
import type { Step } from '../trainer/math/drills';
import { checkPart, generateLab, partAnswerText, pctText, valueOf, type LabDrillId, type LabEngine, type LabProblem, type Part } from './labDrills';

export const labEngine: LabEngine = {
  equity: async (hero, villain, board) => {
    const r = await solverClient().call('equity', { request: { ranges: [hero, villain], board, dead: '', mode: 'exact' } });
    if (!r.ok) throw new Error(r.error);
    return r.players[0]!.equity;
  },
  outs: async (hero, villain, board) => {
    const r = await solverClient().call('countOuts', { hero, villain, board });
    if (!r.ok) throw new Error(r.error);
    return r;
  },
  category: async (cards) => {
    const r = await solverClient().call('evaluateHand', { cards });
    if (!r.ok) throw new Error(r.error);
    return r.categoryIndex;
  },
};

const stepText = (s: Step) => t(s.key as MessageKey, s.params);
const split = (c: string) => c.match(/.{2}/g) ?? [];
const placeholder = (p: Part) => t(`lab.placeholder.${p.kind}` as MessageKey);

function PartInput({ part, index, total, value, onChange, disabled }: { part: Part; index: number; total: number; value: string; onChange: (v: string) => void; disabled: boolean }) {
  const id = useId();
  const label = `${t('lab.part', { n: index + 1, total })}: ${stepText(part.prompt)}`;
  if (part.kind === 'choice')
    return (
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{label}</legend>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={stepText(part.prompt)}>
          {part.choices!.map((c, i) => (
            <button key={c} type="button" role="radio" aria-checked={value === String(i)} className={value === String(i) ? 'btn-primary' : 'btn-secondary'} disabled={disabled} onClick={() => onChange(String(i))}>
              {c}
            </button>
          ))}
        </div>
      </fieldset>
    );
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field num w-44" inputMode="decimal" value={value} disabled={disabled} placeholder={placeholder(part)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function LabDrill({ drill }: { drill: LabDrillId }) {
  const detail = useSettings((s) => s.settings.coaching.detail);
  const [problem, setProblem] = useState<LabProblem | null>(null);
  const [inputs, setInputs] = useState<string[]>([]);
  const [graded, setGraded] = useState<boolean[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);

  const next = useCallback(async () => {
    setProblem(null);
    setGraded(null);
    setError(null);
    try {
      const p = await generateLab(drill, rnd, labEngine);
      setInputs(p.parts.map(() => ''));
      setProblem(p);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [drill, rnd]);
  useEffect(() => {
    void next();
  }, [next]);

  const submit = async () => {
    if (!problem || graded) return;
    const results = problem.parts.map((p, i) => checkPart(p, inputs[i] ?? ''));
    setGraded(results);
    const given = problem.parts.map((p, i) => (p.kind === 'choice' ? (p.choices![Number(inputs[i])] ?? '') : inputs[i] ?? '')).join(' | ');
    const estimate = drill === 'estimate' ? valueOf(problem.parts[0]!, inputs[0] ?? '') : NaN;
    await trainerStore().addMath({
      at: Date.now(),
      drill: `lab.${drill}`,
      correct: results.every(Boolean),
      given,
      answer: problem.parts.map(partAnswerText).join(' | '),
      parts: results,
      ...(Number.isFinite(estimate) ? { estimate, exact: problem.facts.exact as number } : {}),
    });
  };

  const ready = problem && problem.parts.every((_, i) => (inputs[i] ?? '').trim() !== '');
  const steps = problem ? problem.steps.map(stepText) : [];
  const shown = detail === 'simple' ? steps.slice(-1) : steps;
  const right = graded ? graded.filter(Boolean).length : 0;

  return (
    <div className="space-y-4">
      {error && <ErrorState title={t('flow.errorTitle')} message={error} />}
      {!problem && !error && <Skeleton className="h-40" />}
      {problem && (
        <form
          className="card space-y-4"
          data-testid="lab-problem"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-lg font-medium">{stepText(problem.intro)}</p>
          {problem.cards && (
            <div className="flex flex-wrap gap-6">
              {(['hero', 'villain', 'board'] as const).map((k) =>
                problem.cards![k] ? (
                  <div key={k}>
                    <p className="eyebrow mb-1">{t(`lab.cards.${k}` as MessageKey)}</p>
                    <CardRow cards={split(problem.cards![k]!)} size="sm" />
                  </div>
                ) : null,
              )}
            </div>
          )}
          {problem.parts.map((p, i) => (
            <PartInput key={i} part={p} index={i} total={problem.parts.length} value={inputs[i] ?? ''} disabled={!!graded} onChange={(v) => setInputs((xs) => xs.map((x, j) => (j === i ? v : x)))} />
          ))}
          <button type="submit" className="btn-primary" disabled={!!graded || !ready}>
            {t('lab.checkAnswer')}
          </button>
        </form>
      )}
      {problem && graded && (
        <>
          <section className="card space-y-1 text-sm" data-testid="lab-results" aria-live="polite">
            <p className="font-medium">{t('lab.yourAnswers')}</p>
            <ul className="space-y-1">
              {problem.parts.map((p, i) => (
                <li key={i} data-correct={graded[i] ? 'true' : 'false'}>
                  {t('lab.part', { n: i + 1, total: problem.parts.length })}: {p.kind === 'choice' ? (p.choices![Number(inputs[i])] ?? '') : inputs[i]} — {graded[i] ? t('lab.right') : t('lab.wrong', { answer: partAnswerText(p) })}
                </li>
              ))}
            </ul>
            {drill === 'estimate' && Number.isFinite(valueOf(problem.parts[0]!, inputs[0] ?? '')) && (
              <p data-testid="estimate-error">
                {t('lab.estimate.error', {
                  given: pctText(valueOf(problem.parts[0]!, inputs[0] ?? '')),
                  exact: pctText(problem.facts.exact as number),
                  error: ((valueOf(problem.parts[0]!, inputs[0] ?? '') - (problem.facts.exact as number)) * 100).toFixed(1),
                })}
              </p>
            )}
          </section>
          <CoachCard card={labCoach(right, problem.parts.length, drill, shown, problem.parts.map(partAnswerText))} nextLabel={t('lab.next')} onNext={() => void next()} testId="lab-answer" />
        </>
      )}
    </div>
  );
}
