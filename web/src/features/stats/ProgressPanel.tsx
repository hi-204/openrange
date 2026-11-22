// Progress on the Stats page (D-093): this week against last, an eight-week trend, skill estimates,
// milestones, optional weekly goals and range-read calibration. Numbers wait for enough data.

import { useEffect, useMemo, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { useSettings } from '../../lib/settings/useSettings';
import { Badge, ProgressBar, Switch } from '../../lib/ui/components';
import { LESSONS } from '../lessons/content';
import { trainerStore, type AnswerRecord, type LessonProgress, type MathAttempt } from '../trainer/store';
import { compareWeeks, milestones, MIN_SKILL, MIN_WEEK, readingCalibration, skills, weeks, type Week } from './progress';

const levelOfLesson = (id: string) => Number(id.split('.')[0]);

function Trend({ ws }: { ws: Week[] }) {
  const W = 320;
  const H = 90;
  const x = (k: number) => 16 + (k * (W - 32)) / (ws.length - 1);
  const y = (v: number) => H - 10 - v * (H - 20);
  const pts = ws.map((w, k) => (w.accuracy === null ? null : { k, w }));
  const shown = pts.filter((p): p is { k: number; w: Week } => p !== null);
  const label = shown.length ? t('progress.trendLabel', { list: shown.map((p) => pct(p.w.accuracy!, 0)).join(', ') }) : t('progress.trendNone', { min: MIN_WEEK });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md" role="img" aria-label={label} data-testid="progress-trend">
      <line x1={16} x2={W - 16} y1={y(0.5)} y2={y(0.5)} stroke="currentColor" strokeOpacity={0.15} />
      {shown.map(({ k, w }) => (
        <g key={k}>
          <line x1={x(k)} x2={x(k)} y1={y(w.interval!.low)} y2={y(w.interval!.high)} stroke="#0072B2" strokeOpacity={0.4} strokeWidth={3} />
          <circle cx={x(k)} cy={y(w.accuracy!)} r={3.5} fill="#0072B2" />
        </g>
      ))}
      {shown.length > 1 && <polyline points={shown.map(({ k, w }) => `${x(k)},${y(w.accuracy!)}`).join(' ')} fill="none" stroke="#0072B2" strokeWidth={1.5} />}
    </svg>
  );
}

