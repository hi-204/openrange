import { describe, expect, it } from 'vitest';
import type { LessonProgress } from '../trainer/store';
import type { Lesson } from './lesson';
import { dailyPlan, drillForLevel, nextLesson, scorePlacement } from './plan';

const lesson = (id: string, prerequisites: string[] = []): Lesson => ({
  path: `${id}.md`,
  body: '',
  meta: { id, level: Number(id.split('.')[0]), title: id, minutes: 6, prerequisites, drills: [], glossary: [], objectives: [], recap: [] },
});
const course = [lesson('0.1'), lesson('0.2', ['0.1']), lesson('1.1'), lesson('1.2', ['1.1']), lesson('2.1', ['1.2'])];
const done = (...ids: string[]) => new Map<string, LessonProgress>(ids.map((id) => [id, { id, completedAt: 1, lastScore: 3, bestScore: 3, questions: 3, attempts: 1 }]));

describe('placement', () => {
  it('starts at the lowest level with fewer than two of three right', () => {
    const answers = [0, 0, 0, 1, 1, 1, 2, 2, 2].map((level, i) => ({ level, correct: !(level === 1 && i % 3 !== 0) }));
    // Level 1: only one of three right.
    expect(scorePlacement(answers, 0).startLevel).toBe(1);
    const allRight = answers.map((a) => ({ ...a, correct: true }));
    expect(scorePlacement(allRight, 0).startLevel).toBe(3);
    const twoOfThree = answers.map((a, i) => ({ ...a, correct: i % 3 !== 2 }));
    expect(scorePlacement(twoOfThree, 0).startLevel).toBe(3);
    expect(scorePlacement(answers, 0).perLevel[1]).toEqual({ level: 1, correct: 1, total: 3 });
  });
});

describe('next lesson and daily plan', () => {
  it('follows course order and prerequisites from the start level', () => {
    expect(nextLesson(course, done(), 0)!.meta.id).toBe('0.1');
    expect(nextLesson(course, done('0.1'), 0)!.meta.id).toBe('0.2');
    // Starting at Level 1: earlier levels count as done.
    expect(nextLesson(course, done(), 1)!.meta.id).toBe('1.1');
    expect(nextLesson(course, done('0.1', '0.2', '1.1', '1.2', '2.1'), 0)).toBeNull();
  });

  it('builds a short plan: lesson, review when due, and a drill for the level', () => {
    const today = { lessonsCompleted: [], trainerAnswers: 0, preflopAnswers: 0, postflopAnswers: 0, mathAttempts: 0 };
    const plan = dailyPlan({ lessons: course, progress: done('0.1', '0.2'), startLevel: 0, due: 3, today });
    expect(plan.map((p) => p.kind)).toEqual(['lesson', 'review', 'drill']);
    expect(plan[0]!.kind === 'lesson' && plan[0]!.lesson.meta.id).toBe('1.1');
    expect(plan[2]!.kind === 'drill' && plan[2]!.drill).toBe('preflop');
    const minutes = plan.reduce((s, p) => s + p.minutes, 0);
    expect(minutes).toBeGreaterThanOrEqual(10);
    expect(minutes).toBeLessThanOrEqual(15);
    // Nothing due: no review item.
    expect(dailyPlan({ lessons: course, progress: done(), startLevel: 0, due: 0, today }).map((p) => p.kind)).toEqual(['lesson', 'drill']);
  });

  it('ticks items off from what was done today', () => {
    const today = { lessonsCompleted: ['1.1'], trainerAnswers: 12, preflopAnswers: 12, postflopAnswers: 0, mathAttempts: 0 };
    const plan = dailyPlan({ lessons: course, progress: done('0.1', '0.2', '1.1'), startLevel: 0, due: 2, today });
    expect(plan.every((p) => p.done)).toBe(true);
    expect(plan[0]!.kind === 'lesson' && plan[0]!.lesson.meta.id).toBe('1.1');
  });

  it('matches drills to levels', () => {
    expect([0, 1, 2, 3, 4, 5].map(drillForLevel)).toEqual(['math', 'preflop', 'math', 'preflop', 'postflop', 'postflop']);
  });
});
