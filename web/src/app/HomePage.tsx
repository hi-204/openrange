import { useEffect, useState } from 'react';
import type { Lesson } from '../features/lessons/lessonMeta';
import { drillHref } from '../features/lessons/links';
import { dailyPlan, startOfDay, type PlanItem } from '../features/lessons/plan';
import { MIN_SAMPLE, wilson } from '../features/trainer/stats';
import { trainerStore, type AnswerRecord, type LessonProgress, type MathAttempt, type PlacementResult } from '../features/trainer/store';
import type { FamilyState } from '../features/trainer/srs';
import { pct } from '../lib/format';
import { t, type MessageKey } from '../lib/i18n';
import { Icon } from '../lib/ui/Icon';
import { Skeleton } from '../lib/ui/components';
import { solverClient } from '../lib/wasm/client';
import type { HelloResult } from '../lib/wasm/protocol';
import { href } from './route';

/** Whether the service worker has cached the app for offline use (production builds, D-080). */
function OfflineStatus() {
  const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  const [ready, setReady] = useState(!!sw?.controller);
  useEffect(() => {
    if (!sw) return;
    const on = () => setReady(!!sw.controller);
    sw.addEventListener('controllerchange', on);
    return () => sw.removeEventListener('controllerchange', on);
  }, [sw]);
  if (!sw || !import.meta.env.PROD) return null;
  return <p data-testid="offline-status">{t(ready ? 'about.offlineReady' : 'about.offlinePending')}</p>;
}

type Data = { answers: AnswerRecord[]; families: Map<string, FamilyState>; lessons: Map<string, LessonProgress>; math: MathAttempt[]; placement: PlacementResult | null; course: Lesson[] };

// The course text is large, so it loads in its own chunk rather than with the home page.
const loadCourse = () => import('../features/lessons/content').then((m) => m.LESSONS);

const DAY = 86_400_000;

/** Days in a row (ending today or yesterday) with any activity. */
function streak(times: number[], now: number): number {
  const days = new Set(times.map((x) => startOfDay(x)));
  let day = startOfDay(now);
  if (!days.has(day)) day -= DAY;
  let n = 0;
  while (days.has(day)) {
    n++;
    day = startOfDay(day - DAY / 2);
  }
  return n;
}

function planLink(p: PlanItem): string {
  if (p.kind === 'lesson') return href('learn', [p.lesson.meta.id]);
  if (p.kind === 'review') return href('train', ['preflop']);
  return drillHref(p.drill);
}

function planText(p: PlanItem): string {
  if (p.kind === 'lesson') return t('home.plan.lesson', { title: p.lesson.meta.title, minutes: p.minutes });
  if (p.kind === 'review') return t('home.plan.review', { n: p.target, due: p.due });
  return t(`home.plan.drill.${p.drill}` as MessageKey, { n: p.target });
}

