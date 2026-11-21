// Math Lab answer keys against the engine (D-087): every stored answer is recomputed here,
// independently, from the WASM engine or the closed-form formula, and every worked-solution
// verdict must agree with the graded answer.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countOuts, equity, evaluateHand, initSync, parseRange } from '../../../public/wasm/solver_wasm.js';
import { combosOf, DECK } from '../lessons/widgets/cards';
import { mulberry32 } from '../trainer/preflop/deal';
import { checkPart, CLOSE, ESTIMATE_TOLERANCE, EV_CLOSE, generateLab, hasDraw, LAB_DRILLS, pairRange, partAnswerText, valueRange, type LabEngine, type LabProblem } from './labDrills';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

const exactEquity = (hero: string, villain: string, board: string): number => {
  const r = JSON.parse(equity(JSON.stringify({ ranges: [hero, villain], board, dead: '', mode: 'exact' })));
  if (!r.ok) throw new Error(r.error);
  return r.players[0].equity;
};
const engine: LabEngine = {
  equity: async (h, v, b) => exactEquity(h, v, b),
  outs: async (hero, villain, board) => JSON.parse(countOuts(JSON.stringify({ hero, villain, board }))),
  category: async (cards) => JSON.parse(evaluateHand(cards)).categoryIndex,
};
const split = (c: string) => c.match(/.{2}/g) ?? [];
const typed = (p: LabProblem) => p.parts.map((x) => (x.kind === 'percent' ? `${(x.answer * 100).toFixed(2)}%` : x.kind === 'choice' ? String(x.answer) : String(x.answer)));
const stepKeys = (p: LabProblem) => p.steps.map((s) => s.key);
const N = 25;

