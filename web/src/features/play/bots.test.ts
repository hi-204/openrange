// Bots: chart moves follow the chart, rule moves are legal, and whole bot-only hands finish.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateHand, initSync } from '../../../public/wasm/solver_wasm.js';
import type { ChartFile } from '../../lib/provenance/types';
import { mulberry32 } from '../trainer/preflop/deal';
import { chartMove, ruleMove, toHand } from './bots';
import { act, legal, needsShowdown, newHand, settle } from './engine';

initSync({ module: readFileSync(fileURLToPath(new URL('../../../public/wasm/solver_wasm_bg.wasm', import.meta.url))) });
const load = (f: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../public/data/charts/${f}`, import.meta.url)), 'utf8')) as ChartFile;
const docs = new Map(['cash-6max-100bb.json', 'pushfold-hu.json'].map((f) => [f, load(f)]));
const strength = (cards: string) => (JSON.parse(evaluateHand(cards)) as { strength: number }).strength;
// A crude stand-in for the sampled equity: hand strength rank scaled to 0–1.
const fakeEquity = async (cards: string, board: string) => (board ? Math.min(1, strength(cards + board) / 7462) : cards[0] === 'A' ? 0.65 : 0.45);

describe('play bots', () => {
  it('UTG first in at 100 bb plays from the chart: AA always raises to 2.5', () => {
    for (let seed = 1; seed < 2000; seed++) {
      const s = newHand({ names: ['a', 'b', 'c', 'd', 'e', 'f'], stacks: new Array(6).fill(100), hero: 0, button: 0, seed });
      const utg = s.seats[s.toAct!]!;
      if (utg.cards.map((c) => c[0]).join('') !== 'AA') continue;
      const m = chartMove(s, docs, mulberry32(seed))!;
      expect(m).toMatchObject({ source: 'chart', detail: 'first-in-UTG', move: { kind: 'raise', to: 2.5 } });
      return;
    }
    throw new Error('no AA dealt to UTG');
  });

  it('spots outside the chart tree get no chart move (e.g. after a limp)', () => {
    let s = newHand({ names: ['a', 'b', 'c', 'd', 'e', 'f'], stacks: new Array(6).fill(100), hero: 0, button: 0, seed: 7 });
    s = act(s, { kind: 'call' }); // UTG limps
    expect(chartMove(s, docs, mulberry32(1))).toBeNull();
    expect(toHand(s).actions.at(-1)!.kind).toBe('call');
  });

  it('bot-only hands always finish with legal moves and conserved chips', async () => {
    const rnd = mulberry32(5);
    for (let h = 0; h < 60; h++) {
      const n = h % 2 ? 6 : 2;
      let s = newHand({ names: Array.from({ length: n }, (_, i) => `b${i}`), stacks: new Array(n).fill(h % 3 ? 100 : 15), hero: -1, button: h % n, seed: 100 + h });
      const start = s.seats.reduce((a, p) => a + p.stack, 0) + s.contributed.reduce((a, b) => a + b, 0);
      for (let guard = 0; guard < 100 && s.toAct !== null; guard++) {
        const m = chartMove(s, docs, rnd) ?? (await ruleMove(s, fakeEquity, rnd));
        const l = legal(s);
        if (m.move.kind === 'fold') expect(l.fold).toBe(true);
        if (m.move.kind === 'check') expect(l.check).toBe(true);
        s = act(s, m.move);
      }
      if (needsShowdown(s)) s = settle(s, strength);
      expect(s.done).toBe(true);
      expect(Math.abs(s.seats.reduce((a, p) => a + p.stack, 0) - start)).toBeLessThan(1e-6);
    }
  });
});
