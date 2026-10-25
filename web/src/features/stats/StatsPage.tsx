import { useEffect, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { LESSONS } from '../lessons/content';
import { ReviewPage } from '../trainer/ReviewPage';
import { MATH_DRILLS } from '../trainer/math/drills';
import { MIN_SAMPLE, wilson } from '../trainer/stats';
import { trainerStore, type LessonProgress, type MathAttempt } from '../trainer/store';

/** Course progress and math accuracy, then the trainer stats (with their intervals). */
export function StatsPage() {
  const [lessons, setLessons] = useState<Map<string, LessonProgress> | null>(null);
  const [math, setMath] = useState<MathAttempt[]>([]);
  useEffect(() => {
    const s = trainerStore();
    s.lessons().then(setLessons).catch(() => setLessons(new Map()));
    s.math().then(setMath).catch(() => undefined);
  }, []);
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card space-y-2" data-testid="course-progress">
          <h2 className="eyebrow">{t('stats.course')}</h2>
          <p className="num text-3xl font-semibold">
            {lessons ? lessons.size : '–'} <span className="text-base font-normal text-ink-muted">/ {LESSONS.length}</span>
          </p>
          <p className="text-sm text-ink-muted">{t('stats.lessonsDone')}</p>
        </div>
        <div className="card space-y-2" data-testid="math-stats">
          <h2 className="eyebrow">{t('stats.math')}</h2>
          {math.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('stats.mathNone')}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {MATH_DRILLS.map((d) => {
                const mine = math.filter((m) => m.drill === d.id);
                if (!mine.length) return null;
                const right = mine.filter((m) => m.correct).length;
                const w = wilson(right, mine.length);
                return (
                  <li key={d.id} className="flex justify-between gap-2">
                    <span>{t(`math.drill.${d.id}` as MessageKey)}</span>
                    <span className="num">
                      {mine.length >= MIN_SAMPLE ? `${pct(right / mine.length, 0)} (${pct(w.low, 0)}–${pct(w.high, 0)})` : t('review.notEnough', { n: mine.length, min: MIN_SAMPLE })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
      <ReviewPage />
    </div>
  );
}
