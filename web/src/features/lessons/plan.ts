// Placement scoring and the daily plan (D-061). Pure functions over progress data.

import type { Lesson } from './lessonMeta';
import type { LessonProgress, PlacementResult } from '../trainer/store';

/** Recommended start: the lowest level with fewer than 2 of its 3 right (Level 5 if all pass). */
export function scorePlacement(answers: { level: number; correct: boolean }[], at: number): PlacementResult {
  const levels = [...new Set(answers.map((a) => a.level))].sort((a, b) => a - b);
  const perLevel = levels.map((level) => {
    const mine = answers.filter((a) => a.level === level);
    return { level, correct: mine.filter((a) => a.correct).length, total: mine.length };
  });
  const weak = perLevel.find((p) => p.correct < Math.ceil((2 / 3) * p.total));
  return { at, perLevel, startLevel: weak ? weak.level : Math.max(...levels) + 1, chosen: false };
}

export const isDone = (id: string, progress: Map<string, LessonProgress>) => progress.has(id);

/**
 * The next lesson: the first not completed at or after the start level whose prerequisites are
 * done (prerequisites below the start level count as done). Falls back to the first unfinished
 * one at or after the start level.
 */
export function nextLesson(lessons: Lesson[], progress: Map<string, LessonProgress>, startLevel: number): Lesson | null {
  const open = lessons.filter((l) => l.meta.level >= startLevel && !isDone(l.meta.id, progress));
  const ready = open.find((l) => l.meta.prerequisites.every((p) => isDone(p, progress) || Number(p.split('.')[0]) < startLevel));
  return ready ?? open[0] ?? null;
}

export type PlanItem =
  | { kind: 'lesson'; lesson: Lesson; minutes: number; done: boolean }
  | { kind: 'review'; due: number; target: number; minutes: number; done: boolean }
  | { kind: 'drill'; drill: 'math' | 'preflop' | 'postflop'; target: number; minutes: number; done: boolean };

/** Drill that fits the level being studied. */
export function drillForLevel(level: number): 'math' | 'preflop' | 'postflop' {
  return level === 1 || level === 3 ? 'preflop' : level >= 4 ? 'postflop' : 'math';
}

export type PlanInput = {
  lessons: Lesson[];
  progress: Map<string, LessonProgress>;
  startLevel: number;
  /** Trainer spot families due now. */
  due: number;
  /** Counted since the start of the local day. */
  today: { lessonsCompleted: string[]; trainerAnswers: number; preflopAnswers: number; postflopAnswers: number; mathAttempts: number };
};

export const REVIEW_TARGET = 10;
export const DRILL_TARGET = { math: 5, preflop: 10, postflop: 4 } as const;

export function dailyPlan(input: PlanInput): PlanItem[] {
  const items: PlanItem[] = [];
  const doneToday = input.lessons.find((l) => input.today.lessonsCompleted.includes(l.meta.id));
  const lesson = doneToday ?? nextLesson(input.lessons, input.progress, input.startLevel);
  if (lesson) items.push({ kind: 'lesson', lesson, minutes: lesson.meta.minutes, done: !!doneToday });
  if (input.due > 0 || input.today.trainerAnswers > 0) {
    const target = Math.min(REVIEW_TARGET, Math.max(input.due, 1));
    items.push({ kind: 'review', due: input.due, target, minutes: 4, done: input.due === 0 || input.today.trainerAnswers >= target });
  }
  const level = lesson?.meta.level ?? input.startLevel;
  const drill = drillForLevel(level);
  const got = drill === 'math' ? input.today.mathAttempts : drill === 'preflop' ? input.today.preflopAnswers : input.today.postflopAnswers;
  items.push({ kind: 'drill', drill, target: DRILL_TARGET[drill], minutes: 4, done: got >= DRILL_TARGET[drill] });
  return items;
}

export function startOfDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