export function ProgressPanel() {
  const goals = useSettings((s) => s.settings.goals);
  const update = useSettings((s) => s.update);
  const [data, setData] = useState<{ answers: AnswerRecord[]; math: MathAttempt[]; lessons: LessonProgress[] } | null>(null);
  useEffect(() => {
    const s = trainerStore();
    Promise.all([s.answers(), s.math(), s.lessons()])
      .then(([answers, math, lessons]) => setData({ answers, math, lessons: [...lessons.values()] }))
      .catch(() => setData({ answers: [], math: [], lessons: [] }));
  }, []);
  const view = useMemo(() => {
    if (!data) return null;
    const ws = weeks(data.answers, data.math, data.lessons, Date.now());
    const levels = new Map<number, string[]>();
    for (const l of LESSONS) levels.set(l.meta.level, [...(levels.get(l.meta.level) ?? []), l.meta.id]);
    return {
      ws,
      cmp: compareWeeks(ws.at(-2)!, ws.at(-1)!),
      sk: skills(data.answers, data.math, data.lessons, levelOfLesson),
      ms: milestones(data.answers, data.math, data.lessons, levels),
      reading: readingCalibration(data.math),
    };
  }, [data]);
  if (!view) return null;
  const cur = view.ws.at(-1)!;
  const shownSkills = view.sk.filter((s) => s.n > 0);
  const topic = (id: string) => {
    const [kind, rest] = id.split(':') as [string, string];
    if (kind === 'math') return t(`math.drill.${rest}` as MessageKey);
    if (kind === 'drill') return t(`progress.drill.${rest}` as MessageKey);
    return t('progress.level', { level: rest });
  };
  return (
    <section className="space-y-4" data-testid="progress">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-2" data-testid="progress-week">
          <h2 className="eyebrow">{t('progress.thisWeek')}</h2>
          <p className="text-sm">{t('progress.weekCounts', { answers: cur.answers, math: cur.math, lessons: cur.lessons, days: cur.studyDays })}</p>
          <p className="text-sm">
            {view.cmp.kind === 'few' ? t('progress.compareFew', { min: MIN_WEEK }) : view.cmp.clear ? t(view.cmp.change > 0 ? 'progress.better' : 'progress.worse', { change: pct(Math.abs(view.cmp.change), 0) }) : t('progress.noClearChange')}
          </p>
          <Trend ws={view.ws} />
          <p className="text-xs text-ink-muted">{t('progress.trendNote', { min: MIN_WEEK })}</p>
        </div>
        <div className="card space-y-3" data-testid="progress-goals">
          <h2 className="eyebrow">{t('progress.goals')}</h2>
          <Switch label={t('progress.goalsOn')} checked={goals.enabled} onChange={(enabled) => void update((s) => ({ ...s, goals: { ...s.goals, enabled } }))} />
          {goals.enabled && (
            <>
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-2">
                  {t('progress.goalDays')}
                  <input className="field num w-20" type="number" min={1} max={7} value={goals.studyDays} onChange={(e) => void update((s) => ({ ...s, goals: { ...s.goals, studyDays: Math.max(1, Math.min(7, Number(e.target.value) || 1)) } }))} />
                </label>
                <label className="flex items-center gap-2">
                  {t('progress.goalAnswers')}
                  <input className="field num w-24" type="number" min={1} value={goals.answers} onChange={(e) => void update((s) => ({ ...s, goals: { ...s.goals, answers: Math.max(1, Number(e.target.value) || 1) } }))} />
                </label>
              </div>
              <ProgressBar value={Math.min(1, cur.studyDays / goals.studyDays)} label={t('progress.goalDaysBar', { n: cur.studyDays, goal: goals.studyDays })} />
              <p className="text-xs">{t('progress.goalDaysBar', { n: cur.studyDays, goal: goals.studyDays })}</p>
              <ProgressBar value={Math.min(1, (cur.answers + cur.math) / goals.answers)} label={t('progress.goalAnswersBar', { n: cur.answers + cur.math, goal: goals.answers })} />
              <p className="text-xs">{t('progress.goalAnswersBar', { n: cur.answers + cur.math, goal: goals.answers })}</p>
            </>
          )}
          <p className="text-xs text-ink-muted">{t('progress.goalsNote')}</p>
          <h3 className="eyebrow pt-2">{t('progress.milestones')}</h3>
          {view.ms.length === 0 ? (
            <p className="text-sm text-ink-muted">{t('progress.noMilestones')}</p>
          ) : (
            <ul className="space-y-0.5 text-sm" data-testid="progress-milestones">
              {view.ms.map((m) => (
                <li key={m.id}>
                  {t(`progress.milestone.${m.id.split(':')[0]}` as MessageKey, { n: m.id.split(':')[1] ?? '' })} <span className="text-xs text-ink-muted">· {new Date(m.at).toLocaleDateString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="card space-y-2" data-testid="progress-skills">
        <h2 className="eyebrow">{t('progress.skills')}</h2>
        {shownSkills.length === 0 ? (
          <p className="text-sm text-ink-muted">{t('progress.noSkills')}</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-ink-muted">
                <th className="py-1">{t('progress.topic')}</th>
                <th className="py-1">{t('progress.n')}</th>
                <th className="py-1">{t('progress.estimate')}</th>
              </tr>
            </thead>
            <tbody>
              {shownSkills.map((s) => (
                <tr key={s.topic} className="border-t border-line">
                  <td className="py-1">{topic(s.topic)}</td>
                  <td className="py-1 num">{s.n}</td>
                  <td className="py-1">
                    {s.estimate === null ? (
                      <span className="text-ink-muted">{t('review.notEnough', { n: s.n, min: MIN_SKILL })}</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="num">
                          {pct(s.estimate, 0)} <span className="text-xs text-ink-muted">({pct(s.interval!.low, 0)}–{pct(s.interval!.high, 0)})</span>
                        </span>
                        <Badge tone={s.level === 'solid' ? 'good' : s.level === 'needs-work' ? 'warn' : 'neutral'}>{t(`progress.level.${s.level}` as MessageKey)}</Badge>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {view.reading && <p className="text-sm" data-testid="progress-reading">{t(`progress.reading.${view.reading.tendency}` as MessageKey, { n: view.reading.n, recall: pct(view.reading.recall, 0), precision: pct(view.reading.precision, 0) })}</p>}
        <p className="text-xs text-ink-muted">{t('progress.skillsNote', { min: MIN_SKILL })}</p>
      </div>
    </section>
  );
}
