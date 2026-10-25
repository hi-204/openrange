// Map real cards onto the solver's suit-isomorphic representatives (D-051).
//
// With isomorphism the solver keeps one representative card per group of equivalent turn or
// river cards. A real card that is a "mirror" is played in the representative's frame: we find
// a suit permutation τ that maps it to the representative and is a symmetry of the game there
// (it fixes the starting board, the current board and both ranges, exactly the solver's rule),
// and from then on view every card through σ = τ ∘ σ.

export const SUITS = ['c', 'd', 'h', 's'] as const;
export type Perm = Record<string, string>;

function permutations<T>(xs: readonly T[]): T[][] {
  if (xs.length <= 1) return [[...xs]];
  return xs.flatMap((x, i) => permutations([...xs.slice(0, i), ...xs.slice(i + 1)]).map((p) => [x, ...p]));
}

export const ALL_PERMS: Perm[] = permutations(SUITS).map((img) => Object.fromEntries(SUITS.map((s, i) => [s, img[i]!])));
export const IDENTITY: Perm = ALL_PERMS[0]!;

export const permCard = (p: Perm, card: string) => card[0]! + p[card[1]!]!;
export const permCombo = (p: Perm, combo: string) => permCard(p, combo.slice(0, 2)) + permCard(p, combo.slice(2, 4));
/** (τ ∘ σ)(x) = τ(σ(x)). */
export const compose = (tau: Perm, sigma: Perm): Perm => Object.fromEntries(SUITS.map((s) => [s, tau[sigma[s]!]!]));

/** Order-free key for a two-card combo. */
export const comboKey = (combo: string) => [combo.slice(0, 2), combo.slice(2, 4)].sort().join('');

const fixesSet = (p: Perm, cards: string[]) => {
  const set = new Set(cards);
  return cards.every((c) => set.has(permCard(p, c)));
};

export type RangeSide = { hands: string[]; weights: number[] };

export class Frame {
  /** Real suit → suit in the solver's frame. */
  sigma: Perm = IDENTITY;
  private readonly symmetries: Perm[];
  private readonly index: Map<string, number>[];

  constructor(
    private readonly startBoard: string[],
    sides: [RangeSide, RangeSide],
  ) {
    this.index = sides.map((s) => new Map(s.hands.map((h, i) => [comboKey(h), i])));
    // Symmetries of the whole game: fix the starting board and both starting ranges.
    this.symmetries = ALL_PERMS.filter(
      (p) =>
        fixesSet(p, startBoard) &&
        sides.every((s, q) =>
          s.hands.every((h, i) => {
            const j = this.index[q]!.get(comboKey(permCombo(p, h)));
            return j !== undefined && Math.abs(s.weights[j]! - s.weights[i]!) < 1e-6;
          }),
        ),
    );
  }

  card(real: string): string {
    return permCard(this.sigma, real);
  }

  /** Index of a real combo in the player's hand list, viewed in the current frame. */
  handIndex(player: 0 | 1, realCombo: string): number | undefined {
    return this.index[player]!.get(comboKey(permCombo(this.sigma, realCombo)));
  }

  /**
   * Deal a real card at a chance node whose representatives are `cards` (with `mirrors`) on
   * the frame board `frameBoard`. Returns the child index and updates σ if the card is a mirror.
   */
  deal(real: string, frameBoard: string[], cards: string[], mirrors: string[][]): number {
    const x = this.card(real);
    const direct = cards.indexOf(x);
    if (direct >= 0) return direct;
    const k = mirrors.findIndex((m) => m.includes(x));
    if (k < 0) throw new Error(`card ${real} (${x} in the solver's frame) is not dealt at this node`);
    const rep = cards[k]!;
    const tau = this.symmetries.find((p) => fixesSet(p, frameBoard) && permCard(p, x) === rep);
    if (!tau) throw new Error(`no symmetry maps ${x} to ${rep}; the ranges may not be suit-symmetric`);
    this.sigma = compose(tau, this.sigma);
    return k;
  }

  /** The solver merges cards only through these; a drill needs at least the identity. */
  get symmetryCount(): number {
    return this.symmetries.length;
  }

  /** Starting board (real cards), for display. */
  get board(): string[] {
    return this.startBoard;
  }
}
