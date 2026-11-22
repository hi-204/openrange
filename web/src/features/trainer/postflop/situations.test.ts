// Facing-aggression situations (D-089): every line resolves on its solved spot, ends at the
// hero's decision, and dealt hands come from the ranges that actually reach it.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, Solver } from '../../../../public/wasm/solver_wasm.js';
import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { mulberry32 } from '../preflop/deal';
import { PostflopHand } from './hand';
import { DRILL_SPOTS, matchStep, SITUATIONS, situationPath } from './spots';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

describe('facing-aggression situations', () => {
  it('match bet sizes by size, not by position in the list', () => {
    const actions = ['Check', 'Bet 15', 'Bet 3.3', 'Bet 7.5'];
    expect(matchStep(actions, 'bet-small')).toBe(2);
    expect(matchStep(actions, 'bet-mid')).toBe(3);
    expect(matchStep(actions, 'bet-large')).toBe(1);
    expect(matchStep(actions, 'check')).toBe(0);
    expect(matchStep(actions, 'raise')).toBe(-1);
  });

  // The flop spot takes long to solve; its line is checked on the tree only (a few iterations).
  for (const spotId of [...new Set(SITUATIONS.map((x) => x.spot))]) {
    it(`resolve and deal on ${spotId}`, async () => {
      const drill = DRILL_SPOTS.find((d) => d.id === spotId)!;
      const s = new Solver(JSON.stringify(drill.spot), 1.5e9, false);
      s.step(drill.street === 'flop' ? 5 : 100);
      const info = JSON.parse(s.info()) as SolverInfo;
      const source = async (path: number[]) => JSON.parse(s.node(JSON.stringify(path))) as SolverNode;
      for (const sit of SITUATIONS.filter((x) => x.spot === spotId)) {
        const path = await situationPath(sit.line, source);
        expect(path).toHaveLength(sit.line.length);
        const node = await source(path);
        expect(node.kind).toBe('action');
        if (node.kind !== 'action') continue;
        expect(node.player).toBe(sit.hero);
        // The last action really is the kind the situation names.
        const prev = await source(path.slice(0, -1));
        const label = prev.kind === 'action' ? prev.actions[path.at(-1)!]! : '';
        expect(label).toMatch(sit.line.at(-1) === 'raise' ? /^raise/i : sit.line.at(-1) === 'check' ? /^check/i : /^bet/i);
        const rnd = mulberry32(9);
        for (let i = 0; i < 20; i++) {
          const h = await PostflopHand.dealAt(info, source, path, sit.hero, rnd);
          expect([h.hero.slice(0, 2), h.hero.slice(2)].some((c) => h.villain.includes(c))).toBe(false);
          const hi = info.hands[sit.hero]!.indexOf(h.hero);
          const vi = info.hands[1 - sit.hero]!.indexOf(h.villain);
          expect(node.reach[sit.hero]![hi]!).toBeGreaterThan(0);
          expect(node.reach[1 - sit.hero]![vi]!).toBeGreaterThan(0);
          expect(h.path).toEqual(path);
          expect(h.steps.map((x) => (x.kind === 'action' ? x.label : ''))).toHaveLength(path.length);
          const r = await h.advance(source);
          expect(r.kind).toBe('hero');
        }
      }
      s.free();
    }, 300_000);
  }
});
