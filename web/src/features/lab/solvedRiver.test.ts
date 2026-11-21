// The solved-spot numbers in the Math Lab, recomputed independently on the river preset solved by
// the WASM engine (D-087): defence from the raw strategies, bluff share from hand strengths.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { equity as wasmEquity, evaluateHand, initSync, Solver } from '../../../public/wasm/solver_wasm.js';
import type { EquityResult, SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../solver/spotForm';
import { mulberry32 } from '../trainer/preflop/deal';
import { sizeRows, sizingProblem, type NodeSource } from './solvedRiver';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

describe('Math Lab on the solved river preset', () => {
  const s = new Solver(JSON.stringify(toSpot(PRESETS.river)), 1.5e9, false);
  for (let i = 0; i < 40 && JSON.parse(s.exploitability()).pctPot > 0.3; i++) s.step(50);
  const info = JSON.parse(s.info()) as SolverInfo;
  const source: NodeSource = async (path) => JSON.parse(s.node(JSON.stringify(path))) as SolverNode;
  const equity = async (req: unknown) => JSON.parse(wasmEquity(JSON.stringify(req))) as EquityResult;

  it('defence, MDF and bluff share agree with an independent recomputation', async () => {
    const rootNode = (await source([])) as SolverNode & { kind: 'action' };
    const check = rootNode.actions.findIndex((a) => /^check/i.test(a));
    for (const path of [[], [check]]) {
      const node = (await source(path)) as SolverNode & { kind: 'action' };
      const rows = await sizeRows(info, source, equity, path);
      expect(rows.length).toBe(node.aggressive.filter(Boolean).length);
      const bettor = node.player;
      const defender = 1 - bettor;
      const [nb, nd] = [info.hands[bettor]!.length, info.hands[defender]!.length];
      const strength = (combo: string) => JSON.parse(evaluateHand(combo + node.board.join(''))).strength as number;
      const sb = info.hands[bettor]!.map(strength);
      const sd = info.hands[defender]!.map(strength);
      let k = 0;
      for (let a = 0; a < node.actions.length; a++) {
        if (!node.aggressive[a]) continue;
        const row = rows[k++]!;
        const facing = (await source([...path, a])) as SolverNode & { kind: 'action' };
        expect(row.mdf).toBeCloseTo(row.pot / (row.pot + row.bet), 12);
        expect(row.bluffTheory).toBeCloseTo(row.bet / (row.pot + 2 * row.bet), 12);
        const fold = facing.actions.findIndex((x) => /^fold/i.test(x));
        const cont = facing.reach[defender]!.map((r, h) => r * (1 - facing.strategy[fold * nd + h]!));
        expect(row.defend).toBeCloseTo(cont.reduce((x, y) => x + y, 0) / facing.reach[defender]!.reduce((x, y) => x + y, 0), 9);
        // Bluff share from raw strengths: a betting combo's equity against the continuing range,
        // skipping defender combos that share a card with it.
        const betting = node.reach[bettor]!.map((r, h) => r * node.strategy[a * nb + h]!);
        let bluff = 0;
        let total = 0;
        for (let h = 0; h < nb; h++) {
          if (betting[h]! <= 1e-6) continue;
          const mine = info.hands[bettor]![h]!;
          let win = 0;
          let w = 0;
          for (let j = 0; j < nd; j++) {
            const theirs = info.hands[defender]![j]!;
            if (cont[j]! <= 1e-6 || [mine.slice(0, 2), mine.slice(2)].some((c) => theirs.includes(c))) continue;
            w += cont[j]!;
            win += cont[j]! * (sb[h]! > sd[j]! ? 1 : sb[h] === sd[j] ? 0.5 : 0);
          }
          if (w <= 0) continue;
          total += betting[h]!;
          if (win / w < 0.5) bluff += betting[h]!;
        }
        if (row.bluffShare !== null) expect(row.bluffShare).toBeCloseTo(bluff / total, 3);
      }
    }
  }, 300_000);

  it('the sizing trainer reads the hand’s EVs and mix from the node', async () => {
    const rnd = mulberry32(4);
    for (let i = 0; i < 20; i++) {
      const p = await sizingProblem(info, source, [], rnd);
      const node = (await source([])) as SolverNode & { kind: 'action' };
      const n = info.hands[node.player]!.length;
      const h = info.hands[node.player]!.indexOf(p.hand);
      expect(node.reach[node.player]![h]!).toBeGreaterThan(1e-6);
      p.actions.forEach((_, a) => {
        expect(p.ev[a]).toBe(node.evBb[a * n + h]);
        expect(p.strategy[a]).toBe(node.strategy[a * n + h]);
      });
      expect(p.strategy.reduce((x, y) => x + y, 0)).toBeCloseTo(1, 5);
    }
  });
});