describe('Math Lab drills', () => {
  it('every drill generates problems whose typed exact answers are accepted', async () => {
    const rnd = mulberry32(11);
    for (const d of LAB_DRILLS) {
      for (let i = 0; i < 8; i++) {
        const p = await generateLab(d, rnd, engine);
        expect(p.parts.length).toBeGreaterThan(0);
        typed(p).forEach((v, k) => expect(checkPart(p.parts[k]!, v), `${d} part ${k}: ${v} vs ${partAnswerText(p.parts[k]!)}`).toBe(true));
      }
    }
  });

  it('the ranges are valid engine ranges and contain what they say', () => {
    const board = ['Kh', '7d', '2c'];
    for (const r of [valueRange(board), pairRange(board)]) expect(JSON.parse(parseRange(r)).ok).toBe(true);
    const v = valueRange(board).split(',');
    // Overpair, set, two pair, top pair with a ten-or-better kicker; not a weak top pair.
    for (const h of ['AA', 'KK', '77', 'K7', 'AK', 'KT']) expect(v).toContain(h);
    expect(v).not.toContain('K9');
    expect(pairRange(board).split(',')).toContain('72');
    expect(hasDraw(['Ah', '5h'], ['Kh', '9h', '2c'])).toBe(true);
    expect(hasDraw(['9s', '8d'], ['7c', '6h', '2d'])).toBe(true);
    expect(hasDraw(['As', 'Kd'], ['7c', '7h', '2d'])).toBe(false);
  });

  it('pot-odds decisions: price, engine equity and verdict agree', async () => {
    const rnd = mulberry32(3);
    for (let i = 0; i < N; i++) {
      const p = await generateLab('potdecision', rnd, engine);
      const f = p.facts as Record<string, number>;
      expect(p.parts[0]!.answer).toBeCloseTo(f.bet! / (f.pot! + 2 * f.bet!), 12);
      const range = p.facts.range === 'pair' ? pairRange(split(p.cards!.board!)) : valueRange(split(p.cards!.board!));
      expect(exactEquity(p.cards!.hero!, range, p.cards!.board!)).toBeCloseTo(f.equity!, 9);
      expect(hasDraw(split(p.cards!.hero!), split(p.cards!.board!))).toBe(p.facts.draw === 'true');
      const call = f.equity! >= f.required!;
      const close = Math.abs(f.equity! - f.required!) < CLOSE;
      expect(p.parts[1]!.answer).toBe(call ? 0 : 1);
      expect(p.parts[1]!.accept).toEqual(close ? [0, 1] : [call ? 0 : 1]);
      expect(stepKeys(p)).toContain(close ? 'lab.potdecision.close' : call ? 'lab.potdecision.call' : 'lab.potdecision.fold');
    }
  });

  it('rule of 2 and 4: clean outs, tainted outs and exact equity from the engine', async () => {
    const rnd = mulberry32(5);
    for (let i = 0; i < N; i++) {
      const p = await generateLab('rule24', rnd, engine);
      const { hero, villain, board } = p.cards!;
      const o = JSON.parse(countOuts(JSON.stringify({ hero, villain, board })));
      expect(p.parts[0]!.answer).toBe(o.ahead.length);
      const mult = split(board!).length === 3 ? 4 : 2;
      expect(p.parts[1]!.answer).toBeCloseTo((o.ahead.length * mult) / 100, 12);
      expect(p.facts.exact as number).toBeCloseTo(exactEquity(hero!, villain!, board!), 9);
      // Tainted: in "behind" but improves the hand category.
      const cat = (cards: string) => JSON.parse(evaluateHand(cards)).categoryIndex as number;
      const now = cat(hero! + board!);
      const tainted = (o.behind as string[]).filter((c) => cat(hero! + board! + c) > now);
      expect(p.facts.tainted).toBe(tainted.length);
      expect(stepKeys(p).includes('lab.rule24.tainted')).toBe(tainted.length > 0);
    }
  });

  it('equity estimates: the exact equity comes from the engine; scoring uses the stated tolerance', async () => {
    const rnd = mulberry32(8);
    for (let i = 0; i < N; i++) {
      const p = await generateLab('estimate', rnd, engine);
      const villain = p.cards!.villain ?? valueRange(split(p.cards!.board!));
      expect(p.facts.exact as number).toBeCloseTo(exactEquity(p.cards!.hero!, villain, p.cards!.board ?? ''), 9);
      const part = p.parts[0]!;
      expect(part.tolerance).toBe(ESTIMATE_TOLERANCE);
      expect(checkPart(part, `${((part.answer + ESTIMATE_TOLERANCE * 0.9) * 100).toFixed(2)}%`)).toBe(true);
      expect(checkPart(part, `${((part.answer + ESTIMATE_TOLERANCE * 1.2) * 100).toFixed(2)}%`)).toBe(false);
    }
  });

  it('EV of a bet: the sum of probability × value, and the comparison with checking', async () => {
    const rnd = mulberry32(13);
    for (let i = 0; i < N; i++) {
      const p = await generateLab('ev', rnd, engine);
      const f = p.facts as Record<string, number>;
      const ev = f.fold! * f.pot! + (1 - f.fold!) * f.win! * (f.pot! + f.bet!) - (1 - f.fold!) * (1 - f.win!) * f.bet!;
      expect(p.parts[0]!.answer).toBeCloseTo(ev, 12);
      expect(f.evCheck).toBeCloseTo(f.checkWin! * f.pot!, 12);
      const close = Math.abs(ev - f.evCheck!) < EV_CLOSE;
      expect(p.parts[1]!.accept).toEqual(close ? [0, 1] : [ev >= f.evCheck! ? 0 : 1]);
      expect(stepKeys(p)).toContain(close ? 'lab.ev.close' : ev >= f.evCheck! ? 'lab.ev.betBetter' : 'lab.ev.checkBetter');
    }
  });

  it('implied odds: the equity matches the engine and the extra amount breaks even', async () => {
    const rnd = mulberry32(17);
    for (let i = 0; i < N; i++) {
      const p = await generateLab('implied', rnd, engine);
      const f = p.facts as Record<string, number>;
      expect(f.equity).toBeCloseTo(exactEquity(p.cards!.hero!, p.cards!.villain!, p.cards!.board!), 9);
      expect(f.equity).toBeLessThan(f.required!);
      expect(f.equity! * (f.pot! + f.bet! + f.extra!) - (1 - f.equity!) * f.bet!).toBeCloseTo(0, 9);
    }
  });

  it('blockers: combos counted independently from the deck', async () => {
    const rnd = mulberry32(19);
    // Count combos of a class by enumerating card pairs (not through combosOf's own rules).
    const count = (hand: string, known: string[]) => {
      let n = 0;
      for (let a = 0; a < DECK.length; a++)
        for (let b = a + 1; b < DECK.length; b++) {
          const [x, y] = [DECK[a]!, DECK[b]!];
          if (known.includes(x) || known.includes(y)) continue;
          const [hi, lo] = 'AKQJT98765432'.indexOf(x[0]!) <= 'AKQJT98765432'.indexOf(y[0]!) ? [x, y] : [y, x];
          const suited = hi[1] === lo[1];
          const name = hi[0] === lo[0] ? hi[0]! + lo[0]! : hi[0]! + lo[0]!;
          if (hand.length === 2 ? name === hand : name === hand.slice(0, 2) && (hand[2] === 's') === suited) n++;
        }
      return n;
    };
    for (let i = 0; i < N; i++) {
      const p = await generateLab('blockers', rnd, engine);
      const known = [...split(p.cards!.board!), ...split(p.cards!.hero!)];
      const value = (p.facts.value as string).split(',');
      const bluffs = (p.facts.bluffs as string).split(',');
      const valueLeft = value.reduce((s, h) => s + count(h, known), 0);
      const bluffLeft = bluffs.reduce((s, h) => s + count(h, known), 0);
      expect(p.parts[0]!.answer).toBe(valueLeft);
      expect(p.parts[1]!.answer).toBeCloseTo(valueLeft / (valueLeft + bluffLeft), 12);
      expect(value.every((h) => combosOf(h).length === count(h, []))).toBe(true);
    }
  });

  it('SPR: ratio, all-in price and engine equity agree with the verdict', async () => {
    const rnd = mulberry32(23);
    for (let i = 0; i < N; i++) {
      const p = await generateLab('spr', rnd, engine);
      const f = p.facts as Record<string, number>;
      expect(p.parts[0]!.answer).toBeCloseTo(f.stack! / f.pot!, 12);
      expect(p.parts[1]!.answer).toBeCloseTo(f.stack! / (f.pot! + 2 * f.stack!), 12);
      expect(f.equity).toBeCloseTo(exactEquity(p.cards!.hero!, valueRange(split(p.cards!.board!)), p.cards!.board!), 9);
      const close = Math.abs(f.equity! - f.required!) < CLOSE;
      expect(stepKeys(p)).toContain(close ? 'lab.spr.close' : f.equity! >= f.required! ? 'lab.spr.commit' : 'lab.spr.fold');
    }
  });
});
