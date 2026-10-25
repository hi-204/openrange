import { useEffect, useMemo, useRef, useState } from 'react';
import { href } from '../../app/route';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { Icon, type IconName } from '../../lib/ui/Icon';
import { ProgressBar } from '../../lib/ui/components';
import { solverClient } from '../../lib/wasm/client';
import { FACTS, GLOSSARY } from './content';
import { renderInline, renderLesson, sections, type CalloutVariant, type Lesson, type QuizQuestion } from './lesson';
import { drillHref } from './links';
import { Widget } from './widgets/Widget';

const equityCache = new Map<string, Promise<string>>();

/** Fallback for `{{eq}}` not yet in facts.json: computed live by the engine. */
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
    for (const el of ref.current?.querySelectorAll<HTMLElement>('.lesson-eq[data-a]') ?? []) {
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

const CALLOUT: Record<CalloutVariant, { icon: IconName; label: MessageKey; className: string }> = {
  key: { icon: 'bulb', label: 'lesson.callout.key', className: 'border-accent bg-accent-soft' },
  mistake: { icon: 'warning', label: 'lesson.callout.mistake', className: 'border-bad bg-surface-2' },
  try: { icon: 'spark', label: 'lesson.callout.try', className: 'border-good bg-surface-2' },
  example: { icon: 'learn', label: 'lesson.callout.example', className: 'border-line bg-surface-2' },
};

function Callout({ variant, html }: { variant: CalloutVariant; html: string }) {
  const c = CALLOUT[variant];
  return (
    <aside className={`max-w-[68ch] rounded-control border-l-4 px-4 py-3 ${c.className}`} data-testid={`callout-${variant}`}>
      <p className="eyebrow mb-1 flex items-center gap-1.5">
        <Icon name={c.icon} size={16} /> {t(c.label)}
      </p>
      <div className="lesson-prose text-sm [&>p]:my-1" dangerouslySetInnerHTML={{ __html: html }} />
    </aside>
  );
}

/** Quiz with instant feedback per question; the score is recorded once every question is answered. */
export function Quiz({ questions, onSubmit, onChange, testId = 'quiz' }: { questions: QuizQuestion[]; onSubmit: (score: number) => void; onChange?: (picked: (number | null)[]) => void; testId?: string }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const html = (s: string) => ({ __html: renderInline(s, GLOSSARY, FACTS) });
  const done = picked.every((p) => p !== null);
  const score = picked.filter((p, i) => p === questions[i]!.answer).length;
  const reported = useRef(false);
  useEffect(() => onChange?.(picked), [picked, onChange]);
  useEffect(() => {
    if (done && !reported.current) {
      reported.current = true;
      onSubmit(score);
    }
  }, [done, score, onSubmit]);
  return (
    <section className="card space-y-5" data-testid={testId}>
      {questions.map((q, i) => {
        const p = picked[i];
        return (
          <fieldset key={i} className="space-y-2">
            <legend className="font-medium">
              {i + 1}. <span dangerouslySetInnerHTML={html(q.q)} />
            </legend>
            {q.choices.map((c, k) => {
              const right = p !== null && k === q.answer;
              const wrong = p === k && k !== q.answer;
              return (
                <label key={k} className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-control border px-3 py-2 text-sm transition-colors ${right ? 'border-good' : wrong ? 'border-bad' : 'border-line hover:bg-surface-2'}`}>
                  <input type="radio" name={`${testId}-q${i}`} checked={p === k} disabled={p !== null} onChange={() => setPicked((x) => x.map((v, j) => (j === i ? k : v)))} />
                  <span dangerouslySetInnerHTML={html(c)} />
                  {right && <span className="ml-auto text-xs font-semibold text-good">✓ {t('lesson.quiz.correct')}</span>}
                  {wrong && <span className="ml-auto text-xs font-semibold text-bad">✗ {t('lesson.quiz.yourPick')}</span>}
                </label>
              );
            })}
            {p !== null && (
              <p role="status" className="rounded-control bg-surface-2 px-3 py-2 text-sm">
                <strong>{p === q.answer ? t('lesson.quiz.right') : t('lesson.quiz.notQuite')}</strong> <span dangerouslySetInnerHTML={html(q.explain)} />
              </p>
            )}
          </fieldset>
        );
      })}
      {done && (
        <p role="status" className="font-medium" data-testid={`${testId}-score`}>
          {t('lesson.quiz.score', { score, total: questions.length })}
        </p>
      )}
    </section>
  );
}

/** Share of the article scrolled past (for the reading progress bar). */
function useReadProgress(ref: React.RefObject<HTMLElement | null>): number {
  const [p, setP] = useState(0);
  useEffect(() => {
    const on = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight * 0.6;
      setP(total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 1);
    };
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, [ref]);
  return p;
}

type Props = { lesson: Lesson; prev?: Lesson; next?: Lesson; onQuiz: (score: number, total: number) => void; bestScore?: { score: number; total: number } };

export function LessonView({ lesson, prev, next, onQuiz, bestScore }: Props) {
  const segments = useMemo(() => renderLesson(lesson.body, GLOSSARY, FACTS), [lesson]);
  const toc = useMemo(() => sections(lesson.body), [lesson]);
  const ref = useRef<HTMLElement>(null);
  const progress = useReadProgress(ref);
  const m = lesson.meta;
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-10">
      <article ref={ref} className="min-w-0 space-y-6" data-testid="lesson">
        <header className="space-y-3">
          <p className="eyebrow">{t('lesson.levelLesson', { level: m.level, id: m.id })}</p>
          <h2 className="text-3xl font-semibold tracking-tight">{m.title}</h2>
          <p className="flex items-center gap-3 text-sm text-ink-muted">
            <Icon name="timer" size={16} /> {t('lesson.minutes', { n: m.minutes })}
            {bestScore && <span>· {t('lesson.bestScore', { score: bestScore.score, total: bestScore.total })}</span>}
          </p>
          <div className="sticky top-[3.75rem] z-10 -mx-1 bg-canvas/90 px-1 py-2 backdrop-blur">
            <ProgressBar value={progress} label={t('lesson.progress')} />
          </div>
        </header>

        <section className="card max-w-[68ch] space-y-2" data-testid="objectives">
          <h3 className="eyebrow">{t('lesson.learn')}</h3>
          <ul className="space-y-1 text-sm">
            {m.objectives.map((o, i) => (
              <li key={i} className="flex gap-2">
                <Icon name="check" size={16} className="mt-0.5 text-accent" />
                <span dangerouslySetInnerHTML={{ __html: renderInline(o, GLOSSARY, FACTS) }} />
              </li>
            ))}
          </ul>
        </section>

        {segments.map((s, i) =>
          s.kind === 'html' ? (
            <Prose key={i} html={s.html} />
          ) : s.kind === 'widget' ? (
            <div key={i} className="max-w-[68ch]">
              <Widget name={s.name} config={s.config} />
            </div>
          ) : s.kind === 'callout' ? (
            <Callout key={i} variant={s.variant} html={s.html} />
          ) : (
            <div key={i} className="max-w-[68ch]">
              <Quiz questions={s.questions} onSubmit={(score) => onQuiz(score, s.questions.length)} />
            </div>
          ),
        )}

        <section className="card max-w-[68ch] space-y-2" data-testid="recap">
          <h3 className="eyebrow">{t('lesson.recap')}</h3>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {m.recap.map((r, i) => (
              <li key={i} dangerouslySetInnerHTML={{ __html: renderInline(r, GLOSSARY, FACTS) }} />
            ))}
          </ul>
        </section>

        {m.drills.length > 0 && (
          <section className="flex max-w-[68ch] flex-wrap items-center gap-2" data-testid="practice">
            <span className="text-sm font-medium">{t('lesson.practice')}</span>
            {m.drills.map((d) => (
              <a key={d} className="btn-primary" href={drillHref(d)}>
                {t(`lesson.drill.${d.split(':')[0]}` as MessageKey)}
                <Icon name="arrowRight" size={16} />
              </a>
            ))}
          </section>
        )}

        <nav className="flex max-w-[68ch] justify-between gap-3 border-t border-line pt-4 text-sm" aria-label={t('lesson.nav')}>
          {prev ? (
            <a className="btn-quiet" href={href('learn', [prev.meta.id])}>
              ← {prev.meta.title}
            </a>
          ) : (
            <span />
          )}
          {next ? (
            <a className="btn-secondary" href={href('learn', [next.meta.id])}>
              {next.meta.title} →
            </a>
          ) : (
            <a className="btn-secondary" href={href('learn')}>
              {t('lesson.backToCourse')}
            </a>
          )}
        </nav>
      </article>

      <aside className="hidden lg:block">
        <nav aria-label={t('lesson.toc')} className="sticky top-24 space-y-1 text-sm">
          <p className="eyebrow mb-2">{t('lesson.toc')}</p>
          {toc.map((s) => (
            <a key={s.id} href={`#${s.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' }); }} className="block rounded px-2 py-1 text-ink-muted hover:bg-surface-2 hover:text-ink">
              {s.title}
            </a>
          ))}
        </nav>
      </aside>
    </div>
  );
}
