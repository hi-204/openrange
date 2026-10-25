import { describe, expect, it } from 'vitest';
import { evaluate, renderCalc } from './calc';

describe('lesson calc', () => {
  it('evaluates arithmetic with precedence and parentheses', () => {
    expect(evaluate('10 / (20 + 10)')).toBeCloseTo(1 / 3);
    expect(evaluate('2 + 3 * 4')).toBe(14);
    expect(evaluate('(2 + 3) * 4')).toBe(20);
    expect(evaluate('-3 + 5')).toBe(2);
    expect(evaluate('0.5 * 9 - 1.25')).toBe(3.25);
  });

  it('refuses anything that is not plain arithmetic', () => {
    for (const bad of ['', 'alert(1)', '2 +', '1 / 0', '(1 + 2', '1 + 2)', 'Math.PI', '2 ** 3'])
      expect(() => evaluate(bad), bad).toThrow();
  });

  it('formats and optionally shows the working', () => {
    expect(renderCalc('5 / (15 + 5) | pct')).toBe('25%');
    expect(renderCalc('9 / 47 | pct1')).toBe('19.1%');
    expect(renderCalc('5 / (15 + 5) | pct | show')).toBe('5 ÷ (15 + 5) = 25%');
    expect(renderCalc('52 * 51 / 2 | int')).toBe('1,326');
    expect(() => renderCalc('1 | furlongs')).toThrow(/unknown format/);
  });
});
