import { useEffect, useState } from 'react';
import { href, type Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { trainerStore, type LessonProgress } from '../trainer/store';
import { LESSONS, lesson as findLesson } from './content';
import { LessonView } from './LessonView';

// Interim course pages (M7 groundwork); the full reader and course map come with M6.5/M7.
export function LearnPage({ route }: { route: Route }) {
  const [progress, setProgress] = useState<Map<string, LessonProgress>>(new Map());
  useEffect(() => {
    trainerStore().lessons().then(setProgress).catch(() => undefined);
  }, []);
  const id = route.rest[0];
  const current = id ? findLesson(id) : undefined;
  if (current) {
    return (
      <div className="space-y-4">
        <a href={href('learn')} className="text-sm underline">
          {t('nav.learn')}
        </a>
        <h2 className="text-2xl font-semibold">{current.meta.title}</h2>
        <LessonView
          lesson={current}
          onQuiz={(score, total) => {
            const old = progress.get(current.meta.id);
            const p: LessonProgress = { id: current.meta.id, completedAt: Date.now(), lastScore: score, bestScore: Math.max(score, old?.bestScore ?? 0), questions: total, attempts: (old?.attempts ?? 0) + 1 };
            void trainerStore().putLesson(p);
            setProgress(new Map(progress).set(p.id, p));
          }}
        />
      </div>
    );
  }
  return (
    <ul className="space-y-1" data-testid="lesson-list">
      {LESSONS.map((l) => (
        <li key={l.meta.id}>
          <a href={href('learn', [l.meta.id])} className="underline">
            {l.meta.id} {l.meta.title}
          </a>
          {progress.has(l.meta.id) && ' ✓'}
        </li>
      ))}
    </ul>
  );
}
