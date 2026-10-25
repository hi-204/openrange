// Explanations never contradict the numbers (D-053): checked on every hand class at every
// stack of the exact heads-up charts, on seeded synthetic decisions, and against tampered
// claims (the checker must catch them).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, loadPairs, preflopMatchup } from '../../../../public/wasm/solver_wasm.js';
import { grade, type DecisionInput } from '../grading';
import { checkClaims } from './check';
import type { Claim } from './claims';
import { preflopClaims, type MatchupRow } from './preflop';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
loadPairs(readFileSync(root('data/equity/preflop-pairs.json'), 'utf8'));

type Chart = { id: string; stack: number; actions: string[]; strategy: number[][]; ev: number[][] };
const hu = JSON.parse(readFileSync(root('data/charts/pushfold-hu.json'), 'utf8')) as { classes: string[]; charts: Chart[] };

const matchup = (hero: string, villain: number[]): MatchupRow[] =>
  JSON.parse(preflopMatchup(JSON.stringify({ hero, villain }))).combos as MatchupRow[];

describe('preflop explanations on the exact heads-up charts', () => {
  const stacks = [...new Set(hu.charts.map((c) => c.stack))];

  it('never contradict the chart, for every class, stack, role and answer', () => {
    let checked = 0;
    let callClaims = 0;
    let shoveClaims = 0;
    let worstCall = 0;
    let worstShove = 0;
    for (const s of stacks) {
      const sb = hu.charts.find((c) => c.id === `sb-shove-${s}`)!;
      const bb = hu.charts.find((c) => c.id === `bb-call-${s}`)!;
      for (const [chart, role, villain] of [
        [sb, 'shove', bb.strategy.map((r) => r[1]!)],
        [bb, 'call', sb.strategy.map((r) => r[1]!)],
      ] as const) {
        for (let k = 0; k < 169; k++) {
          const rows = matchup(hu.classes[k]!, villain);
          for (const chosen of [0, 1]) {
            const input: DecisionInput = { ev: chart.ev[k]!, strategy: chart.strategy[k]!, chosen, unit: 'bb' };
            const claims = preflopClaims({
              actions: chart.actions,
              ev: input.ev,
              evStdError: null,
              strategy: input.strategy,
              chosen,
              grade: grade(input),
              headsUp: { stack: s, role, matchup: rows },
            });
            const bad = checkClaims({ actions: chart.actions, input }, claims, true);
            expect(bad, `${chart.id} ${hu.classes[k]} chose ${chosen}`).toEqual([]);
            const cm = claims.find((c) => c.kind === 'callMath');
            const sm = claims.find((c) => c.kind === 'shoveMath');
            if (cm) worstCall = Math.max(worstCall, Math.abs(cm.equity * cm.potAfterCall - cm.toCall - cm.evDiff));
            if (sm) worstShove = Math.max(worstShove, Math.abs(sm.rebuilt - sm.evShove));
            if (cm) {
              callClaims++;
              // The equity identity holds exactly on the exact chart.
              expect(cm.exact, `${chart.id} ${hu.classes[k]}`).toBe(true);
            }
            if (claims.some((c) => c.kind === 'shoveMath')) shoveClaims++;
            checked++;
          }
        }
      }
    }
    expect(checked).toBe(stacks.length * 169 * 2 * 2);
    console.log(`heads-up identities: worst call error ${worstCall.toExponential(2)} bb, worst shove error ${worstShove.toExponential(2)} bb`);
    expect(callClaims).toBe(stacks.length * 169 * 2);
    expect(shoveClaims).toBe(stacks.length * 169 * 2);
  }, 60_000);
});

// Seeded PRNG (mulberry32) for reproducible synthetic decisions.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('preflop explanations on synthetic decisions', () => {
  it('stay consistent for random EVs, mixes and standard errors', () => {
    const r = rng(2026);
    for (let i = 0; i < 2000; i++) {
      const n = 2 + Math.floor(r() * 3);
      const actions = ['Fold', 'Call', 'Raise 3', 'All-in'].slice(0, n);
      const ev: (number | null)[] = actions.map(() => (r() < 0.05 ? null : (r() - 0.5) * 4));
      if (!ev.some((e) => e !== null)) ev[0] = 0;
      const raw = actions.map(() => (r() < 0.4 ? 0 : r()));
      const total = raw.reduce((s, x) => s + x, 0) || 1;
      const strategy = raw.map((x) => x / total);
      const se = r() < 0.5 ? actions.map(() => r() * 0.1) : null;
      const available = ev.flatMap((e, k) => (e === null ? [] : [k]));
      const chosen = available[Math.floor(r() * available.length)]!;
      const input: DecisionInput = { ev, evStdError: se, strategy, chosen, unit: 'bb' };
      const graded = r() < 0.9;
      const claims = preflopClaims({ actions, ev, evStdError: se, strategy, chosen, grade: graded ? grade(input) : null });
      expect(checkClaims({ actions, input }, claims, graded)).toEqual([]);
    }
  });

  it('catch tampered claims', () => {
    const actions = ['Fold', 'Call'];
    const input: DecisionInput = { ev: [-1, -0.4], strategy: [0, 1], chosen: 0, unit: 'bb' };
    const rows: MatchupRow[] = [{ combo: 'AhKd', share: 1, equity: 0.4 }];
    const claims = preflopClaims({ actions, ev: input.ev, evStdError: null, strategy: input.strategy, chosen: 0, grade: grade(input), headsUp: { stack: 5, role: 'call', matchup: rows } });
    expect(checkClaims({ actions, input }, claims, true)).toEqual([]);
    const tamper = (f: (c: Claim) => Claim) => checkClaims({ actions, input }, claims.map(f), true);
    expect(tamper((c) => (c.kind === 'verdict' ? { ...c, category: 'best' } : c))).not.toEqual([]);
    expect(tamper((c) => (c.kind === 'callMath' ? { ...c, verdict: 'fold' } : c))).not.toEqual([]);
    expect(tamper((c) => (c.kind === 'callMath' ? { ...c, equity: 0.2, exact: true } : c))).not.toEqual([]);
    expect(tamper((c) => (c.kind === 'evRank' ? { ...c, order: [...c.order].reverse() } : c))).not.toEqual([]);
  });
});
