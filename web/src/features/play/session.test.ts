// Playing sessions (D-090): random hands through the real engine keep chips conserved, places
// consistent and levels advancing; cash tables reset or rebuy as configured.
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../trainer/preflop/deal';
import { act, legal, needsShowdown, newHand, settle, type GameState } from './engine';
import { applyHand, handSetup, LEVELS, levelOf, MTT_PAYOUTS, remainingPayouts, SNG_PAYOUTS, startSession, type Format, type Session } from './session';

/** Play one hand with random legal moves (aggressive enough to bust players). */
function playHand(s: Session, rnd: () => number): Session {
  const setup = handSetup(s);
  let g: GameState = newHand({ names: setup.names, stacks: setup.stacks, hero: setup.hero, button: setup.button, seed: Math.floor(rnd() * 2 ** 31), ante: setup.ante });
  for (let guard = 0; guard < 200 && !g.done && g.toAct !== null; guard++) {
    const l = legal(g);
    const r = rnd();
    g = act(g, l.maxTo !== null && r < 0.25 ? { kind: 'raise', to: l.maxTo } : l.call !== null && r < 0.75 ? { kind: 'call' } : l.check ? { kind: 'check' } : { kind: 'fold' });
  }
  if (needsShowdown(g)) g = settle(g, () => rnd());
  return applyHand(s, g, setup, rnd);
}
const chips = (s: Session) => s.table.filter((p) => !p.out).reduce((a, p) => a + p.chips, 0) + s.field.reduce((a, b) => a + b, 0);
const names = (n: number) => Array.from({ length: n }, (_, i) => (i === 0 ? 'You' : `Bot ${i}`));

describe('playing sessions', () => {
  it('cash: stacks reset every hand, or carry over with rebuys', () => {
    const rnd = mulberry32(1);
    let reset = startSession({ kind: 'cash', players: 6, startBb: 100, stacks: 'reset', rebuy: true }, names(6), ['station']);
    for (let i = 0; i < 20; i++) reset = playHand(reset, rnd);
    expect(reset.table.every((p) => p.chips === 100)).toBe(true);
    let carry = startSession({ kind: 'cash', players: 6, startBb: 100, stacks: 'carry', rebuy: true }, names(6), ['lag']);
    for (let i = 0; i < 40; i++) carry = playHand(carry, rnd);
    // Chips only enter through rebuys.
    const rebuys = carry.table.reduce((a, p) => a + p.rebuys, 0);
    expect(chips(carry)).toBeCloseTo(600 + 100 * rebuys, 6);
    expect(carry.hands).toHaveLength(40);
    expect(levelOf(carry)).toEqual({ sb: 0.5, bb: 1, ante: 0 });
  });

  it('sit-and-go: conserves chips, assigns places, pays the hero and ends', () => {
    for (const seed of [2, 3, 4]) {
      const rnd = mulberry32(seed);
      const f: Format = { kind: 'sng', players: 6, startChips: 1500, handsPerLevel: 5, payouts: SNG_PAYOUTS[6]! };
      let s = startSession(f, names(6), ['reference', 'nit']);
      for (let i = 0; i < 400 && !s.finished; i++) {
        s = playHand(s, rnd);
        expect(chips(s)).toBeCloseTo(9000, 6);
        expect(s.remaining).toBe(s.table.filter((p) => !p.out).length);
      }
      expect(s.finished).toBe(true);
      const hero = s.table[0]!;
      expect(hero.place).toBeGreaterThanOrEqual(1);
      expect(s.heroPrize).toBe(SNG_PAYOUTS[6]![hero.place! - 1] ?? 0);
      // Places are unique among those who busted.
      const places = s.table.filter((p) => p.place).map((p) => p.place);
      expect(new Set(places).size).toBe(places.length);
    }
  });

  it('levels rise with hands played; the hand plays in big blinds of the level', () => {
    const f: Format = { kind: 'sng', players: 6, startChips: 1500, handsPerLevel: 5, payouts: SNG_PAYOUTS[6]! };
    const s = { ...startSession(f, names(6), ['reference']), hand: 12 };
    expect(levelOf(s)).toEqual(LEVELS[2]);
    const setup = handSetup(s);
    expect(setup.stacks[0]).toBeCloseTo(1500 / LEVELS[2]!.bb, 12);
    expect(setup.ante).toBeCloseTo(LEVELS[2]!.ante / LEVELS[2]!.bb, 12);
    expect(remainingPayouts(s)).toEqual(SNG_PAYOUTS[6]);
  });

  it('multi-table simulation: the field shrinks, chips are conserved, the final table fills up', () => {
    const rnd = mulberry32(7);
    const f: Format = { kind: 'mtt', field: 27, tableSize: 9, startChips: 1500, handsPerLevel: 6, payouts: MTT_PAYOUTS };
    let s = startSession(f, names(9), ['reference', 'station', 'lag']);
    expect(s.field).toHaveLength(18);
    let sawFinal = false;
    for (let i = 0; i < 600 && !s.finished; i++) {
      s = playHand(s, rnd);
      expect(chips(s)).toBeCloseTo(27 * 1500, 4);
      expect(s.remaining).toBe(s.table.filter((p) => !p.out).length + s.field.length);
      if (s.field.length === 0) sawFinal = true;
    }
    expect(s.finished).toBe(true);
    if (s.table[0]!.place! <= 9) expect(sawFinal).toBe(true);
    expect(s.heroPrize).toBe(MTT_PAYOUTS[s.table[0]!.place! - 1] ?? 0);
  });
});
