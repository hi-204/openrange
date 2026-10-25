// Postflop explanations never contradict the numbers (D-053): every hero decision of many
// randomly played hands through solved river and turn spots. On the river the pot-odds
// sentence must agree with the solver's EVs exactly (EV(call) − EV(fold) = equity · pot − call).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { equity as wasmEquity, initSync, Solver } from '../../../../public/wasm/solver_wasm.js';
import type { EquityResult, SolverInfo, SolverNode, SpotJson } from '../../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../../solver/spotForm';
import { decide } from '../postflop/decision';
import { PostflopHand, type NodeSource } from '../postflop/hand';
import { mulberry32 } from '../preflop/deal';
import { checkPostflopClaims } from './check';
import { renderClaim } from './render';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
const equity = async (req: unknown) => JSON.parse(wasmEquity(JSON.stringify(req))) as EquityResult;

async function playMany(spot: SpotJson, iterations: number, hands: number, seed: number) {
  const s = new Solver(JSON.stringify(spot), 1e9, false);
  s.step(iterations);
  const exploitabilityPct = JSON.parse(s.exploitability()).pctPot as number;
  const info = JSON.parse(s.info()) as SolverInfo;
  const source: NodeSource = async (path) => JSON.parse(s.node(JSON.stringify(path))) as SolverNode;
  const rootNode = await source([]);
  const rnd = mulberry32(seed);
  const tally = { decisions: 0, offPath: 0, riverCalls: 0, worstIdentity: 0, kinds: new Set<string>() };
  for (let g = 0; g < hands; g++) {
    const hand = PostflopHand.deal(info, rootNode, (g % 2) as 0 | 1, rnd);
    for (let guard = 0; guard < 20; guard++) {
      const r = await hand.advance(source);
      if (r.kind === 'end') break;
      // Mostly follow the solution, sometimes deviate, so off-path decisions occur too.
      const n = info.hands[hand.heroSeat].length;
      const hi = hand.heroIndex();
      const probs = r.node.actions.map((_, a) => r.node.strategy[a * n + hi]!);
      const chosen = rnd() < 0.8 ? probs.indexOf(Math.max(...probs)) : Math.floor(rnd() * r.node.actions.length);
      const d = await decide(hand, r.node, chosen, { exploitabilityPct, equity });
      const bad = checkPostflopClaims(d.ctx, d.claims);
      expect(bad, `${hand.hero} vs ${hand.villain} on ${r.node.board.join(' ')} path ${hand.path}`).toEqual([]);
      const text = d.claims.flatMap(renderClaim).join(' ');
      expect(text).not.toMatch(/\{\w+\}/);
      if (d.grade?.category === 'best') expect(text).not.toContain('was better');
      tally.decisions++;
      if (d.ctx.offPath) tally.offPath++;
      for (const c of d.claims) {
        if (c.kind === 'potOdds' && c.exact) {
          tally.riverCalls++;
          tally.worstIdentity = Math.max(tally.worstIdentity, Math.abs(c.equity * c.potAfterCall - c.toCall - c.evDiff));
        }
      }
      d.claims.forEach((c) => tally.kinds.add(c.kind));
      hand.play(r.node, chosen);
    }
  }
  s.free();
  return tally;
}

describe('postflop explanations on solved spots', () => {
  it('river: consistent at every decision, and the pot-odds identity holds', async () => {
    const t = await playMany(toSpot(PRESETS.river), 200, 150, 1);
    expect(t.decisions).toBeGreaterThan(150);
    expect(t.riverCalls).toBeGreaterThan(20);
    console.log(`river: ${t.decisions} decisions (${t.offPath} off path), ${t.riverCalls} call decisions, worst identity error ${t.worstIdentity.toExponential(2)} bb`);
    for (const k of ['verdict', 'evRank', 'accuracy', 'potOdds', 'mdf', 'spr', 'texture', 'advantage', 'blockers']) expect(t.kinds, k).toContain(k);
  }, 300_000);

  it('turn (with mirrored river cards): consistent at every decision', async () => {
    const t = await playMany({ ...toSpot(PRESETS.turn), board: 'Kh Th 6h 3s' }, 60, 40, 2);
    expect(t.decisions).toBeGreaterThan(40);
    expect(t.kinds).toContain('potOdds');
    console.log(`turn: ${t.decisions} decisions (${t.offPath} off path), ${t.riverCalls} river call decisions, worst identity error ${t.worstIdentity.toExponential(2)} bb`);
  }, 300_000);
});
