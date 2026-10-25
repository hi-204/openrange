// The postflop drill must read the solver's numbers for the hand actually dealt. With suit
// isomorphism a dealt card can be a "mirror" of a representative; the mapped lookup must give
// the same EVs as a solve without isomorphism that deals the card directly.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, Solver } from '../../../../public/wasm/solver_wasm.js';
import type { SolverInfo, SolverNode, SpotJson } from '../../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../../solver/spotForm';
import { mulberry32 } from '../preflop/deal';
import { DECK, PostflopHand, type NodeSource } from './hand';
import { comboKey, Frame } from './suits';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

function solve(spot: SpotJson, iterations: number) {
  const s = new Solver(JSON.stringify(spot), 1e9, false);
  s.step(iterations);
  const info = JSON.parse(s.info()) as SolverInfo;
  const source: NodeSource = async (path) => JSON.parse(s.node(JSON.stringify(path))) as SolverNode;
  return { s, info, source };
}

// Hearts and spades on the board; clubs and diamonds are interchangeable for class ranges.
const turn: SpotJson = { ...toSpot(PRESETS.turn), board: 'Kh Th 6h 3s' };

describe('suit mapping', () => {
  it('maps mirrored river cards onto the representative with identical EVs', async () => {
    const iso = solve(turn, 40);
    const flat = solve({ ...turn, isomorphism: false }, 40);
    // Check, check → river chance node.
    const isoChance = await iso.source([0, 0]);
    const flatChance = await flat.source([0, 0]);
    if (isoChance.kind !== 'chance' || flatChance.kind !== 'chance') throw new Error('expected a chance node');
    const mirrored = isoChance.mirrors.flat();
    expect(mirrored.length).toBeGreaterThan(0);
    expect(flatChance.mirrors.flat()).toHaveLength(0);
    const isoRoot = await iso.source([]);
    let compared = 0;
    const perCard = new Map<string, number>();
    for (const card of mirrored) {
      const frame = new Frame(['Kh', 'Th', '6h', '3s'], [
        { hands: iso.info.hands[0], weights: isoRoot.reach[0] },
        { hands: iso.info.hands[1], weights: isoRoot.reach[1] },
      ]);
      const k = frame.deal(card, isoChance.board, isoChance.cards, isoChance.mirrors);
      const a = await iso.source([0, 0, k]);
      const b = await flat.source([0, 0, flatChance.cards.indexOf(card)]);
      if (a.kind !== 'action' || b.kind !== 'action') throw new Error('expected action nodes');
      const n = iso.info.hands[0].length;
      const m = flat.info.hands[0].length;
      const flatIndex = new Map(flat.info.hands[0].map((h, i) => [comboKey(h), i]));
      for (const h of flat.info.hands[0]) {
        if (h.includes(card)) continue;
        const i = frame.handIndex(0, h)!;
        const j = flatIndex.get(comboKey(h))!;
        for (let act = 0; act < a.actions.length; act++) {
          const x = a.evBb[act * n + i];
          const y = b.evBb[act * m + j];
          if (x === null || y === null || x === undefined || y === undefined) continue;
          expect(Math.abs(x - y), `${card} ${h} ${a.actions[act]}`).toBeLessThan(1e-3);
          compared++;
          perCard.set(card, (perCard.get(card) ?? 0) + 1);
        }
      }
    }
    // Every mirrored card was checked, each against many hands and actions.
    expect([...perCard.keys()].sort()).toEqual([...mirrored].sort());
    expect(Math.min(...perCard.values())).toBeGreaterThan(50);
    iso.s.free();
    flat.s.free();
  }, 120_000);
});

describe('playing a hand', () => {
  it('deals legal hands, reaches hero decisions and ends', async () => {
    const { s, info, source } = solve({ ...turn }, 40);
    const rootNode = await source([]);
    const rnd = mulberry32(5);
    let heroDecisions = 0;
    for (let g = 0; g < 60; g++) {
      const heroSeat = (g % 2) as 0 | 1;
      const hand = PostflopHand.deal(info, rootNode, heroSeat, rnd);
      const cards = [hand.hero.slice(0, 2), hand.hero.slice(2), hand.villain.slice(0, 2), hand.villain.slice(2), ...hand.board];
      expect(new Set(cards).size).toBe(cards.length);
      for (let guard = 0; guard < 20; guard++) {
        const r = await hand.advance(source);
        if (r.kind === 'end') break;
        heroDecisions++;
        expect(r.node.player).toBe(heroSeat);
        expect(hand.heroIndex()).toBeGreaterThanOrEqual(0);
        // Answer at random.
        hand.play(r.node, Math.floor(rnd() * r.node.actions.length));
      }
      expect(hand.board.every((c) => DECK.includes(c))).toBe(true);
      expect(new Set([...hand.board, hand.hero.slice(0, 2), hand.hero.slice(2), hand.villain.slice(0, 2), hand.villain.slice(2)]).size).toBe(hand.board.length + 4);
    }
    expect(heroDecisions).toBeGreaterThan(60);
    s.free();
  }, 120_000);
});
