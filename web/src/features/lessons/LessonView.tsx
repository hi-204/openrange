import { useEffect, useMemo, useRef, useState } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { solverClient } from '../../lib/wasm/client';
import { GLOSSARY } from './content';
import { renderInline, renderLesson, type Lesson, type QuizQuestion } from './lesson';
import { Widget } from './widgets/Widget';

const equityCache = new Map<string, Promise<string>>();

/** `{{eq a vs b on board}}`: exact equity of the first hand, computed by the engine. */
function equityText(a: string, b: string, board: string): Promise<string> {
  const key = `${a}|${b}|${board}`;
  let p = equityCache.get(key);
  if (!p) {
    p = solverClient()
      .call('equity', { request: { ranges: [a, b], board, dead: '', mode: 'exact' } })
      .then((r) => (r.ok ? pct(r.players[0]!.equity, 1) : `(${r.error})`));
    equityCache.set(key, p);
  }
  return p;
}

function Prose({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let live = true;
    for (const el of ref.current?.querySelectorAll<HTMLElement>('.lesson-eq') ?? []) {
      equityText(el.dataset.a ?? '', el.dataset.b ?? '', el.dataset.board ?? '').then((text) => {
        if (live) el.textContent = text;
      });
    }
    return () => {
      live = false;
    };
  }, [html]);
  // The HTML comes from our own lesson files through markdown-it with raw HTML disabled.
  return <div ref={ref} className="lesson-prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Quiz({ questions, onSubmit, testId = 'quiz' }: { questions: QuizQuestion[]; onSubmit: (score: number) => void; testId?: string }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const html = (s: string) => ({ __html: renderInline(s, GLOSSARY) });
  const score = picked.filter((p, i) => p === questions[i]!.answer).length;
  return (
    <section className="card space-y-4" data-testid={testId}>
      {questions.map((q, i) => (
        <fieldset key={i} className="space-y-2">
          <legend className="font-medium">
            {i + 1}. <span dangerouslySetInnerHTML={html(q.q)} />
          </legend>
          {q.choices.map((c, k) => {
            const right = submitted && k === q.answer;
            const wrong = submitted && picked[i] === k && k !== q.answer;
            return (
              <label key={k} className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm ${right ? 'border-[#0072B2]' : wrong ? 'border-[#D55E00]' : 'border-slate-200 dark:border-slate-700'}`}>
                <input type="radio" name={`${testId}-q${i}`} checked={picked[i] === k} disabled={submitted} onChange={() => setPicked((p) => p.map((x, j) => (j === i ? k : x)))} />
                <span dangerouslySetInnerHTML={html(c)} />
                {right && <span className="ml-auto text-xs font-semibold">✓ {t('lesson.quiz.correct')}</span>}
                {wrong && <span className="ml-auto text-xs font-semibold">✗ {t('lesson.quiz.yourPick')}</span>}
              </label>
            );
          })}
          {submitted && <p className="text-sm text-slate-700 dark:text-slate-300" dangerouslySetInnerHTML={html(q.explain)} />}
        </fieldset>
      ))}
      {submitted ? (
        <p role="status" className="font-medium" data-testid={`${testId}-score`}>
          {t('lesson.quiz.score', { score, total: questions.length })}
        </p>
      ) : (
        <button
          type="button"
          className="btn-primary"
          disabled={picked.some((p) => p === null)}
          onClick={() => {
            setSubmitted(true);
            onSubmit(score);
          }}
        >
          {t('lesson.quiz.submit')}
        </button>
      )}
    </section>
  );
}

export function LessonView({ lesson, onQuiz }: { lesson: Lesson; onQuiz: (score: number, total: number) => void }) {
  const segments = useMemo(() => renderLesson(lesson.body, GLOSSARY), [lesson]);
  return (
    <article className="space-y-5" data-testid="lesson">
      {segments.map((s, i) =>
        s.kind === 'html' ? (
          <Prose key={i} html={s.html} />
        ) : s.kind === 'widget' ? (
          <Widget key={i} name={s.name} config={s.config} />
        ) : (
          <Quiz key={i} questions={s.questions} onSubmit={(score) => onQuiz(score, s.questions.length)} />
        ),
      )}
    </article>
  );
}
