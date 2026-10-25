// The toy game's theory against the engine's solve, ICM bubble factors, and variance maths.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { icm, initSync, Solver } from '../../../../public/wasm/solver_wasm.js';
import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { bubble, maxDrawdown, normalCdf, simulate, toyAir, toyBestResponse, toySpot, toyTheory, varianceStats } from './gamesMath';

initSync({ module: readFileSync(fileURLToPath(new URL('../../../../public/wasm/solver_wasm_bg.wasm', import.meta.url))) });

/** Solve the toy game and read the same quantities as the theory. */
function solveToy(pot: number, betPct: number, air: number, iterations: number) {
  const s = new Solver(JSON.stringify(toySpot(pot, betPct, air)), 1e9, false);
  s.step(iterations);
  const report = JSON.parse(s.exploitability()) as { pctPot: number; evBb: [number, number] };
  const info = JSON.parse(s.info()) as SolverInfo;
  const root = JSON.parse(s.node('[]')) as SolverNode & { kind: 'action' };
  const facing = JSON.parse(s.node('[1]')) as SolverNode & { kind: 'action' };
  const H0 = info.hands[0].length;
  let v = 0, vb = 0, a = 0, ab = 0; // prettier-ignore
  info.hands[0].forEach((h, i) => {
    const r = root.reach[0]![i]!;
    const bet = root.strategy[H0 + i]!;
    if (h[0] === '9') (v += r), (vb += r * bet);
    else (a += r), (ab += r * bet);
  });
  const H1 = info.hands[1].length;
  let c = 0, ct = 0; // prettier-ignore
  info.hands[1].forEach((_, i) => {
    const r = facing.reach[1]![i]!;
    ct += r;
    c += r * facing.strategy[H1 + i]!;
  });
  s.free();
  return { report, actions: [root.actions, facing.actions], valueBets: vb / v, airBets: a ? ab / a : 0, bluffShare: ab / (vb + ab), call: c / ct };
}

describe('toy game: the engine finds the textbook equilibrium', () => {
  // Lesson 5.3 moves the bet slider with 2 air hands per value hand; lesson 5.2 uses 0.25 at a pot-sized bet.
  for (const [betPct, air] of [[33, 1], [75, 1], [100, 1], [150, 1], [200, 1.5], [100, 0.2], [100, 0.25], ...[25, 50, 75, 100, 125, 150, 175, 200].map((b) => [b, 2] as const)] as const) {
    it(`bet ${betPct}% of the pot, ${air} air per value hand`, () => {
      const pot = 10;
      const bet = (pot * betPct) / 100;
      const got = solveToy(pot, betPct, air, 3000);
      const want = toyTheory(pot, bet, air);
      expect(got.actions).toEqual([['Check', `All-in ${Number(bet.toFixed(2))}`], ['Fold', 'Call']]);
      expect(got.report.pctPot).toBeLessThan(0.02);
      expect(got.valueBets).toBeGreaterThan(0.999);
      expect(Math.abs(got.bluffShare - want.bluffShare)).toBeLessThan(0.002);
      expect(Math.abs(got.airBets - want.airBets)).toBeLessThan(0.005);
      expect(Math.abs(got.call - want.call)).toBeLessThan(0.002);
      expect(Math.abs(got.report.evBb[0] - want.evBettor)).toBeLessThan(0.01);
    });
  }

  it('lesson 5.2: with a quarter of an air hand per value hand the caller folds every time', () => {
    expect(toyTheory(10, 10, 0.25).call).toBe(0);
    expect(toyTheory(10, 10, 0.25).airBets).toBe(1);
  });

  it('theory: bluffs are B/(P+2B) of bets and the caller defends the MDF', () => {
    const t = toyTheory(10, 10, 1);
    expect(t.bluffShare).toBeCloseTo(1 / 3, 12);
    expect(t.call).toBeCloseTo(1 / 2, 12);
    expect(toyAir(10)).toBe(16); // capped by the 16 Q-J combos
  });

  it('frequencies are noisy early and settle as the solve converges', () => {
    const early = solveToy(10, 75, 1, 20);
    const late = solveToy(10, 75, 1, 3000);
    expect(early.report.pctPot).toBeGreaterThan(10 * late.report.pctPot);
    expect(Math.abs(early.call - 10 / 17.5)).toBeGreaterThan(Math.abs(late.call - 10 / 17.5));
  });

  it('best response to a locked caller: bluff everything below the MDF, nothing above it', () => {
    const mdf = 10 / 17.5;
    expect(toyBestResponse(10, 7.5, 1, mdf - 0.1).bluff).toBe('all');
    expect(toyBestResponse(10, 7.5, 1, mdf + 0.1).bluff).toBe('none');
    expect(toyBestResponse(10, 7.5, 1, mdf).bluff).toBe('any');
    // At the MDF the best response earns exactly the equilibrium EV; overfolding gives more away.
    expect(toyBestResponse(10, 7.5, 1, mdf).evBettor).toBeCloseTo(toyTheory(10, 7.5, 1).evBettor, 9);
    expect(toyBestResponse(10, 7.5, 1, 0.3).evBettor).toBeGreaterThan(toyTheory(10, 7.5, 1).evBettor);
  });
});

