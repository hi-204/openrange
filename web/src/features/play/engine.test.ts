// Game engine: dealing, blinds, min-raises, the full-raise rule, side pots, showdowns, and
// chip conservation over many random hands.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { evaluateHand, initSync } from '../../../public/wasm/solver_wasm.js';
import { mulberry32 } from '../trainer/preflop/deal';
import { act, legal, needsShowdown, newHand, settle, shuffled, type GameState } from './engine';

initSync({ module: readFileSync(fileURLToPath(new URL('../../../public/wasm/solver_wasm_bg.wasm', import.meta.url))) });
const strength = (cards: string) => (JSON.parse(evaluateHand(cards)) as { strength: number }).strength;
const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const total = (s: GameState) => s.seats.reduce((a, p) => a + p.stack, 0) + s.contributed.reduce((a, b) => a + b, 0) - s.collected.reduce((a, b) => a + b, 0);

describe('play engine', () => {
  it('deals two cards each from a seeded deck and posts the blinds', () => {
    const s = newHand({ names: names(6), stacks: new Array(6).fill(100), hero: 0, button: 0, seed: 1 });
    expect(new Set([...s.seats.flatMap((p) => p.cards), ...s.deck]).size).toBe(52);
    expect(s.seats.map((p) => p.position)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO']);
    expect(s.bets).toEqual([0, 0.5, 1, 0, 0, 0]);
    expect(s.toAct).toBe(3); // UTG
    expect(shuffled(1)).toEqual(shuffled(1));
  });

  it('heads-up: the button is the small blind and acts first preflop, last after', () => {
    let s = newHand({ names: names(2), stacks: [100, 100], hero: 0, button: 0, seed: 2 });
    expect(s.seats.map((p) => p.position)).toEqual(['BTN', 'BB']);
    expect(s.bets).toEqual([0.5, 1]);
    expect(s.toAct).toBe(0);
    s = act(s, { kind: 'call' });
    expect(s.toAct).toBe(1); // the big blind's option
    expect(legal(s)).toMatchObject({ check: true, minTo: 2 });
    s = act(s, { kind: 'check' });
    expect(s.street).toBe('flop');
    expect(s.board).toHaveLength(3);
    expect(s.toAct).toBe(1); // BB first after the flop
  });

  it('minimum raise is the last full raise; a short all-in does not reopen the betting', () => {
    let s = newHand({ names: names(3), stacks: [100, 100, 6], hero: 0, button: 0, seed: 3 });
    // BTN raises to 3 (raise of 2), SB re-raises to 5 (raise of 2): the next minimum is 7.
    s = act(s, { kind: 'raise', to: 3 });
    expect(legal(s).minTo).toBe(5);
    s = act(s, { kind: 'raise', to: 5 });
    expect(legal(s).minTo).toBe(6); // BB has only 6: all-in is the most it can do
    s = act(s, { kind: 'raise', to: 6 }); // short all-in (+1)
    // The small blind's full raise reopened the betting for the button: it may raise again,
    // by at least the last full raise (2), so to 8.
    expect(s.toAct).toBe(0);
    expect(legal(s)).toMatchObject({ call: 3, minTo: 8 });
    s = act(s, { kind: 'call' });
    // The small blind acted after the last full raise: the short all-in only has to be called.
    expect(s.toAct).toBe(1);
    expect(legal(s)).toMatchObject({ call: 1, minTo: null });
  });

  it('a folded hand wins nothing; an uncalled bet goes back', () => {
    let s = newHand({ names: names(3), stacks: [100, 100, 100], hero: 0, button: 0, seed: 4 });
    s = act(s, { kind: 'raise', to: 3 });
    s = act(s, { kind: 'fold' });
    s = act(s, { kind: 'fold' });
    expect(s.done).toBe(true);
    // The uncalled 2 bb go back first; the button then collects the 2.5 bb pot, as hand
    // histories report it.
    expect(s.collected[0]).toBe(2.5);
    expect(s.seats[0]!.stack).toBe(101.5);
    expect(s.history.find((a) => a.kind === 'raise')!.amount).toBe(1);
  });

  it('side pots: a short all-in can only win what it covered', () => {
    // Three players all in for 10, 30 and 30; pick a deal where the short stack has the best hand.
    for (let seed = 1; seed < 400; seed++) {
      let s = newHand({ names: names(3), stacks: [10, 30, 30], hero: 0, button: 0, seed });
      s = act(s, { kind: 'raise', to: 10 });
      s = act(s, { kind: 'raise', to: 30 });
      s = act(s, { kind: 'call' });
      expect(needsShowdown(s)).toBe(true);
      const v = s.seats.map((p) => strength(p.cards.join('') + s.board.join('')));
      if (!(v[0]! > v[1]! && v[0]! > v[2]! && v[1] !== v[2])) continue;
      const done = settle(s, strength);
      expect(done.collected[0]).toBe(30); // 10 from each
      const second = v[1]! > v[2]! ? 1 : 2;
      expect(done.collected[second]).toBe(40); // the side pot: 20 + 20
      return;
    }
    throw new Error('no suitable deal found');
  });

  it('random hands conserve chips and always end', () => {
    const rnd = mulberry32(9);
    for (let h = 0; h < 300; h++) {
      const n = 2 + Math.floor(rnd() * 5);
      let s = newHand({ names: names(n), stacks: names(n).map(() => 5 + Math.floor(rnd() * 200)), hero: 0, button: h % n, seed: h + 1, ante: h % 3 === 0 ? 0.1 : 0 });
      const start = total(s);
      for (let guard = 0; guard < 200 && s.toAct !== null; guard++) {
        const l = legal(s);
        const r = rnd();
        const move = l.minTo !== null && r < 0.2 ? { kind: 'raise' as const, to: l.minTo + rnd() * (l.maxTo! - l.minTo) } : l.call !== null ? (r < 0.7 ? { kind: 'call' as const } : { kind: 'fold' as const }) : { kind: 'check' as const };
        s = act(s, move);
      }
      if (needsShowdown(s)) s = settle(s, strength);
      expect(s.done).toBe(true);
      expect(Math.abs(total(s) - start)).toBeLessThan(1e-6);
      expect(Math.abs(s.seats.reduce((a, p) => a + p.stack, 0) - start)).toBeLessThan(1e-6); // nothing lost without rake
    }
  });

  it('rake: no flop, no drop; otherwise a share of the pot up to the cap', () => {
    let s = newHand({ names: names(2), stacks: [100, 100], hero: 0, button: 0, seed: 5, rake: { percent: 5, capBb: 3 } });
    s = act(s, { kind: 'raise', to: 3 });
    s = act(s, { kind: 'fold' });
    expect(s.rakeTaken).toBe(0);
    let t = newHand({ names: names(2), stacks: [100, 100], hero: 0, button: 0, seed: 5, rake: { percent: 5, capBb: 3 } });
    t = act(t, { kind: 'raise', to: 100 });
    t = act(t, { kind: 'call' });
    t = settle(t, strength);
    expect(t.rakeTaken).toBe(3); // 5% of 200 is 10, capped at 3
    expect(t.collected.reduce((a, b) => a + b, 0)).toBeCloseTo(197, 9);
  });
});
