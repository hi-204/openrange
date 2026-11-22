// Tournament drill (D-089): spots solved by the WASM push/fold engine with and without payouts;
// grades use the ICM EVs, converted to bb-equivalents at the average chip value.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { initSync, loadPairs, pushFold } from '../../../../public/wasm/solver_wasm.js';
import type { PushFoldResult } from '../../../lib/wasm/protocol';
import { mulberry32 } from '../preflop/deal';
import { BOUNTY, BOUNTY_CASH_SHARE, chipValue, dealHand, gradeChoice, PAYOUTS, randomSpot, rangeShare, toJson, type Solved } from './tournament';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
loadPairs(readFileSync(root('data/equity/preflop-pairs.json'), 'utf8'));

describe('tournament push/fold drill', () => {
  it('grades by ICM EV, in bb-equivalents, and compares with chips', () => {
    const rnd = mulberry32(31);
    for (let i = 0; i < 4; i++) {
      const spot = randomSpot(rnd);
      const solved: Solved = { icm: JSON.parse(pushFold(JSON.stringify(toJson(spot, true)))) as PushFoldResult, chips: JSON.parse(pushFold(JSON.stringify(toJson(spot, false)))) as PushFoldResult };
      expect(solved.icm.units).toBe('prize');
      expect(solved.chips.units).toBe('bb');
      const classes = solved.icm.classes;
      // Average chip value: the prize pool (plus the counted bounties) over the chips in play.
      const bounties = spot.kind === 'pko' ? spot.stacks.length * BOUNTY * BOUNTY_CASH_SHARE : 0;
      expect(chipValue(spot)).toBeCloseTo((PAYOUTS[spot.kind].reduce((a, b) => a + b, 0) + bounties) / spot.stacks.reduce((a, b) => a + b, 0), 12);
      const p = dealHand(spot, classes, rnd);
      for (const chosen of [0, 1] as const) {
        const g = gradeChoice(p, solved, chosen);
        const best = Math.max(...g.icmEv);
        expect(g.grade.lossBb).toBeCloseTo((best - g.icmEv[chosen]) / chipValue(spot), 9);
        expect(g.icmBest).toBe(g.icmEv[1] >= g.icmEv[0] ? 1 : 0);
      }
      const side = spot.role === 'shove' ? 'pusher' : 'caller';
      const share = rangeShare(solved.icm[side], classes);
      expect(share).toBeGreaterThanOrEqual(0);
      expect(share).toBeLessThanOrEqual(1);
    }
  }, 120_000);

  it('knockout spots pay the counted bounty in the ICM solve only', () => {
    const spot = { kind: 'pko' as const, stacks: [20, 15, 12, 10, 8, 6], sb: 4, bb: 5, role: 'shove' as const };
    expect(toJson(spot, true).bounties).toEqual(spot.stacks.map(() => BOUNTY * BOUNTY_CASH_SHARE));
    expect(toJson(spot, false).bounties).toBeUndefined();
    expect(toJson({ ...spot, kind: 'bubble', stacks: [10, 10, 10, 10], sb: 2, bb: 3 }, true).bounties).toBeUndefined();
    const withB = JSON.parse(pushFold(JSON.stringify(toJson(spot, true)))) as PushFoldResult;
    const noB = JSON.parse(pushFold(JSON.stringify({ ...toJson(spot, true), bounties: [] }))) as PushFoldResult;
    // The small blind (8 bb) covers the big blind (6 bb): shoving AA busts the big blind when it
    // wins, so its shove EV is higher with the bounty, by at most the bounty itself.
    const aa = withB.classes.indexOf('AA');
    const gain = withB.pusher.ev[aa]![1]! - noB.pusher.ev[aa]![1]!;
    expect(gain).toBeGreaterThan(0);
    expect(gain).toBeLessThanOrEqual(BOUNTY * BOUNTY_CASH_SHARE + 1e-9);
  }, 120_000);
});
