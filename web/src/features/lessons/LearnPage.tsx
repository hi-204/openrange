import { useCallback, useEffect, useState } from 'react';
import { href, type Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { EmptyState, ProgressBar } from '../../lib/ui/components';
import { Icon } from '../../lib/ui/Icon';
import { trainerStore, type LessonProgress, type PlacementResult } from '../trainer/store';
import { GLOSSARY, LESSONS, LEVELS, lesson as findLesson, PLACEMENT } from './content';
import { renderInline } from './lesson';
import { LessonView, Quiz } from './LessonView';
import { nextLesson, scorePlacement } from './plan';

function useCourse() {
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());
  const [placement, setPlacement] = useState<PlacementResult | null>(null);
  useEffect(() => {
    const s = trainerStore();
    s.lessons().then(setProgress).catch(() => undefined);
    s.placement().then(setPlacement).catch(() => undefined);
  }, []);
  return { progress, setProgress, placement, setPlacement };
}

function Placement({ placement, onDone }: { placement: PlacementResult | null; onDone: (p: PlacementResult) => void }) {
  const [answers, setAnswers] = useState<{ level: number; correct: boolean }[] | null>(null);
  const [picks, setPicks] = useState<(number | null)[]>([]);
  if (!PLACEMENT.length)
    return (
      <EmptyState icon="learn" title={t('learn.placement.soonTitle')} action={<a className="btn-primary" href={href('learn')}>{t('learn.back')}</a>}>
        {t('learn.placement.soon')}
      </EmptyState>
    );
  const result = answers ? scorePlacement(answers, Date.now()) : placement;
  return (
    <div className="space-y-5" data-testid="placement">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold">{t('learn.placement.title')}</h2>
        <p className="max-w-prose text-sm text-ink-muted">{t('learn.placement.intro', { n: PLACEMENT.length })}</p>
      </div>
      {!answers && (
        <Quiz testId="placement-quiz" questions={PLACEMENT} onSubmit={() => undefined} onChange={setPicks} />
      )}
      {!answers && (
        <button
          type="button"
          className="btn-primary"
          onClick={() => {
            // Unanswered questions count as not right.
            const a = PLACEMENT.map((q, i) => ({ level: q.level, correct: picks[i] === q.answer }));
            const r = scorePlacement(a, Date.now());
            setAnswers(a);
            void trainerStore().putPlacement(r);
            onDone(r);
          }}
        >
          {t('learn.placement.finish')}
        </button>
      )}
      {result && (
        <section className="card space-y-2" data-testid="placement-result">
          <h3 className="font-semibold">{t('learn.placement.result', { level: result.startLevel })}</h3>
          <ul className="text-sm">
            {result.perLevel.map((p) => (
              <li key={p.level}>{t('learn.placement.perLevel', { level: p.level, correct: p.correct, total: p.total })}</li>
            ))}
          </ul>
          <a className="btn-primary" href={href('learn')}>
            {t('learn.placement.toCourse')}
          </a>
        </section>
      )}
    </div>
  );
}

function CourseMap({ progress, placement }: { progress: Map<string, LessonProgress>; placement: PlacementResult | null }) {
  const start = placement?.startLevel ?? 0;
  const next = nextLesson(LESSONS, progress, Math.min(start, Math.max(0, ...LESSONS.map((l) => l.meta.level))));
  return (
    <div className="space-y-6" data-testid="course-map">
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">{t('learn.title')}</h2>
          <p className="max-w-prose text-sm text-ink-muted">{placement ? t('learn.placed', { level: placement.startLevel }) : t('learn.intro')}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {next && (
            <a className="btn-primary" href={href('learn', [next.meta.id])} data-testid="next-lesson">
              {t('learn.continue', { title: next.meta.title })}
            </a>
          )}
          <a className="btn-secondary" href={href('learn', ['placement'])}>
            {placement ? t('learn.retake') : t('learn.takePlacement')}
          </a>
          <a className="btn-quiet" href={href('glossary')}>
            {t('nav.glossary')}
          </a>
        </div>
      </section>
      {LEVELS.map((level) => {
        const ls = LESSONS.filter((l) => l.meta.level === level);
        const done = ls.filter((l) => progress.has(l.meta.id)).length;
        return (
          <section key={level} className="space-y-3" aria-labelledby={`level-${level}`}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 id={`level-${level}`} className="text-lg font-semibold">
                {t('learn.level', { level })} · {t(`learn.level.${level}` as 'learn.level.0')}
              </h3>
              {ls.length > 0 && (
                <span className="num text-sm text-ink-muted">
                  {done}/{ls.length}
                </span>
              )}
            </div>
            {ls.length > 0 && <ProgressBar value={done / ls.length} label={t('learn.levelProgress', { level })} />}
            {ls.length === 0 ? (
              <p className="text-sm text-ink-muted">{t(level <= 4 ? 'learn.levelSoonM7' : 'learn.levelSoonM8')}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {ls.map((l) => {
                  const p = progress.get(l.meta.id);
                  return (
                    <li key={l.meta.id}>
                      <a href={href('learn', [l.meta.id])} className="flex min-h-14 items-center gap-3 rounded-control border border-line bg-surface px-3 py-2 shadow-1 transition-colors hover:bg-surface-2">
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${p ? 'border-good bg-good text-canvas' : 'border-line text-ink-muted'}`}>{p ? <Icon name="check" size={14} /> : l.meta.id}</span>
                        <span className="flex-1">
                          <span className="block text-sm font-medium">{l.meta.title}</span>
                          <span className="text-xs text-ink-muted">
                            {t('lesson.minutes', { n: l.meta.minutes })}
                            {p && ` · ${t('lesson.bestScore', { score: p.bestScore, total: p.questions })}`}
                          </span>
                        </span>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}

export function LearnPage({ route }: { route: Route }) {
  const { progress, setProgress, placement, setPlacement } = useCourse();
  const id = route.rest[0];
  const current = id ? findLesson(id) : undefined;
  const onQuiz = useCallback(
    (score: number, total: number) => {
      if (!current) return;
      const old = progress.get(current.meta.id);
      const p: LessonProgress = { id: current.meta.id, completedAt: Date.now(), lastScore: score, bestScore: Math.max(score, old?.bestScore ?? 0), questions: total, attempts: (old?.attempts ?? 0) + 1 };
      void trainerStore().putLesson(p);
      setProgress((m) => new Map(m).set(p.id, p));
    },
    [current, progress, setProgress],
  );
  if (id === 'placement') return <Placement placement={placement} onDone={setPlacement} />;
  if (id && !current)
    return (
      <EmptyState icon="learn" title={t('learn.missing.title')} action={<a className="btn-primary" href={href('learn')}>{t('learn.back')}</a>}>
        <span dangerouslySetInnerHTML={{ __html: renderInline(t('learn.missing.text', { id }), GLOSSARY) }} />
      </EmptyState>
    );
  if (current) {
    const i = LESSONS.indexOf(current);
    const p = progress.get(current.meta.id);
    return <LessonView key={current.meta.id} lesson={current} prev={LESSONS[i - 1]} next={LESSONS[i + 1]} onQuiz={onQuiz} bestScore={p ? { score: p.bestScore, total: p.questions } : undefined} />;
  }
  return <CourseMap progress={progress} placement={placement} />;
}
