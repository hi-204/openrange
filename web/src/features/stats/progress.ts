// Progress analytics (D-093): weekly numbers and trends, a week-on-week summary, skill estimates
// per topic, milestones, adaptive difficulty and range-read calibration. Pure functions over the
// stored answers, math attempts and lesson progress; every number shown waits for a minimum sample.

import { LAB_DRILLS } from '../lab/labDrills';
import { MATH_DRILLS } from '../trainer/math/drills';
import type { Difficulty } from '../trainer/preflop/deal';
import { wilson, type Interval } from '../trainer/stats';
import type { AnswerRecord, LessonProgress, MathAttempt } from '../trainer/store';

const DAY = 86_400_000;
/** Below this many answers in a week, the week's numbers aren't shown or compared. */
export const MIN_WEEK = 20;
/** Below this many attempts, a skill estimate isn't shown. */
export const MIN_SKILL = 15;

const good = (a: AnswerRecord) => a.category === 'best' || a.category === 'acceptable';
const graded = (a: AnswerRecord) => a.graded && a.category !== null && a.loss !== null;

/** Monday 00:00 (local time) of the week containing `t`. */
export function weekStart(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  const back = (d.getDay() + 6) % 7;
  return d.getTime() - back * DAY;
}

export type Week = { start: number; answers: number; good: number; accuracy: number | null; interval: Interval | null; math: number; mathRight: number; lessons: number; studyDays: number };

/** The last `n` weeks (oldest first), counting graded answers, math attempts, lessons finished and study days. */
export function weeks(answers: AnswerRecord[], math: MathAttempt[], lessons: LessonProgress[], now: number, n = 8): Week[] {
  const first = weekStart(now) - (n - 1) * 7 * DAY;
  return Array.from({ length: n }, (_, k) => {
    const start = first + k * 7 * DAY;
    // A week is 7 local days; daylight-saving shifts move the boundary by an hour at most.
    const end = weekStart(start + 7.5 * DAY);
    const inWeek = (t: number) => t >= start && t < end;
    const g = answers.filter((a) => graded(a) && inWeek(a.at));
    const ok = g.filter(good).length;
    const m = math.filter((x) => inWeek(x.at));
    const days = new Set([...answers.map((a) => a.at), ...m.map((x) => x.at), ...lessons.map((l) => l.completedAt)].filter(inWeek).map((t) => new Date(t).toDateString()));
    return {
      start,
      answers: g.length,
      good: ok,
      accuracy: g.length >= MIN_WEEK ? ok / g.length : null,
      interval: g.length >= MIN_WEEK ? wilson(ok, g.length) : null,
      math: m.length,
      mathRight: m.filter((x) => x.correct).length,
      lessons: lessons.filter((l) => inWeek(l.completedAt)).length,
      studyDays: days.size,
    };
  });
}

export type WeekComparison = { kind: 'both'; change: number; clear: boolean } | { kind: 'few' };

/** This week against last week: the accuracy change, called "clear" only when the intervals don't overlap. */
export function compareWeeks(last: Week, current: Week): WeekComparison {
  if (current.accuracy === null || last.accuracy === null || !current.interval || !last.interval) return { kind: 'few' };
  const clear = current.interval.low > last.interval.high || current.interval.high < last.interval.low;
  return { kind: 'both', change: current.accuracy - last.accuracy, clear };
}

export type Level = 'needs-work' | 'developing' | 'solid';
export type Skill = { topic: string; n: number; right: number; estimate: number | null; interval: Interval | null; level: Level | null };

/**
 * A skill level from the accuracy interval (a convention, D-093): "solid" when even the low end is
 * at least 80% right, "needs work" when even the high end is under 60%, otherwise "developing".
 */
export function levelOf(i: Interval): Level {
  return i.low >= 0.8 ? 'solid' : i.high < 0.6 ? 'needs-work' : 'developing';
}

function skill(topic: string, n: number, right: number): Skill {
  if (n < MIN_SKILL) return { topic, n, right, estimate: null, interval: null, level: null };
  const interval = wilson(right, n);
  return { topic, n, right, estimate: right / n, interval, level: levelOf(interval) };
}