export function HomePage() {
  const [data, setData] = useState<Data | null>(null);
  const [engine, setEngine] = useState<HelloResult | null>(null);
  const [engineError, setEngineError] = useState<string | null>(null);
  useEffect(() => {
    const s = trainerStore();
    const empty = { answers: [], families: new Map(), lessons: new Map(), math: [], placement: null };
    Promise.all([s.answers(), s.families(), s.lessons(), s.math(), s.placement(), loadCourse()])
      .then(([answers, families, lessons, math, placement, course]) => setData({ answers, families, lessons, math, placement, course }))
      .catch(() =>
        loadCourse()
          .then((course) => setData({ ...empty, course }))
          .catch(() => setData({ ...empty, course: [] })),
      );
    solverClient()
      .call('hello', {})
      .then(setEngine)
      .catch((e: Error) => setEngineError(e.message));
  }, []);

  const now = Date.now();
  const today = startOfDay(now);
  let plan: PlanItem[] = [];
  let recent = { n: 0, good: 0 };
  let days = 0;
  let last: AnswerRecord | undefined;
  if (data) {
    const startLevel = data.placement?.startLevel ?? 0;
    const todayAnswers = data.answers.filter((a) => a.at >= today);
    plan = dailyPlan({
      lessons: data.course,
      progress: data.lessons,
      startLevel: Math.min(startLevel, Math.max(...data.course.map((l) => l.meta.level), 0)),
      due: [...data.families.values()].filter((f) => f.due <= now).length,
      today: {
        lessonsCompleted: [...data.lessons.values()].filter((l) => l.completedAt >= today).map((l) => l.id),
        trainerAnswers: todayAnswers.length,
        preflopAnswers: todayAnswers.filter((a) => a.drill === 'preflop').length,
        postflopAnswers: todayAnswers.filter((a) => a.drill === 'postflop').length,
        mathAttempts: data.math.filter((m) => m.at >= today).length,
      },
    });
    const week = data.answers.filter((a) => a.graded && a.category && a.at >= now - 7 * DAY);
    recent = { n: week.length, good: week.filter((a) => a.category === 'best' || a.category === 'acceptable').length };
    days = streak([...data.answers.map((a) => a.at), ...data.math.map((m) => m.at), ...[...data.lessons.values()].map((l) => l.completedAt)], now);
    last = data.answers.at(-1);
  }
  const nextStep = !data ? null : !data.placement ? { text: t('home.next.placement'), link: href('learn', ['placement']) } : (plan.find((p) => !p.done) ?? null) && { text: planText(plan.find((p) => !p.done)!), link: planLink(plan.find((p) => !p.done)!) };
  const w = wilson(recent.good, recent.n);

  return (
    <div className="space-y-6" data-testid="home">
      <section className="card flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <p className="eyebrow">{t('home.welcome')}</p>
          <h2 className="text-2xl font-semibold tracking-tight">{last ? t('home.continue') : t('home.start')}</h2>
          <p className="max-w-prose text-sm text-ink-muted">{last ? t('home.continueText', { drill: t(`trainer.tab.${last.drill}` as MessageKey) }) : t('home.startText')}</p>
        </div>
        {!data ? (
          <Skeleton className="h-11 w-40" />
        ) : (
          <a className="btn-primary" href={last ? href('train', [last.drill]) : href('learn')} data-testid="continue">
            {last ? t('home.continueCta') : t('home.startCta')}
            <Icon name="arrowRight" size={18} />
          </a>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="card space-y-3" aria-labelledby="plan-heading" data-testid="daily-plan">
          <div className="flex items-baseline justify-between">
            <h2 id="plan-heading" className="text-lg font-semibold">
              {t('home.plan.title')}
            </h2>
            {plan.length > 0 && <span className="num text-sm text-ink-muted">{t('home.plan.minutes', { n: plan.reduce((s, p) => s + p.minutes, 0) })}</span>}
          </div>
          {!data ? (
            <Skeleton className="h-28" />
          ) : (
            <ul className="space-y-2">
              {plan.map((p, i) => (
                <li key={i}>
                  <a href={planLink(p)} className="flex min-h-12 items-center gap-3 rounded-control border border-line px-3 py-2 transition-colors hover:bg-surface-2" style={{ transitionDuration: 'calc(var(--dur-fast) * var(--motion))' }}>
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${p.done ? 'border-good bg-good text-canvas' : 'border-line'}`} aria-hidden>
                      {p.done && <Icon name="check" size={14} />}
                    </span>
                    <span className="flex-1 text-sm">
                      {planText(p)}
                      {p.done && <span className="sr-only"> ({t('home.plan.done')})</span>}
                    </span>
                    <span className="num text-xs text-ink-muted">{t('home.plan.min', { n: p.minutes })}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="text-xs text-ink-muted">{t('home.plan.note')}</p>
        </section>

        <div className="space-y-4">
          <section className="card space-y-1" data-testid="recent-accuracy">
            <h2 className="eyebrow">{t('home.accuracy')}</h2>
            {recent.n === 0 ? (
              <p className="text-sm text-ink-muted">{t('home.accuracyNone')}</p>
            ) : (
              <>
                <p className="num text-3xl font-semibold">{pct(recent.good / recent.n, 0)}</p>
                <p className="text-xs text-ink-muted">{recent.n >= MIN_SAMPLE ? t('home.accuracyInterval', { n: recent.n, low: pct(w.low, 0), high: pct(w.high, 0) }) : t('home.accuracyFew', { n: recent.n, min: MIN_SAMPLE })}</p>
              </>
            )}
          </section>
          <section className="card space-y-1">
            <h2 className="eyebrow">{t('home.streak')}</h2>
            <p className="text-sm">{days > 0 ? t('home.streakDays', { n: days }) : t('home.streakNone')}</p>
          </section>
          {nextStep && (
            <section className="card space-y-2" data-testid="next-step">
              <h2 className="eyebrow">{t('home.next')}</h2>
              <a href={nextStep.link} className="flex items-center gap-2 text-sm font-medium text-accent">
                {nextStep.text} <Icon name="arrowRight" size={16} />
              </a>
            </section>
          )}
        </div>
      </div>

      <section aria-labelledby="about-heading" className="space-y-2 text-sm leading-relaxed text-ink-muted">
        <h2 id="about-heading" className="text-base font-medium text-ink">
          {t('about.heading')}
        </h2>
        <p>{t('about.studyOnly')}</p>
        <p>{t('about.offline')}</p>
        <OfflineStatus />
        <p role="status" aria-live="polite" data-testid="solver-status" className="text-xs">
          {engine ? (
            <>
              {t('status.ready', { version: engine.version })} <span data-testid="combo-count">{t('status.combos', { count: engine.combos })}</span>
            </>
          ) : engineError ? (
            t('status.error', { message: engineError })
          ) : (
            t('status.loading')
          )}
        </p>
      </section>
    </div>
  );
}
