import { describe, expect, it } from 'vitest';
import { href, parseRoute, redirect } from './route';

describe('routes', () => {
  it('parses pages, path segments and queries', () => {
    const r = parseRoute('#/train/math?drill=potodds');
    expect(r.page).toBe('train');
    expect(r.rest).toEqual(['math']);
    expect(r.query.get('drill')).toBe('potodds');
    expect(parseRoute('').page).toBe('');
    expect(href('learn', ['2.3'])).toBe('#/learn/2.3');
  });

  it('redirects every pre-M6.5 link', () => {
    expect(redirect(parseRoute('#/trainer'))).toBe('#/train');
    expect(redirect(parseRoute('#/trainer/postflop?spot=river-qj742'))).toBe('#/train/postflop?spot=river-qj742');
    expect(redirect(parseRoute('#/trainer/review'))).toBe('#/stats');
    expect(redirect(parseRoute('#/charts'))).toBe('#/solve/charts');
    expect(redirect(parseRoute('#/solver'))).toBe('#/solve/workbench');
    expect(redirect(parseRoute('#/equity'))).toBe('#/solve/equity');
    expect(redirect(parseRoute('#/pushfold'))).toBe('#/solve/pushfold');
    expect(redirect(parseRoute('#/learn'))).toBeNull();
  });
});