/** Skill estimates: each math drill, preflop / postflop / tournament decisions, and quiz scores per course level. */
export function skills(answers: AnswerRecord[], math: MathAttempt[], lessons: LessonProgress[], levelOfLesson: (id: string) => number): Skill[] {
  const out: Skill[] = [];
  for (const id of [...MATH_DRILLS.map((d) => d.id as string), ...LAB_DRILLS.map((d) => `lab.${d}`)]) {
    const mine = math.filter((m) => m.drill === id);
    out.push(skill(`math:${id}`, mine.length, mine.filter((m) => m.correct).length));
  }
  for (const drill of ['preflop', 'postflop', 'tournament'] as const) {
    const g = answers.filter((a) => a.drill === drill && graded(a));
    out.push(skill(`drill:${drill}`, g.length, g.filter(good).length));
  }
  const byLevel = new Map<number, { q: number; right: number }>();
  for (const l of lessons) {
    const lv = levelOfLesson(l.id);
    const cur = byLevel.get(lv) ?? { q: 0, right: 0 };
    byLevel.set(lv, { q: cur.q + l.questions, right: cur.right + l.bestScore });
  }
  for (const [lv, x] of [...byLevel].sort((a, b) => a[0] - b[0])) out.push(skill(`level:${lv}`, x.q, x.right));
  return out;
}

export type Milestone = { id: string; at: number };

/** Milestones reached, with when (quiet: no badges, no streaks). */
export function milestones(answers: AnswerRecord[], math: MathAttempt[], lessons: LessonProgress[], levels: Map<number, string[]>): Milestone[] {
  const out: Milestone[] = [];
  const g = answers.filter(graded).sort((a, b) => a.at - b.at);
  for (const n of [10, 100, 1000]) if (g.length >= n) out.push({ id: `answers:${n}`, at: g[n - 1]!.at });
  const done = new Map(lessons.map((l) => [l.id, l.completedAt]));
  for (const [lv, ids] of [...levels].sort((a, b) => a[0] - b[0])) {
    if (ids.length && ids.every((id) => done.has(id))) out.push({ id: `level:${lv}`, at: Math.max(...ids.map((id) => done.get(id)!)) });
  }
  const est = math.filter((m) => typeof m.estimate === 'number').sort((a, b) => a.at - b.at);
  if (est.length >= 20) out.push({ id: 'calibration', at: est[19]!.at });
  return out.sort((a, b) => a.at - b.at);
}

/** How many recent graded preflop answers the automatic difficulty looks at, and the least it needs. */
export const AUTO_WINDOW = 20;
export const AUTO_MIN = 10;

/**
 * Adaptive difficulty for the preflop drill (D-093): harder when most recent answers are Best or
 * Acceptable, easier when many aren't; "any" until there are enough answers.
 */
export function autoDifficulty(answers: AnswerRecord[]): { difficulty: Exclude<Difficulty, 'any'> | 'any'; n: number; share: number | null } {
  const recent = answers.filter((a) => a.drill === 'preflop' && graded(a)).sort((a, b) => b.at - a.at).slice(0, AUTO_WINDOW);
  if (recent.length < AUTO_MIN) return { difficulty: 'any', n: recent.length, share: null };
  const share = recent.filter(good).length / recent.length;
  return { difficulty: share >= 0.85 ? 'hard' : share >= 0.6 ? 'medium' : 'easy', n: recent.length, share };
}

export type ReadingCalibration = { n: number; recall: number; precision: number; tendency: 'wide' | 'narrow' | 'balanced' } | null;

/** Range reads (hand-reading drill): average share of the range found and share of the painting that was right. */
export function readingCalibration(math: MathAttempt[]): ReadingCalibration {
  const xs = math.filter((m) => m.drill === 'reading' && typeof m.recall === 'number' && typeof m.precision === 'number');
  if (xs.length < MIN_SKILL) return null;
  const recall = xs.reduce((s, m) => s + m.recall!, 0) / xs.length;
  const precision = xs.reduce((s, m) => s + m.precision!, 0) / xs.length;
  // Painting too wide finds most of the range but includes much that isn't in it, and vice versa.
  const tendency = precision < recall - 0.1 ? 'wide' : recall < precision - 0.1 ? 'narrow' : 'balanced';
  return { n: xs.length, recall, precision, tendency };
}
