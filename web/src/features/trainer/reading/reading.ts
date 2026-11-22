// Hand-reading drill (D-089): after an opponent's action in a solved spot, paint the hands they
// take it with, then compare with the solution. Pure functions over solver nodes.

import { cellName, cellOf } from '../../../lib/poker/hands';
import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { matchStep, type LineStep } from '../postflop/spots';

export type ReadingTask = { id: string; spot: string; line: LineStep[] };

/** Lines through a street of the turn and river drill spots; the last step is the opponent's action to read. */
export const READING_TASKS: ReadingTask[] = [
  { id: 'river-bet-mid', spot: 'river-qj742', line: ['bet-mid'] },
  { id: 'river-bet-large', spot: 'river-qj742', line: ['bet-large'] },
  { id: 'river-ip-bet', spot: 'river-qj742', line: ['check', 'bet-mid'] },
  { id: 'river-checkraise', spot: 'river-qj742', line: ['check', 'bet-mid', 'raise'] },
  { id: 'river-bet-mid', spot: 'river-k9472', line: ['bet-mid'] },
  { id: 'river-ip-bet', spot: 'river-k9472', line: ['check', 'bet-mid'] },
  { id: 'turn-lead', spot: 'turn-qj74', line: ['bet-small'] },
  { id: 'turn-ip-bet', spot: 'turn-kt63', line: ['check', 'bet-large'] },
];

const NAMES = Array.from({ length: 169 }, (_, i) => cellName(i));
type Node = (path: number[]) => Promise<SolverNode>;

export type ReadingTarget = {
  /** The player whose action is read. */
  actor: 0 | 1;
  /** Action labels along the line, and who took each, for the prompt. */
  labels: string[];
  who: (0 | 1)[];
  board: string[];
  /** Per class (grid order): how often the class takes the action when it reaches the decision. */
  frequency: number[];
  /** Per class: combos of it that reach the decision (reach-weighted). */
  weight: number[];
};

/** The decision before the last step, and the per-class frequency of that last action. */
export async function readingTarget(info: SolverInfo, source: Node, line: LineStep[]): Promise<ReadingTarget> {
  const path: number[] = [];
  const labels: string[] = [];
  const who: (0 | 1)[] = [];
  let node = await source([]);
  for (let i = 0; i < line.length; i++) {
    if (node.kind !== 'action') throw new Error('the line crosses a card or ends the hand');
    const k = matchStep(node.actions, line[i]!);
    if (k < 0) throw new Error(`this spot has no "${line[i]}" here`);
    labels.push(node.actions[k]!);
    who.push(node.player);
    if (i === line.length - 1) {
      const dec = node;
      const actor = dec.player;
      const hands = info.hands[actor];
      const n = hands.length;
      const reach = new Array(169).fill(0);
      const act = new Array(169).fill(0);
      hands.forEach((h, j) => {
        const c = cellOf(h).index;
        reach[c] += dec.reach[actor][j]!;
        act[c] += dec.reach[actor][j]! * dec.strategy[k * n + j]!;
      });
      return { actor, labels, who, board: dec.board, frequency: reach.map((r, c) => (r > 1e-9 ? act[c] / r : 0)), weight: reach };
    }
    path.push(k);
    node = await source(path);
  }
  throw new Error('empty line');
}

export type ReadingScore = {
  /** Reach-weighted combos of the action range that the answer includes. */
  hit: number;
  missed: number;
  /** Combos included that reach the decision but don't take the action. */
  extra: number;
  /** Share of the action range covered and share of the answer that is right. */
  recall: number;
  precision: number;
  missedHands: string[];
  extraHands: string[];
  /** Classes picked that never reach this decision (not in the range at all). */
  impossible: string[];
};

/** Score a painted answer against the action range, weighting classes by the combos that reach the decision. */
export function scoreReading(target: ReadingTarget, picked: boolean[]): ReadingScore {
  let hit = 0;
  let missed = 0;
  let extra = 0;
  const miss: { n: string; w: number }[] = [];
  const add: { n: string; w: number }[] = [];
  const impossible: string[] = [];
  NAMES.forEach((n, i) => {
    const w = target.weight[i]!;
    const f = target.frequency[i]!;
    if (w <= 1e-9) {
      if (picked[i]) impossible.push(n);
      return;
    }
    if (picked[i]) {
      hit += w * f;
      extra += w * (1 - f);
      if (f < 0.5) add.push({ n, w: w * (1 - f) });
    } else {
      missed += w * f;
      if (f >= 0.5) miss.push({ n, w: w * f });
    }
  });
  const byW = (a: { w: number }, b: { w: number }) => b.w - a.w;
  return {
    hit,
    missed,
    extra,
    recall: hit + missed > 0 ? hit / (hit + missed) : 1,
    precision: hit + extra > 0 ? hit / (hit + extra) : 0,
    missedHands: miss.sort(byW).map((x) => x.n),
    extraHands: add.sort(byW).map((x) => x.n),
    impossible,
  };
}
