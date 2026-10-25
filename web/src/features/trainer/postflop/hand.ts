// "Drill this spot": play one hand through a solved tree (D-051). The hero answers at every
// own decision; the opponent plays the solved strategy with its actual cards; turn and river
// cards are dealt from the real deck and mapped onto the solver's representatives (suits.ts).

import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { Frame } from './suits';

export type NodeSource = (path: number[]) => Promise<SolverNode>;
export type ActionNode = Extract<SolverNode, { kind: 'action' }>;

export type Step =
  | { kind: 'action'; who: 'hero' | 'villain'; label: string; street: string }
  | { kind: 'deal'; card: string; street: string };

const RANKS = 'AKQJT98765432';
export const DECK = [...RANKS].flatMap((r) => ['s', 'h', 'd', 'c'].map((s) => r + s));

const cardsOf = (combo: string) => [combo.slice(0, 2), combo.slice(2, 4)];
const disjoint = (a: string, b: string) => !cardsOf(a).some((c) => b.includes(c));

function weighted(weights: number[], rnd: () => number): number {
  const total = weights.reduce((s, w) => s + w, 0);
  if (!(total > 0)) throw new Error('nothing to choose from');
  let x = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]!;
    if (x < 0 && weights[i]! > 0) return i;
  }
  return weights.findLastIndex((w) => w > 0);
}

/** Below this share of its starting weight, the hero's hand is off the solution's path. */
export const OFF_PATH_REACH = 0.01;

export class PostflopHand {
  readonly frame: Frame;
  path: number[] = [];
  /** Real board cards (starting board plus dealt cards). */
  board: string[];
  steps: Step[] = [];

  private constructor(
    readonly info: SolverInfo,
    readonly heroSeat: 0 | 1,
    readonly hero: string,
    readonly villain: string,
    private readonly startWeights: [number[], number[]],
    private readonly rnd: () => number,
  ) {
    this.board = info.spot.board.match(/\S{2}/g) ?? [];
    this.frame = new Frame(this.board, [
      { hands: info.hands[0], weights: startWeights[0] },
      { hands: info.hands[1], weights: startWeights[1] },
    ]);
  }

  /** Deal both hands with probability ∝ weight(hero) × weight(villain), never overlapping. */
  static deal(info: SolverInfo, root: SolverNode, heroSeat: 0 | 1, rnd: () => number): PostflopHand {
    const vSeat = (1 - heroSeat) as 0 | 1;
    const [hh, vh] = [info.hands[heroSeat], info.hands[vSeat]];
    const [hw, vw] = [root.reach[heroSeat], root.reach[vSeat]];
    const compat = hh.map((h, i) => (hw[i]! > 0 ? hw[i]! * vh.reduce((s, v, j) => s + (disjoint(h, v) ? vw[j]! : 0), 0) : 0));
    const hero = hh[weighted(compat, rnd)]!;
    const villain = vh[weighted(vw.map((w, j) => (disjoint(hero, vh[j]!) ? w : 0)), rnd)]!;
    const start: [number[], number[]] = [root.reach[0], root.reach[1]];
    return new PostflopHand(info, heroSeat, hero, villain, start, rnd);
  }

  heroIndex(): number {
    const i = this.frame.handIndex(this.heroSeat, this.hero);
    if (i === undefined) throw new Error(`hand ${this.hero} is not in the solved range`);
    return i;
  }

  /** The hero's reach at a node as a share of its starting weight (1 = always gets here). */
  heroReachShare(node: SolverNode): number {
    const i = this.heroIndex();
    const start = this.startWeights[this.heroSeat][i]!;
    return start > 0 ? node.reach[this.heroSeat][i]! / start : 0;
  }

  /** Play the opponent and the deck until the hero must act or the hand ends. */
  async advance(source: NodeSource): Promise<{ kind: 'hero'; node: ActionNode } | { kind: 'end'; node: SolverNode }> {
    for (;;) {
      const node = await source(this.path);
      if (node.kind === 'action') {
        if (node.player === this.heroSeat) return { kind: 'hero', node };
        const vi = this.frame.handIndex(node.player, this.villain);
        if (vi === undefined) throw new Error(`hand ${this.villain} is not in the solved range`);
        const n = this.info.hands[node.player].length;
        const a = weighted(node.actions.map((_, k) => node.strategy[k * n + vi]!), this.rnd);
        this.steps.push({ kind: 'action', who: 'villain', label: node.actions[a]!, street: node.street });
        this.path = [...this.path, a];
        continue;
      }
      if (node.kind === 'chance') {
        const used = new Set([...this.board, ...cardsOf(this.hero), ...cardsOf(this.villain)]);
        const live = DECK.filter((c) => !used.has(c));
        const real = live[Math.floor(this.rnd() * live.length)]!;
        const k = this.frame.deal(real, node.board, node.cards, node.mirrors);
        this.board = [...this.board, real];
        this.steps.push({ kind: 'deal', card: real, street: node.street });
        this.path = [...this.path, k];
        continue;
      }
      return { kind: 'end', node };
    }
  }

  /** Record the hero's action and move on. */
  play(node: ActionNode, action: number) {
    this.steps.push({ kind: 'action', who: 'hero', label: node.actions[action]!, street: node.street });
    this.path = [...this.path, action];
  }
}