describe('ICM and bubble factors', () => {
  const run = async (s: number[], p: number[]) => (JSON.parse(icm(JSON.stringify({ stacks: s, payouts: p }))) as { equity: number[] }).equity;

  it('chip leader and short stack: prizes are conserved, equity is not proportional to chips', async () => {
    const eq = await run([5000, 3000, 1500, 500], [50, 30, 20]);
    expect(eq.reduce((a, b) => a + b, 0)).toBeCloseTo(100, 9);
    expect(eq[0]! / 100).toBeLessThan(5000 / 10000); // the leader's prize share is below its chip share
    expect(eq[3]! / 100).toBeGreaterThan(500 / 10000); // the short stack's is above
  });

  it('on a bubble the factor is above 1 and a call needs more than half the equity', async () => {
    const b = await bubble([5000, 3000, 1500, 500], 1, 0, (s) => run(s, [50, 30, 20]));
    expect(b.factor).toBeGreaterThan(1);
    expect(b.needed).toBeGreaterThan(0.5);
    const hu = await bubble([3000, 1000], 1, 0, (s) => run(s, [70, 30]));
    expect(hu.factor).toBeCloseTo(1, 9); // heads-up ICM is linear in chips
  });
});

describe('variance', () => {
  it('normal CDF', () => {
    expect(normalCdf(0)).toBeCloseTo(0.5, 6); // the approximation is good to 1.5e-7
    expect(normalCdf(1.96)).toBeCloseTo(0.975, 3);
    expect(normalCdf(-1)).toBeCloseTo(0.158655, 5);
  });

  it('results after N hands and risk of ruin', () => {
    const v = varianceStats({ winrate: 5, sd: 100, hands: 10_000, bankroll: 2000 });
    expect(v.mean).toBe(500);
    expect(v.spread).toBe(1000);
    expect(v.behind).toBeCloseTo(normalCdf(-0.5), 9);
    expect(v.ruin).toBeCloseTo(Math.exp(-2), 9);
  });

  it('simulated paths are seeded and their average tracks the win rate', () => {
    const a = simulate({ winrate: 5, sd: 100, hands: 100_000 }, 400, 50, 7);
    expect(simulate({ winrate: 5, sd: 100, hands: 100_000 }, 400, 50, 7)).toEqual(a);
    const ends = a.map((p) => p.at(-1)!);
    const mean = ends.reduce((x, y) => x + y, 0) / ends.length;
    // Expected 5000 bb; the standard error of the mean of 400 paths is 10000 / 20 = 500.
    expect(Math.abs(mean - 5000)).toBeLessThan(3 * 500);
    expect(maxDrawdown([0, 10, 4, 12, 1, 5])).toBe(11);
  });
});
