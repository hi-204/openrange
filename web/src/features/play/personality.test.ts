// Personality bots (D-090): each deviates from the reference bot in the documented direction, and
// every move stays legal.
import { describe, expect, it } from 'vitest';
import { act, legal, newHand, type GameState } from './engine';
import { DEFAULT_RULE, ruleMove } from './bots';
import { PERSONALITIES, personalityMove, POSTFLOP, preflopDeviation } from './personality';
import { mulberry32 } from '../trainer/preflop/deal';

const names = (n: number) => Array.from({ length: n }, (_, i) => `P${i}`);
const facingRaise = (): GameState => act(newHand({ names: names(3), stacks: [100, 100, 100], hero: 0, button: 0, seed: 9 }), { kind: 'raise', to: 3 });

describe('personality bots', () => {
  it('the reference postflop settings are the original rule-based bot', () => {
    expect(POSTFLOP.reference).toEqual(DEFAULT_RULE);
  });

  it('preflop deviations go in the documented direction', () => {
    const s = facingRaise();
    const rnd = mulberry32(1);
    // A station calls a hand the reference folds; an over-folder folds a hand the reference calls.
    expect(preflopDeviation('station', s, { kind: 'fold' }, 0.45, rnd)?.move).toEqual({ kind: 'call' });
    expect(preflopDeviation('overfolder', s, { kind: 'call' }, 0.5, rnd)?.move).toEqual({ kind: 'fold' });
    // A nit folds a marginal hand; a LAG raises one the reference only calls.
    expect(preflopDeviation('nit', s, { kind: 'call' }, 0.5, rnd)?.move).toEqual({ kind: 'fold' });
    expect(preflopDeviation('lag', s, { kind: 'call' }, 0.5, rnd)?.move.kind).toBe('raise');
    // Strong hands are left alone.
    expect(preflopDeviation('nit', s, { kind: 'raise', to: 9 }, 0.8, rnd)).toBeNull();
  });

  it('postflop settings: the station calls lighter and the over-folder folds more than the reference', async () => {
    // A flop where the bot faces a pot-sized bet with 40% equity (price 1/3): the reference
    // calls (40% ≥ 33% + 5%), the over-folder folds (needs 33% + 20%), the station calls.
    let s = newHand({ names: names(2), stacks: [100, 100], hero: 0, button: 0, seed: 11 });
    s = act(s, { kind: 'call' });
    s = act(s, { kind: 'check' });
    s = act(s, { kind: 'raise', to: 2 }); // BB bets the pot (2) on the flop
    const eq = async () => 0.4;
    const r = (p: typeof DEFAULT_RULE) => ruleMove(s, eq, () => 0.99, p).then((m) => m.move.kind);
    expect(await r(POSTFLOP.reference)).toBe('call');
    expect(await r(POSTFLOP.overfolder)).toBe('fold');
    expect(await r(POSTFLOP.station)).toBe('call');
  });

  it('every personality only makes legal moves over many random spots', async () => {
    const rnd = mulberry32(5);
    const equity = async () => rnd();
    for (const p of PERSONALITIES) {
      for (let h = 0; h < 15; h++) {
        let s = newHand({ names: names(4), stacks: [100, 60, 30, 100], hero: 0, button: h % 4, seed: 100 + h });
        for (let guard = 0; guard < 40 && !s.done && s.toAct !== null; guard++) {
          const l = legal(s);
          const m = await personalityMove(p, s, new Map(), equity, rnd);
          if (m.move.kind === 'fold') expect(l.fold).toBe(true);
          if (m.move.kind === 'check') expect(l.check).toBe(true);
          if (m.move.kind === 'call') expect(l.call).not.toBeNull();
          if (m.move.kind === 'raise') expect(l.minTo).not.toBeNull();
          s = act(s, m.move);
        }
      }
    }
  });
});
