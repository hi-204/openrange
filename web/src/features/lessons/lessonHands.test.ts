// Every showdown claim in the Level 0 lessons and every outs claim in Level 2, checked with the engine's hand evaluator
// (docs/LESSON_REVIEW.md cites this test).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import FACTS_JSON from '../../content/en/facts.json';
import { countOuts, equity, evaluateHand, initSync } from '../../../public/wasm/solver_wasm.js';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

const FACTS = FACTS_JSON as Record<string, number>;
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

const outs = (hero: string, villain: string, board: string) =>
  (JSON.parse(countOuts(JSON.stringify({ hero, villain, board }))) as { ahead: string[] }).ahead;
const eq = (a: string, b: string, board = '') =>
  (JSON.parse(equity(JSON.stringify({ ranges: [a, b], board, dead: '', mode: 'exact' }))) as { players: { equity: number }[] }).players[0]!.equity;

describe('Level 2 outs and equity claims', () => {
  it('2.1: combo draw 15 outs against aces', () => {
    const o = outs('8h7h', 'AsAd', '9h6c2h');
    expect(o.length).toBe(15);
    expect(o.filter((c) => c.endsWith('h')).length).toBe(9);
    expect(o.filter((c) => !c.endsWith('h')).sort()).toEqual(['5c', '5d', '5s', 'Tc', 'Td', 'Ts']);
  });

  it('2.1: tainted out against a set; overcards are not outs', () => {
    const o = outs('AhKh', 'QsQd', 'Qh7h2c');
    expect(o.length).toBe(8);
    expect(o).not.toContain('2h');
    expect(o.some((c) => c[0] === 'A' || c[0] === 'K')).toBe(false);
    expect(ev('Ah Kh Qh 7h 2c 2h').category).toBe('flush');
    expect(ev('Qs Qd Qh 7h 2c 2h').category).toBe('full house');
  });

  it('2.1: worked hand, 8 outs against aces and more against A-K', () => {
    const o = outs('JcTc', 'AhAd', '9h8d2s');
    expect(o.map((c) => c[0]).sort().join('')).toBe('7777QQQQ'); // four sevens, four queens
    expect(outs('JcTc', 'AsKd', '9h8d2s').length).toBeGreaterThan(o.length);
  });

  it('2.2: runner-runner two pair beats aces', () => {
    expect(winner('8h7h', 'AsAd', '9h6c2h8c7d')).toBe('a');
    expect(eq('8h7h', 'AsAd', '9h6c2h')).toBeGreaterThan(1 - (32 * 31) / (47 * 46));
    expect(eq('AhKh', 'QsQd', 'Qh7h2c')).toBeLessThan(1 - (39 * 38) / (47 * 46));
  });

  // Uses the build-time facts (content.test checks them against the engine).
  it('2.4: equity against a range is the combo-weighted average; the worked hand folds', () => {
    const avg = (18 * FACTS['JsJd vs QQ+']! + 16 * FACTS['JsJd vs AKs, AKo']!) / 34;
    expect(FACTS['JsJd vs QQ+, AKs, AKo']!).toBeCloseTo(avg, 9);
    expect(FACTS['JsJd vs QQ+, AKs, AKo']!).toBeLessThan(50 / 110);
    expect(FACTS['KsKd vs AcAd']!).toBeGreaterThan(0.15); // "about four times in five"
    expect(FACTS['KsKd vs AcAd']!).toBeLessThan(0.25);
    for (const k of ['AhKh vs QsQd', 'AhKd vs 7c7d', 'JsJd vs AcKc']) expect(Math.abs(FACTS[k]! - 0.5), k).toBeLessThan(0.1); // close to a coin flip
  });

  it('2.6: on Q-T-3-2 only a jack gives 9-8 a straight', () => {
    const board = 'QcTd3h2s';
    const seen = new Set(['9s', '8s', 'Qc', 'Td', '3h', '2s']);
    const straights: string[] = [];
    for (const r of '23456789TJQKA') for (const s of 'cdhs') {
      const c = r + s;
      if (!seen.has(c) && ev('9s8s' + board + c).category === 'straight') straights.push(c);
    }
    expect(straights.sort()).toEqual(['Jc', 'Jd', 'Jh', 'Js']);
  });

  it('2.8: with the ace of hearts, nothing beats an ace-high flush on K-9-4 of hearts', () => {
    // The best possible hand on this board is the A-high flush (no pair, no straight flush).
    expect(ev('Ah Th Kh 9h 4h 7c 2d').category).toBe('flush');
    for (const x of ['Qh Jh', 'Th 8h', '6h 5h']) expect(winner('AhTh', x.replace(' ', ''), 'Kh9h4h7c2d')).toBe('a');
  });
});
