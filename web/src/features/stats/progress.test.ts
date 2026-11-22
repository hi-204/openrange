import { describe, expect, it } from 'vitest';
import type { AnswerRecord, LessonProgress, MathAttempt } from '../trainer/store';
import { autoDifficulty, compareWeeks, levelOf, milestones, MIN_SKILL, MIN_WEEK, readingCalibration, skills, weeks, weekStart } from './progress';

const DAY = 86_400_000;
const now = new Date(2026, 10, 20, 12).getTime(); // a Friday
const ans = (at: number, category: AnswerRecord['category'], drill: AnswerRecord['drill'] = 'preflop'): AnswerRecord => ({ at, drill, graded: true, family: 'f', reference: {}, hand: 'AhKd', handClass: 'AKo', actions: [], chosen: 0, unit: 'bb', category, loss: category === 'best' ? 0 : 0.5, gradedLoss: 0, groups: {} });

describe('progress analytics', () => {
  it('weeks start on Monday and count answers, accuracy only with enough of them', () => {
    expect(new Date(weekStart(now)).getDay()).toBe(1);
    const xs = [...Array.from({ length: MIN_WEEK }, (_, i) => ans(now - i * 1000, i % 4 ? 'best' : 'mistake')), ans(now - 8 * DAY, 'best')];
    const w = weeks(xs, [], [], now);
    expect(w).toHaveLength(8);
    const cur = w.at(-1)!;
    expect(cur.answers).toBe(MIN_WEEK);
    expect(cur.accuracy).toBeCloseTo(0.75, 12);
    expect(w.at(-2)!.answers).toBe(1);
    expect(w.at(-2)!.accuracy).toBeNull();
    expect(compareWeeks(w.at(-2)!, cur)).toEqual({ kind: 'few' });
  });

  it('a change between weeks is "clear" only when the intervals separate', () => {
    const mk = (n: number, ok: number, start: number) => {
      const out: AnswerRecord[] = [];
      for (let i = 0; i < n; i++) out.push(ans(start + i * 1000, i < ok ? 'best' : 'blunder'));
      return out;
    };
    const w = weeks([...mk(100, 30, weekStart(now) - 7 * DAY + DAY), ...mk(100, 90, weekStart(now) + DAY)], [], [], now);
    const c = compareWeeks(w.at(-2)!, w.at(-1)!);
    expect(c).toMatchObject({ kind: 'both', clear: true });
    if (c.kind === 'both') expect(c.change).toBeCloseTo(0.6, 12);
  });

  it('skill levels follow the interval rule and wait for a minimum sample', () => {
    expect(levelOf({ low: 0.82, high: 0.95 })).toBe('solid');
    expect(levelOf({ low: 0.3, high: 0.55 })).toBe('needs-work');
    expect(levelOf({ low: 0.5, high: 0.85 })).toBe('developing');
    const math: MathAttempt[] = Array.from({ length: MIN_SKILL }, (_, i) => ({ at: i, drill: 'potodds', correct: i > 1, given: '', answer: '' }));
    const s = skills([], math, [], () => 0);
    const pot = s.find((x) => x.topic === 'math:potodds')!;
    expect(pot.estimate).toBeCloseTo((MIN_SKILL - 2) / MIN_SKILL, 12);
    expect(s.find((x) => x.topic === 'math:mdf')!.estimate).toBeNull();
    // Quiz scores pool per course level.
    const lessons: LessonProgress[] = Array.from({ length: 5 }, (_, i) => ({ id: `2.${i + 1}`, completedAt: i, lastScore: 3, bestScore: 3, questions: 4, attempts: 1 }));
    expect(skills([], [], lessons, (id) => Number(id.split('.')[0])).find((x) => x.topic === 'level:2')).toMatchObject({ n: 20, right: 15 });
  });

  it('milestones: answer counts, finished levels, calibration ready', () => {
    const xs = Array.from({ length: 100 }, (_, i) => ans(i, 'best'));
    const lessons: LessonProgress[] = [{ id: '0.1', completedAt: 500, lastScore: 3, bestScore: 3, questions: 3, attempts: 1 }];
    const m = milestones(xs, [], lessons, new Map([[0, ['0.1']], [1, ['1.1']]]));
    expect(m.map((x) => x.id)).toEqual(['answers:10', 'answers:100', 'level:0']);
  });

  it('automatic difficulty moves with recent results', () => {
    expect(autoDifficulty([ans(1, 'best')]).difficulty).toBe('any');
    const many = (cat: AnswerRecord['category']) => Array.from({ length: 20 }, (_, i) => ans(i, cat));
    expect(autoDifficulty(many('best')).difficulty).toBe('hard');
    expect(autoDifficulty(many('mistake')).difficulty).toBe('easy');
    expect(autoDifficulty([...many('best').slice(0, 14), ...many('mistake').slice(0, 6)]).difficulty).toBe('medium');
  });

  it('range-read calibration notices painting too wide', () => {
    const xs: MathAttempt[] = Array.from({ length: MIN_SKILL }, (_, i) => ({ at: i, drill: 'reading', correct: false, given: '', answer: '', recall: 0.9, precision: 0.5 }));
    expect(readingCalibration(xs)).toMatchObject({ tendency: 'wide' });
    expect(readingCalibration(xs.slice(1))).toBeNull();
  });
});
