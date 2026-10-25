// Every showdown claim in the Level 0 lessons, checked with the engine's hand evaluator
// (docs/LESSON_REVIEW.md cites this test).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateHand, initSync } from '../../../public/wasm/solver_wasm.js';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

const ev = (cards: string) => JSON.parse(evaluateHand(cards.replace(/\s+/g, ''))) as { ok: boolean; strength: number; category: string; best: string[] };
/** Winner of a showdown: 'a', 'b' or 'split'. */
const winner = (a: string, b: string, board: string) => {
  const [x, y] = [ev(a + board).strength, ev(b + board).strength];
  return x > y ? 'a' : x < y ? 'b' : 'split';
};

describe('Level 0 showdown claims', () => {
  it('0.1: A♦Q♦ on Q♠7♥2♣Q♣9♦ is three queens with A-9', () => {
    const h = ev('Ad Qd Qs 7h 2c Qc 9d');
    expect(h.category).toBe('three of a kind');
    expect([...h.best].sort()).toEqual(['Ad', 'Qc', 'Qd', 'Qs', '9d'].sort());
  });

  it('0.4: category order and tie-breaks', () => {
    expect(ev('Kc Qd Jh Td 9s').strength).toBeLessThan(ev('Ac Jc 8c 6c 2c').strength); // straight < flush
    expect(ev('Ac Jc 8c 6c 2c').strength).toBeLessThan(ev('Qs Qh Qd 4c 4s').strength); // flush < full house
    expect(ev('Js Jh Jd As Ac').strength).toBeLessThan(ev('Qs Qh Qd 4c 4s').strength); // trips decide full houses
    expect(ev('5c 4d 3h 2s As').category).toBe('straight'); // the wheel
    expect(ev('Qc Kd Ah 2s 3c').category).toBe('high card'); // no wrap-around
    expect(ev('As Ks Qs Js Ts').category).toBe('straight flush');
    expect(ev('Ks Kd 9c 9h 3s').strength).toBeGreaterThan(ev('Qs Qh Jd Jc As').strength); // worked hand
    expect(ev('8c 8d Kh 7s 2d').strength).toBeGreaterThan(ev('8h 8s Qd Jc Ts').strength); // quiz: kicker
    expect(ev('Ah Kh 9h 5h 2h').strength).toBe(ev('As Ks 9s 5s 2s').strength); // suits don't rank
  });

  it('0.5: best five of seven', () => {
    expect(ev('Ah Kh Qh Jh 2c 7d Th').category).toBe('straight flush'); // widget example
    expect(winner('2c2d', '3s4h', '9sTdJcQhKs')).toBe('split'); // the board plays
    expect(winner('2c2d', 'Ac4h', '9sTdJcQhKs')).toBe('b'); // an ace makes the higher straight
    expect(winner('Ac7d', 'QhJh', 'KsKd8c8h4s')).toBe('a'); // worked hand: ace kicker
    expect(ev('Kc 3d As Ad 7c 7h 2s').best.includes('Kc')).toBe(true); // quiz 1
    expect(winner('Th2c', '3c3d', '5h6h7h8h9h')).toBe('a'); // quiz 2: 10♥ beats the board
  });

  it('0.6: kickers, counterfeits and splits', () => {
    expect(winner('Ad5c', 'Ac7d', 'AsKdQc9h3s')).toBe('split'); // counterfeited kickers
    const board = 'Ks9d9c4h2s';
    expect(ev('9s3d' + board).category).toBe('three of a kind'); // worked hand: C
    expect(winner('9s3d', 'KhQh', board)).toBe('a');
    expect(winner('KhQh', 'KdJc', board)).toBe('a'); // B's queen beats A's jack
    expect(winner('QhTc', 'Qd9s', 'QsJd8c5h2s')).toBe('a'); // quiz 1
    expect(winner('2c2d', '4s5h', 'AsKdQcJh3s')).toBe('a'); // quiz 2
    expect(winner('Ac2d', 'QhJh', '7s7d7c7hKs')).toBe('a'); // quiz 3
  });
});
