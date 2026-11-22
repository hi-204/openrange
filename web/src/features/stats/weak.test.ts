import { describe, expect, it } from 'vitest';
import type { FamilyState } from '../trainer/srs';
import type { AnswerRecord } from '../trainer/store';
import { MAX_FAMILIES, weakPlan } from './weak';

let t = 0;
const ans = (family: string, position: string, loss: number, category: AnswerRecord['category'], drill: AnswerRecord['drill'] = 'preflop'): AnswerRecord => ({
  at: ++t,
  drill,
  graded: true,
  family,
  reference: drill === 'preflop' ? { file: 'pushfold-hu.json' } : { spot: 'river-qj742' },
  hand: 'AhKd',
  handClass: 'AKo',
  actions: ['Fold', 'All-in'],
  chosen: 0,
  unit: drill === 'preflop' ? 'bb' : 'pctPot',
  category,
  loss,
  gradedLoss: loss,
  groups: { position, scenario: 'first-in', handClass: 'AKo' },
});

describe('weakness-targeted sessions', () => {
  it('nothing to target without mistakes', () => {
    expect(weakPlan([ans('f1', 'SB', 0, 'best')], new Map()).source).toBe('none');
  });

  it('falls back to recent mistakes when there is too little data for leaks', () => {
    const p = weakPlan([ans('f1', 'SB', 0, 'best'), ans('f2', 'SB', 2, 'blunder'), ans('f3', 'BB', 0.5, 'mistake'), ans('', 'IP', 30, 'blunder', 'postflop')], new Map());
    expect(p.source).toBe('recent');
    expect(p.families).toEqual(['f3', 'f2']);
    expect(p.files).toEqual(['pushfold-hu.json']);
    expect(p.postflopSpots).toEqual(['river-qj742']);
  });

  it('includes families lapsed in review', () => {
    const lapsed: FamilyState = { family: 'f9', ease: 2, repetitions: 0, intervalDays: 0, due: 0, lapses: 2, answers: 3 };
    const p = weakPlan([ans('f9', 'SB', 0.05, 'acceptable')], new Map([['f9', lapsed]]));
    expect(p.families).toEqual(['f9']);
  });

  it('uses statistical leaks when one position clearly loses more', () => {
    const xs: AnswerRecord[] = [];
    // 40 answers from the BB with big losses, 40 from the SB with none: the BB is a leak.
    for (let i = 0; i < 40; i++) xs.push(ans(`bb-${i % 10}`, 'BB', 0.8 + (i % 3) * 0.1, 'mistake'));
    for (let i = 0; i < 40; i++) xs.push(ans(`sb-${i % 5}`, 'SB', 0, 'best'));
    const p = weakPlan(xs, new Map());
    expect(p.source).toBe('leaks');
    expect(p.leaks).toContainEqual({ dimension: 'position', value: 'BB' });
    expect(p.families.every((f) => f.startsWith('bb-'))).toBe(true);
    expect(p.families.length).toBeLessThanOrEqual(MAX_FAMILIES);
  });
});
