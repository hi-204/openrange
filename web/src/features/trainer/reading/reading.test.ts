// Hand reading (D-089): the target range is recomputed from raw node data, and the score
// behaves as defined (perfect answer, empty answer, impossible classes).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, Solver } from '../../../../public/wasm/solver_wasm.js';
import { cellOf } from '../../../lib/poker/hands';
import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { DRILL_SPOTS, situationPath } from '../postflop/spots';
import { READING_TASKS, readingTarget, scoreReading } from './reading';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });

describe('hand-reading drill', () => {
  for (const spotId of [...new Set(READING_TASKS.map((x) => x.spot))]) {
    it(`targets on ${spotId} match the raw strategies`, async () => {
      const drill = DRILL_SPOTS.find((d) => d.id === spotId)!;
      const s = new Solver(JSON.stringify(drill.spot), 1.5e9, false);
      s.step(150);
      const info = JSON.parse(s.info()) as SolverInfo;
      const source = async (path: number[]) => JSON.parse(s.node(JSON.stringify(path))) as SolverNode;
      for (const task of READING_TASKS.filter((x) => x.spot === spotId)) {
        const target = await readingTarget(info, source, task.line);
        const full = await situationPath(task.line, source);
        const node = (await source(full.slice(0, -1))) as SolverNode & { kind: 'action' };
        const a = full.at(-1)!;
        expect(target.actor).toBe(node.player);
        // Recompute one class's frequency directly.
        const hands = info.hands[node.player]!;
        const n = hands.length;
        const c = target.weight.findIndex((w) => w > 0.5);
        let r = 0;
        let act = 0;
        hands.forEach((h, j) => {
          if (cellOf(h).index !== c) return;
          r += node.reach[node.player]![j]!;
          act += node.reach[node.player]![j]! * node.strategy[a * n + j]!;
        });
        expect(target.weight[c]).toBeCloseTo(r, 9);
        expect(target.frequency[c]).toBeCloseTo(act / r, 9);
        // Perfect answer (classes taking the action at least half the time): only mixed cells cost.
        const best = target.frequency.map((f) => f >= 0.5);
        const sc = scoreReading(target, best);
        expect(sc.impossible).toEqual([]);
        expect(sc.missedHands).toEqual([]);
        expect(sc.extraHands).toEqual([]);
        // Empty answer: recall 0 if anything takes the action.
        const empty = scoreReading(target, target.frequency.map(() => false));
        if (empty.missed > 0) expect(empty.recall).toBe(0);
        // A class that never reaches the decision is reported as impossible.
        const z = target.weight.findIndex((w) => w <= 1e-9);
        if (z >= 0) expect(scoreReading(target, target.weight.map((_, i) => i === z)).impossible).toHaveLength(1);
      }
      s.free();
    }, 300_000);
  }
});
