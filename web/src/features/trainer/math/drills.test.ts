import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { countOuts, equity, initSync } from '../../../../public/wasm/solver_wasm.js';
import { mulberry32 } from '../preflop/deal';
import { bandOf, check, EQUITY_BANDS, generate, MATH_DRILLS, type Engine } from './drills';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
const engine: Engine = {
  outs: async (hero, villain, board) => JSON.parse(countOuts(JSON.stringify({ hero, villain, board }))),
  equity: async (a, b, board) => JSON.parse(equity(JSON.stringify({ ranges: [a, b], board, dead: '', mode: 'exact' }))).players[0].equity,
};

describe('math drills', () => {
  it('generate consistent problems whose stored answer matches the formula', async () => {
    const rnd = mulberry32(42);
    for (const d of ['potodds', 'mdf', 'bluff', 'combos'] as const) {
      for (let i = 0; i < 200; i++) {
        const p = await generate(d, rnd, engine);
        const f = p.facts as Record<string, number>;
        if (d === 'potodds') expect(p.answer).toBeCloseTo(f.bet! / (f.pot! + 2 * f.bet!), 12);
        if (d === 'mdf') expect(p.answer).toBeCloseTo(f.pot! / (f.pot! + f.bet!), 12);
        if (d === 'bluff') expect(p.answer).toBeCloseTo(f.bet! / (f.pot! + 2 * f.bet!), 12);
        if (d === 'combos') expect(p.answer).toBeLessThanOrEqual(f.total!);
        // Typing the exact answer is accepted.
        expect(check(p, p.kind === 'percent' ? `${(p.answer * 100).toFixed(1)}%` : String(p.answer))).toBe(true);
      }
    }
  });

  it('accepts percentages within one point, in any common notation', async () => {
    const p = await generate('potodds', mulberry32(1), engine);
    const pc = p.answer * 100;
    expect(check(p, `${pc.toFixed(2)}`)).toBe(true);
    expect(check(p, `${(pc + 0.9).toFixed(2)}%`)).toBe(true);
    expect(check(p, `${(p.answer + 0.009).toFixed(4)}`)).toBe(true);
    expect(check(p, `${(pc + 1.5).toFixed(2)}`)).toBe(false);
    expect(check(p, '')).toBe(false);
    expect(check(p, 'abc')).toBe(false);
  });

  it('outs problems use real draws and report exact equity', async () => {
    const rnd = mulberry32(7);
    for (let i = 0; i < 10; i++) {
      const p = await generate('outs', rnd, engine);
      expect(p.answer).toBeGreaterThanOrEqual(4);
      expect(p.answer).toBeLessThanOrEqual(15);
      const o = await engine.outs(p.cards!.hero!, p.cards!.villain!, p.cards!.board!);
      expect(o.ahead).toHaveLength(p.answer);
      expect(p.facts.exact as number).toBeGreaterThan(0);
    }
  }, 60_000);

  it('equity problems put the exact equity in the right band', async () => {
    const rnd = mulberry32(9);
    for (let i = 0; i < 5; i++) {
      const p = await generate('equity', rnd, engine);
      const eq = p.facts.exact as number;
      const band = bandOf(eq);
      expect(eq).toBeLessThan(EQUITY_BANDS[band]!);
      expect(band === 0 || eq >= EQUITY_BANDS[band - 1]!).toBe(true);
      expect(p.choices![p.answer]).toBeDefined();
    }
  }, 60_000);

  it('lists every drill', () => {
    expect(MATH_DRILLS.map((d) => d.id).sort()).toEqual(['bluff', 'combos', 'equity', 'mdf', 'outs', 'potodds']);
  });
});
