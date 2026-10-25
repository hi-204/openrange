// The Level 6 claims: ICM, bubble factors, push/fold with payouts, variance, and the few chart
// facts the lessons quote (docs/LESSON_REVIEW.md cites this test).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { icm, initSync, loadPairs, pushFold } from '../../../public/wasm/solver_wasm.js';
import { bubble, normalCdf, toyBestResponse, toyTheory, varianceStats } from './widgets/gamesMath';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
loadPairs(readFileSync(root('web/public/data/equity/preflop-pairs.json'), 'utf8'));

const icmEq = async (stacks: number[], payouts: number[]) => (JSON.parse(icm(JSON.stringify({ stacks, payouts }))) as { equity: number[] }).equity;
type PF = { classes: string[]; pusher: { strategy: number[][] }; caller: { strategy: number[][] } };
const solvePf = (stacks: number[], pusher: number, caller: number, payouts: number[]) => JSON.parse(pushFold(JSON.stringify({ stacks, pusher, caller, ante: 0, payouts }))) as PF;
const combos = (n: string) => (n.length === 2 ? 6 : n.endsWith('s') ? 4 : 12);
const share = (r: PF, side: 'pusher' | 'caller') => r.classes.reduce((a, n, i) => a + combos(n) * r[side].strategy[i]![1]!, 0) / 1326;

describe('6.1, 6.2: exploiting a locked caller', () => {
  it('below the MDF bluff everything; above it, none, and value earns more than at equilibrium', () => {
    expect(toyBestResponse(10, 7.5, 1, 0.3).bluff).toBe('all');
    const locked = toyBestResponse(10, 10, 1, 0.7);
    expect(locked.bluff).toBe('none');
    expect(locked.evBettor).toBeGreaterThan(toyTheory(10, 10, 1).evBettor);
  });
});

describe('6.3: ICM', () => {
  it('two players: linear in chips', async () => {
    const [a] = await icmEq([3000, 1000], [70, 30]);
    expect(a).toBeCloseTo(0.75 * 70 + 0.25 * 30, 9);
  });

  it('worked hand: doubling your chips raises your prize equity by much less than double', async () => {
    const before = (await icmEq([5000, 3000, 1500, 500], [50, 30, 20]))[1]!;
    const after = (await icmEq([2000, 6000, 1500, 500], [50, 30, 20]))[1]!;
    expect(after).toBeGreaterThan(before);
    expect(after / before).toBeLessThan(1.6);
  });
});

describe('6.4: bubble factor and push/fold with payouts', () => {
  it('the 8 bb stack calling the 20 bb stack: factor about one and a half, a call needs about 60%', async () => {
    const b = await bubble([12, 20, 8], 2, 1, (s) => icmEq(s, [65, 35]));
    expect(b.factor).toBeGreaterThan(1.4);
    expect(b.factor).toBeLessThan(1.65);
    expect(b.needed).toBeGreaterThan(0.57);
    expect(b.needed).toBeLessThan(0.63);
  });

  it('on the bubble the big stack shoves almost everything and the short stack calls under a third', () => {
    const chip = solvePf([12, 20, 8], 1, 2, []);
    const prize = solvePf([12, 20, 8], 1, 2, [65, 35]);
    expect(share(chip, 'pusher')).toBeGreaterThan(0.5); // "a bit more than half"
    expect(share(chip, 'pusher')).toBeLessThan(0.7);
    expect(share(chip, 'caller')).toBeGreaterThan(0.4); // "a bit under half"
    expect(share(chip, 'caller')).toBeLessThan(0.5);
    expect(share(prize, 'pusher')).toBeGreaterThan(0.9); // "almost every hand"
    expect(share(prize, 'caller')).toBeLessThan(1 / 3);
    // Worked hand: JTo calls in chip EV and folds with payouts.
    const k = chip.classes.indexOf('JTo');
    expect(chip.caller.strategy[k]![1]!).toBeGreaterThan(0.5);
    expect(prize.caller.strategy[k]![1]!).toBeLessThan(0.5);
  });

  it('heads-up, payouts change nothing', () => {
    const chip = solvePf([10, 10], 0, 1, []);
    const prize = solvePf([10, 10], 0, 1, [70, 30]);
    expect(Math.abs(share(chip, 'pusher') - share(prize, 'pusher'))).toBeLessThan(0.01);
    expect(Math.abs(share(chip, 'caller') - share(prize, 'caller'))).toBeLessThan(0.01);
  });
});

describe('6.5: variance', () => {
  it('behind after 10,000 hands about three times in ten; ruin about one in seven, squared when doubled', () => {
    const v = varianceStats({ winrate: 5, sd: 100, hands: 10_000, bankroll: 2000 });
    expect(v.mean).toBe(500);
    expect(v.spread).toBe(1000);
    expect(v.behind).toBeGreaterThan(0.28);
    expect(v.behind).toBeLessThan(0.33);
    expect(1 / v.ruin!).toBeGreaterThan(6.5);
    expect(1 / v.ruin!).toBeLessThan(8);
    const twice = varianceStats({ winrate: 5, sd: 100, hands: 10_000, bankroll: 4000 }).ruin!;
    expect(twice).toBeCloseTo(v.ruin! ** 2, 12);
    expect(1 / twice).toBeGreaterThan(50);
    expect(1 / twice).toBeLessThan(60);
    // Worked hand: 20,000 hands spread about 1,400 bb.
    const w = varianceStats({ winrate: 5, sd: 100, hands: 20_000 });
    expect(Math.round(w.spread / 100) * 100).toBe(1400);
    expect(normalCdf(0)).toBeCloseTo(0.5, 6);
  });
});

describe('6.7: chart facts', () => {
  it('Q9o is not in the UTG open range; A-A against K-K is a big favourite', () => {
    const doc = JSON.parse(readFileSync(root('web/public/data/charts/cash-6max-100bb.json'), 'utf8')) as { classes: string[]; charts: { id: string; strategy: number[][] }[] };
    const utg = doc.charts.find((c) => c.id === 'first-in-UTG')!;
    expect(utg.strategy[doc.classes.indexOf('Q9o')]![1]!).toBeLessThan(0.05);
    const facts = JSON.parse(readFileSync(root('web/src/content/en/facts.json'), 'utf8')) as Record<string, number>;
    expect(1 - facts['KsKd vs AcAd']!).toBeGreaterThan(0.8);
  });
});
