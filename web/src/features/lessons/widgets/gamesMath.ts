// Pure maths behind the Level 5–6 widgets (D-074): the polarized river toy game, ICM bubble
// factors and bankroll variance. The widgets show these next to what the engine computes.

import type { SpotJson } from '../../../lib/wasm/protocol';
import { mulberry32 } from '../../trainer/preflop/deal';

// ---- Toy game ---------------------------------------------------------------------------
// River, board K♥9♦6♣3♠2♥. The bettor (out of position) holds a set of nines (value: 3 combos)
// or Q-J (air, weighted); the caller holds A-K, which beats Q-J and loses to the set. The
// bettor may check or bet B into P (all-in); the caller may only call or fold.

export const TOY_BOARD = 'Kh 9d 6c 3s 2h';
export const TOY_VALUE_COMBOS = 3;
const QJ_COMBOS = 16;

/** Air combos available for a given number of air hands per value hand (capped by the deck). */
export const toyAir = (airPerValue: number) => Math.min(QJ_COMBOS, airPerValue * TOY_VALUE_COMBOS);

export function toySpot(pot: number, betPct: number, airPerValue: number): SpotJson {
  const w = toyAir(airPerValue) / QJ_COMBOS;
  const bet = { bet: String(betPct), raise: '' };
  return {
    board: TOY_BOARD,
    pot,
    stack: (pot * betPct) / 100,
    ranges: { oop: w > 0 ? `99, QJ:${Number(w.toFixed(6))}` : '99', ip: 'AK' },
    sizes: { river: { oop: bet, ip: { bet: '', raise: '' } } },
    maxRaises: { river: 0 },
    allInThreshold: 0,
    rake: { percent: 0, capBb: 0 },
  };
}

export type ToyResult = {
  /** Share of the bettor's bets that are bluffs. */
  bluffShare: number;
  /** Share of the bettor's air that bets. */
  airBets: number;
  /** Share of value hands that bet. */
  valueBets: number;
  /** Caller's call frequency against the bet. */
  call: number;
  /** Bettor's average result per combo, in bb won from the pot (as the solver reports it). */
  evBettor: number;
};

/**
 * The equilibrium. With enough air, the bettor bluffs just enough to make the caller
 * indifferent (bluffs are B/(P+2B) of bets) and the caller calls P/(P+B) (the MDF) to make
 * bluffs indifferent. With too little air, every air hand bluffs and the caller folds.
 */
export function toyTheory(pot: number, bet: number, airPerValue: number): ToyResult {
  const V = TOY_VALUE_COMBOS;
  const A = toyAir(airPerValue);
  const needed = (V * bet) / (pot + bet);
  if (A >= needed && A > 0) {
    const call = pot / (pot + bet);
    return { bluffShare: needed / (V + needed), airBets: needed / A, valueBets: 1, call, evBettor: (V * (pot + call * bet)) / (V + A) };
  }
  return { bluffShare: A / (V + A), airBets: 1, valueBets: 1, call: 0, evBettor: pot };
}

/** The bettor's best response when the caller calls a fixed share `call` of the time. */
export function toyBestResponse(pot: number, bet: number, airPerValue: number, call: number) {
  const V = TOY_VALUE_COMBOS;
  const A = toyAir(airPerValue);
  const bluffEv = (1 - call) * pot - call * bet;
  const bluff = bluffEv > 1e-12 ? 'all' : bluffEv < -1e-12 ? 'none' : 'any';
  return { bluff, bluffEv, evBettor: (V * (pot + call * bet) + A * Math.max(0, bluffEv)) / (V + A) } as const;
}

// ---- ICM bubble factor ------------------------------------------------------------------

/**
 * Player `hero` calls an all-in from `villain` for the smaller of their stacks. Returns the
 * prize equity now, after winning and after losing, the bubble factor (what losing costs ÷
 * what winning gains) and the equity a call needs with no other money in the pot.
 */
export async function bubble(stacks: number[], hero: number, villain: number, icm: (s: number[]) => Promise<number[]>) {
  const at = Math.min(stacks[hero]!, stacks[villain]!);
  const move = (d: number) => stacks.map((s, i) => (i === hero ? s + d : i === villain ? s - d : s));
  const [now, win, lose] = await Promise.all([icm(stacks), icm(move(at)), icm(move(-at))]);
  const gain = win[hero]! - now[hero]!;
  const loss = now[hero]! - lose[hero]!;
  return { now: now[hero]!, win: win[hero]!, lose: lose[hero]!, factor: loss / gain, needed: loss / (gain + loss) };
}

// ---- Variance ---------------------------------------------------------------------------

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 erf, absolute error below 1.5e-7). */
export function normalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

export type VarianceInput = { winrate: number; sd: number; hands: number; bankroll?: number };

/** Results over `hands` hands for a win rate and standard deviation, both in bb per 100 hands. */
export function varianceStats({ winrate, sd, hands, bankroll }: VarianceInput) {
  const blocks = hands / 100;
  const mean = winrate * blocks;
  const spread = sd * Math.sqrt(blocks);
  return {
    mean,
    spread,
    low: mean - 1.96 * spread,
    high: mean + 1.96 * spread,
    /** Chance of being behind after `hands` hands. */
    behind: normalCdf(-mean / spread),
    /** Chance of ever losing `bankroll` bb from the start (risk of ruin), for a positive win rate. */
    ruin: bankroll === undefined ? null : winrate <= 0 ? 1 : Math.exp((-2 * winrate * bankroll) / (sd * sd)),
  };
}

/** Seeded random walks in blocks of 100 hands: `paths` arrays of cumulative bb, `points` long. */
export function simulate({ winrate, sd, hands }: VarianceInput, paths: number, points: number, seed: number): number[][] {
  const rnd = mulberry32(seed);
  const blocks = Math.max(1, Math.round(hands / 100));
  const every = Math.max(1, Math.floor(blocks / points));
  const normal = () => {
    const u = Math.max(rnd(), 1e-12);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
  };
  return Array.from({ length: paths }, () => {
    const out = [0];
    let x = 0;
    for (let b = 1; b <= blocks; b++) {
      x += winrate + sd * normal();
      if (b % every === 0 || b === blocks) out.push(x);
    }
    return out;
  });
}

/** Biggest fall from a running peak along a path. */
export function maxDrawdown(path: number[]): number {
  let peak = -Infinity;
  let worst = 0;
  for (const x of path) {
    peak = Math.max(peak, x);
    worst = Math.max(worst, peak - x);
  }
  return worst;
}
