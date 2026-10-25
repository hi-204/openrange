import { describe, expect, it } from 'vitest';
import { grade, type DecisionInput } from '../grading';
import { mulberry32 } from '../preflop/deal';
import { preflopClaims } from './preflop';
import { renderClaim } from './render';

const sentences = (input: DecisionInput, actions: string[], extra = {}) =>
  preflopClaims({ actions, ev: input.ev, evStdError: input.evStdError ?? null, strategy: input.strategy, chosen: input.chosen, grade: grade(input), ...extra }).flatMap(renderClaim);

describe('rendered explanations', () => {
  it('never call a Best answer worse, and never leave placeholders', () => {
    const r = mulberry32(99);
    for (let i = 0; i < 2000; i++) {
      const actions = ['Fold', 'Call', 'All-in'];
      const ev = actions.map(() => (r() - 0.5) * 3);
      const raw = actions.map(() => (r() < 0.5 ? 0 : r()));
      const tot = raw.reduce((s, x) => s + x, 0) || 1;
      const input: DecisionInput = { ev, strategy: raw.map((x) => x / tot), chosen: Math.floor(r() * 3), unit: 'bb', evStdError: r() < 0.5 ? [0.05, 0.05, 0.05] : null };
      const g = grade(input);
      const text = sentences(input, actions).join(' ');
      expect(text).not.toMatch(/\{\w+\}/);
      if (g.category === 'best') expect(text).not.toContain('was better');
      if (g.category !== 'best' && g.loss > 0) expect(text).toContain('was better');
    }
  });

  it('words the call verdict the same way as the EVs', () => {
    const actions = ['Fold', 'Call'];
    const call = (evCall: number, equity: number) =>
      sentences({ ev: [-1, evCall], strategy: [0, 1], chosen: 1, unit: 'bb' }, actions, {
        headsUp: { stack: 10, role: 'call', matchup: [{ combo: 'AhKd', share: 1, equity }] },
      }).join(' ');
    // 10 bb: need 9/20 = 45%. Equity 50% → EV(call) − EV(fold) = 0.5·20 − 9 = 1.
    const yes = call(0, 0.5);
    expect(yes).toContain('you need 45.0% equity');
    expect(yes).toContain('calling earns 1.00 bb more');
    const no = call(-2.0, 0.4);
    expect(no).toContain('folding saves 1.00 bb');
  });
});
