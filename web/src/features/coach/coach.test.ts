// The coach never contradicts the data (D-065). Checked on every class, stack, role and answer
// of the exact heads-up charts, on seeded synthetic decisions, and on every decision of randomly
// played hands through a solved river spot.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { equity as wasmEquity, initSync, loadPairs, preflopMatchup, Solver } from '../../../public/wasm/solver_wasm.js';
import { pct } from '../../lib/format';
import type { EquityResult, SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../solver/spotForm';
import type { Claim } from '../trainer/explain/claims';
import { preflopClaims, type MatchupRow } from '../trainer/explain/preflop';
import { fmtLoss } from '../trainer/explain/render';
import { grade, MIX_THRESHOLD, type DecisionInput, type Grade } from '../trainer/grading';
import { decide } from '../trainer/postflop/decision';
import { PostflopHand, type NodeSource } from '../trainer/postflop/hand';
import { mulberry32 } from '../trainer/preflop/deal';
import { buildCoach, PRAISE_MIN_FREQUENCY, type CoachCard, type Detail } from './coach';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
loadPairs(readFileSync(root('data/equity/preflop-pairs.json'), 'utf8'));

const text = (c: CoachCard) => [c.verdict, ...c.why, c.keyIdea, c.lookFor].join(' ');

/** Every rule of D-065 for one decision. */
function checkCoach(card: CoachCard, claims: Claim[], g: Grade | null, actions: string[], strategy: number[], chosen: number) {
  const all = text(card);
  expect(all, 'placeholders').not.toMatch(/\{\w+\}/);
  if (!g) {
    expect(card.tone).toBe('ungraded');
    expect(card.verdict).toMatch(/^Not graded/);
    return;
  }
  // The recommendation is a best action in the data.
  const best = g.bestActions.map((i) => actions[i]!);
  for (const r of card.recommended) expect(best, 'recommended action').toContain(r);
  // An action the solution (almost) never plays is never praised.
  if (strategy[chosen]! < PRAISE_MIN_FREQUENCY) expect(card.tone, '0% action praised').not.toBe('best');
  // A mixed action is never called a mistake.
  if (strategy[chosen]! >= MIX_THRESHOLD) {
    expect(['best', 'fine'], 'mixed action called a mistake').toContain(card.tone);
    expect(card.verdict).not.toMatch(/mistake/i);
  }
  // Quoted numbers equal the computed values (as formatted).
  if (g.category !== 'best') expect(card.verdict).toContain(fmtLoss(g.loss, g.unit));
  const call = claims.find((c) => c.kind === 'callMath');
  if (call) {
    expect(all).toContain(pct(call.required, 1));
    expect(all).toContain(pct(call.equity, 1));
    // "that's enough" exactly when the equity covers the price.
    expect(all.includes("that's enough")).toBe(call.equity >= call.required);
  }
  const odds = claims.find((c) => c.kind === 'potOdds');
  if (odds) {
    expect(all).toContain(pct(odds.required, 1));
    expect(all).toContain(pct(odds.equity, 1));
  }
  // Tone matches the category.
  const expected: Record<string, string[]> = { best: ['best', 'fine'], acceptable: ['fine'], inaccuracy: ['small'], mistake: ['mistake'], blunder: ['blunder'] };
  expect(expected[g.category], `tone for ${g.category}`).toContain(card.tone);
}

type Chart = { id: string; stack: number; actions: string[]; strategy: number[][]; ev: number[][] };
const hu = JSON.parse(readFileSync(root('data/charts/pushfold-hu.json'), 'utf8')) as { classes: string[]; charts: Chart[] };

describe('coach on the exact heads-up charts', () => {
  it('follows every rule for every class, stack, role and answer', () => {
    let n = 0;
    for (const s of [...new Set(hu.charts.map((c) => c.stack))]) {
      const sb = hu.charts.find((c) => c.id === `sb-shove-${s}`)!;
      const bb = hu.charts.find((c) => c.id === `bb-call-${s}`)!;
      for (const [chart, role, villain] of [
        [sb, 'shove', bb.strategy.map((r) => r[1]!)],
        [bb, 'call', sb.strategy.map((r) => r[1]!)],
      ] as const) {
        for (let k = 0; k < 169; k++) {
          const rows = JSON.parse(preflopMatchup(JSON.stringify({ hero: hu.classes[k], villain }))).combos as MatchupRow[];
          for (const chosen of [0, 1]) {
            const input: DecisionInput = { ev: chart.ev[k]!, strategy: chart.strategy[k]!, chosen, unit: 'bb' };
            const g = grade(input);
            const claims = preflopClaims({ actions: chart.actions, ev: input.ev, evStdError: null, strategy: input.strategy, chosen, grade: g, headsUp: { stack: s, role, matchup: rows } });
            const card = buildCoach(claims, { seed: `${chart.id}|${k}|${chosen}`, drill: 'preflop', position: role === 'shove' ? 'SB' : 'BB', hand: hu.classes[k]!, detail: 'detailed' });
            checkCoach(card, claims, g, chart.actions, input.strategy, chosen);
            n++;
          }
        }
      }
    }
    expect(n).toBe(24 * 169 * 2 * 2);
  }, 120_000);
});

describe('coach on synthetic decisions', () => {
  it('follows every rule for random EVs, mixes, errors and detail levels', () => {
    const r = mulberry32(31);
    const details: Detail[] = ['simple', 'standard', 'detailed'];
    for (let i = 0; i < 3000; i++) {
      const actions = ['Fold', 'Call', 'Raise 3', 'All-in'].slice(0, 2 + Math.floor(r() * 3));
      const ev = actions.map(() => (r() - 0.5) * 4);
      const raw = actions.map(() => (r() < 0.45 ? 0 : r()));
      const tot = raw.reduce((s, x) => s + x, 0) || 1;
      const strategy = raw.map((x) => x / tot);
      const chosen = Math.floor(r() * actions.length);
      const se = r() < 0.4 ? actions.map(() => r() * 0.08) : null;
      const graded = r() < 0.9;
      const input: DecisionInput = { ev, evStdError: se, strategy, chosen, unit: 'bb' };
      const g = graded ? grade(input) : null;
      const claims = preflopClaims({ actions, ev, evStdError: se, strategy, chosen, grade: g });
      const detail = details[i % 3]!;
      const card = buildCoach(claims, { seed: `s${i}`, drill: 'preflop', position: 'CO', hand: 'AKo', playersBehind: 3, detail });
      checkCoach(card, claims, g, actions, strategy, chosen);
      expect(card.why.length).toBeLessThanOrEqual({ simple: 2, standard: 3, detailed: 4 }[detail]);
      // Deterministic: the same decision reads the same.
      expect(text(buildCoach(claims, { seed: `s${i}`, drill: 'preflop', position: 'CO', hand: 'AKo', playersBehind: 3, detail }))).toBe(text(card));
    }
  });

  it('picks phrase variants by seed (so variety exists, but each decision is stable)', () => {
    const input: DecisionInput = { ev: [-1, 0.5], strategy: [0, 1], chosen: 1, unit: 'bb' };
    const claims = preflopClaims({ actions: ['Fold', 'Call'], ev: input.ev, evStdError: null, strategy: input.strategy, chosen: 1, grade: grade(input) });
    const verdicts = new Set(Array.from({ length: 30 }, (_, i) => buildCoach(claims, { seed: `v${i}`, drill: 'preflop', position: 'BB', hand: 'AA', detail: 'standard' }).verdict));
    expect(verdicts.size).toBeGreaterThan(1);
  });
});

describe('coach on a solved river spot', () => {
  it('follows every rule at every decision of randomly played hands', async () => {
    const s = new Solver(JSON.stringify(toSpot(PRESETS.river)), 1e9, false);
    s.step(200);
    const exploitabilityPct = JSON.parse(s.exploitability()).pctPot as number;
    const info = JSON.parse(s.info()) as SolverInfo;
    const source: NodeSource = async (path) => JSON.parse(s.node(JSON.stringify(path))) as SolverNode;
    const equity = async (req: unknown) => JSON.parse(wasmEquity(JSON.stringify(req))) as EquityResult;
    const rootNode = await source([]);
    const rnd = mulberry32(3);
    let decisions = 0;
    for (let h = 0; h < 120; h++) {
      const hand = PostflopHand.deal(info, rootNode, (h % 2) as 0 | 1, rnd);
      for (let guard = 0; guard < 10; guard++) {
        const r = await hand.advance(source);
        if (r.kind === 'end') break;
        const chosen = Math.floor(rnd() * r.node.actions.length);
        const d = await decide(hand, r.node, chosen, { exploitabilityPct, equity });
        const card = buildCoach(d.claims, { seed: `${h}|${guard}`, drill: 'postflop', position: hand.heroSeat ? 'IP' : 'OOP', hand: 'xx', detail: 'detailed' });
        checkCoach(card, d.claims, d.grade, r.node.actions, d.ctx.strategy, chosen);
        decisions++;
        hand.play(r.node, chosen);
      }
    }
    expect(decisions).toBeGreaterThan(120);
    s.free();
  }, 300_000);
});
