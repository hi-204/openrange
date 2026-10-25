// The postflop claims in Level 4, checked by solving the lesson spots and computing exact
// range-vs-range equities (docs/LESSON_REVIEW.md cites this test). Hands are grouped the way the
// lessons describe them: on the flop and turn by made hand (two pair or better, one pair, a
// straight or flush draw, nothing); on the river by equity against the other player's range
// at that node (strong ≥ 75 in 100, medium 35–75, weak below 35).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import FACTS_JSON from '../../content/en/facts.json';
import { equity, evaluateHand, initSync, Solver } from '../../../public/wasm/solver_wasm.js';
import { toySpot } from './widgets/gamesMath';
import type { ComboEquity, SolverInfo, SolverNode, SpotJson } from '../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../solver/spotForm';
import { DRILL_SPOTS } from '../trainer/postflop/spots';
import { rangeSummary } from '../trainer/postflop/features';
import { DECK } from './widgets/cards';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
const FACTS = FACTS_JSON as Record<string, number>;

type Solved = { info: SolverInfo; node: (path: number[]) => SolverNode & { kind: 'action' }; evBb: [number, number]; free: () => void };
function solve(spot: SpotJson, target: number, maxIterations: number): Solved {
  const s = new Solver(JSON.stringify(spot), 1.5e9, false);
  let report: { pctPot: number; evBb: [number, number] };
  let it = 0;
  do {
    s.step(25);
    it += 25;
    report = JSON.parse(s.exploitability());
  } while (report.pctPot > target && it < maxIterations);
  expect(report.pctPot, 'solved to its target').toBeLessThanOrEqual(target);
  return {
    info: JSON.parse(s.info()) as SolverInfo,
    node: (path) => JSON.parse(s.node(JSON.stringify(path))),
    evBb: report.evBb,
    free: () => s.free(),
  };
}
const drill = (id: string) => DRILL_SPOTS.find((d) => d.id === id)!;
// The app's worker checks the target in batches and often ends well below it, so the river and
// turn claims are checked on tighter solves too (cheap); the slow flop uses its own target.
const solveDrill = (id: string) => {
  const d = drill(id);
  return d.street === 'flop' ? solve(d.spot, d.target, d.maxIterations) : solve(d.spot, 0.05, 5000);
};

const ev = (cards: string) => JSON.parse(evaluateHand(cards)) as { categoryIndex: number; strength: number };
const boardOf = (n: SolverNode) => n.board.join('');
/** Made-hand group on the flop or turn. */
function group(hand: string, board: string): 'strong' | 'pair' | 'draw' | 'nothing' {
  const i = ev(hand + board).categoryIndex;
  if (i >= 2) return 'strong';
  if (i === 1) return 'pair';
  const seen = new Set([hand.slice(0, 2), hand.slice(2), ...board.match(/../g)!]);
  const hits = DECK.filter((c) => !seen.has(c) && ev(hand + board + c).categoryIndex >= 4).length;
  return hits >= 4 ? 'draw' : 'nothing';
}
const overlap = (a: string, b: string) => [a.slice(0, 2), a.slice(2)].some((c) => b.includes(c));
/** River group by equity against the other player's reach at this node. */
function riverGroups(sv: Solved, n: SolverNode, player: 0 | 1): ('strong' | 'medium' | 'weak' | null)[] {
  const board = boardOf(n);
  const opp = sv.info.hands[1 - player]!;
  const reach = n.reach[1 - player]!;
  const so = opp.map((h) => ev(h + board).strength);
  return sv.info.hands[player]!.map((h) => {
    const x = ev(h + board).strength;
    let w = 0;
    let e = 0;
    opp.forEach((o, j) => {
      if (overlap(h, o) || !reach[j]) return;
      w += reach[j]!;
      e += reach[j]! * (x > so[j]! ? 1 : x === so[j]! ? 0.5 : 0);
    });
    if (!w) return null;
    const q = e / w;
    return q >= 0.75 ? 'strong' : q >= 0.35 ? 'medium' : 'weak';
  });
}
/** Share of the acting player's reach (optionally only hands in `keep`) taking action k. */
function freq(sv: Solved, n: SolverNode & { kind: 'action' }, k: number, keep: (h: number) => boolean = () => true) {
  const hands = sv.info.hands[n.player]!;
  const H = hands.length;
  const r = n.reach[n.player];
  let tot = 0;
  let a = 0;
  for (let h = 0; h < H; h++) {
    if (!keep(h)) continue;
    tot += r[h]!;
    a += r[h]! * n.strategy[k * H + h]!;
  }
  return a / tot;
}
/** Of the hands taking action k, the share in `keep`. */
function composition(sv: Solved, n: SolverNode & { kind: 'action' }, k: number, keep: (h: number) => boolean) {
  const hands = sv.info.hands[n.player]!;
  const H = hands.length;
  const r = n.reach[n.player];
  let tot = 0;
  let a = 0;
  for (let h = 0; h < H; h++) {
    const x = r[h]! * n.strategy[k * H + h]!;
    tot += x;
    if (keep(h)) a += x;
  }
  return a / tot;
}
const handsOf = (sv: Solved, player: 0 | 1, cls: string) => {
  const [a, b, s] = [cls[0]!, cls[1]!, cls[2]];
  return (h: number) => {
    const c = sv.info.hands[player]![h]!;
    const ranks = [c[0], c[2]].sort().join('');
    if (ranks !== [a, b].sort().join('')) return false;
    if (s === 's') return c[1] === c[3];
    if (s === 'o') return c[1] !== c[3];
    return true;
  };
};
const rvr = (a: string, b: string, board: string) => {
  const r = JSON.parse(equity(JSON.stringify({ ranges: [a, b], board, dead: '', mode: 'exact' }))) as { players: { perCombo: ComboEquity[] }[] };
  return r.players.map((p) => ({ ...rangeSummary(p.perCombo, 0.85), middle: p.perCombo.reduce((s, c) => s + (c.equity > 0.35 && c.equity < 0.65 ? c.weight : 0), 0) / p.perCombo.reduce((s, c) => s + c.weight, 0), perCombo: p.perCombo }));
};
const OPEN = '77+, ATs+, KJs+, QJs, AJo+, KQo';
const CALL = '22-99, A2s-AJs, KTs+, QTs+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo-AQo, KJo+';

describe('Level 4 range-vs-range claims (exact equities)', () => {
  it('4.1: on Qs Jh 4d range A has more equity and more very strong hands', () => {
    const [a, b] = rvr('TT+, AJs+, KQs, AQo+', '88+, ATs+, KJs+, QJs, JTs, AJo+', 'QsJh4d');
    expect(a!.equity).toBeGreaterThan(b!.equity);
    expect(a!.nutShare).toBeGreaterThan(b!.nutShare);
  });

  it('4.2: wet boards put more hands in the middle; paired boards cut the opener\'s strong hands', () => {
    const dry = rvr(OPEN, CALL, 'Ks7d2c');
    const wet = rvr(OPEN, CALL, 'JhTh9s');
    const paired = rvr(OPEN, CALL, '8s8d3c');
    for (const p of [0, 1]) expect(wet[p]!.middle, `player ${p}`).toBeGreaterThan(dry[p]!.middle);
    expect(paired[0]!.nutShare).toBeLessThan(dry[0]!.nutShare / 2);
    const aa = (b: string) => FACTS[`AsAd vs ${CALL} on ${b}`]!;
    expect(aa('Ks7d2c') - aa('JhTh9s')).toBeGreaterThan(0.1);
  });

  it('4.3: on A-K-3 the opener has both advantages; on 7-6-5 they split', () => {
    const [ra, ca] = rvr(OPEN, CALL, 'AsKd3c');
    expect(ra!.equity).toBeGreaterThan(ca!.equity);
    expect(ra!.nutShare).toBeGreaterThan(ca!.nutShare);
    const [r7, c7] = rvr(OPEN, CALL, '7s6d5c');
    expect(r7!.equity).toBeGreaterThan(c7!.equity);
    expect(c7!.nutShare).toBeGreaterThan(r7!.nutShare);
    // The caller's very strong hands there are sets of sevens, sixes and fives, and 9-8.
    const strong = new Set(c7!.perCombo.filter((c) => c.equity >= 0.85).map((c) => [c.combo[0], c.combo[2]].sort().join('')));
    expect([...strong].sort()).toEqual(['55', '66', '77', '89'].sort());
    // Worked hand: QQ is ahead of most of the caller's range there.
    expect(JSON.parse(equity(JSON.stringify({ ranges: ['QsQd', CALL], board: '7s6d5c', dead: '', mode: 'exact' }))).players[0].equity).toBeGreaterThan(0.55);
  });
});

describe('Level 4 solver claims', () => {
  it('4.1: the stronger range bets almost everything small on Qs Jh 4d', { timeout: 300_000 }, () => {
    const sv = solveDrill('flop-qj4');
    const n = sv.node([]);
    expect(n.player).toBe(0);
    expect(n.actions).toEqual(['Check', 'Bet 1.98']);
    expect(freq(sv, n, 1)).toBeGreaterThan(0.85);
    const board = boardOf(n);
    for (const g of ['strong', 'pair', 'draw'] as const) expect(freq(sv, n, 1, (h) => group(sv.info.hands[0]![h]!, board) === g), g).toBeGreaterThan(0.8);
    expect(freq(sv, n, 1, handsOf(sv, 0, 'AKo'))).toBeGreaterThan(0.8); // worked hand
    const facing = sv.node([1]);
    expect(facing.actions[0]).toBe('Fold');
    expect(freq(sv, facing, 0)).toBeLessThan(0.3);
    sv.free();
  });

  it('4.4: the same range wins more of its equity in position', () => {
    const turn = toSpot(PRESETS.turn);
    for (const board of ['Qs Jh 7d 4c', 'Kh Th 6h 3s']) {
      const A = turn.ranges.oop;
      const B = turn.ranges.ip;
      const realize = (oop: string, ip: string) => {
        const spot = { ...turn, board, ranges: { oop, ip } };
        const sv = solve(spot, 0.5, 500);
        const e = (JSON.parse(equity(JSON.stringify({ ranges: [oop, ip], board, dead: '', mode: 'exact' }))) as { players: { equity: number }[] }).players[0]!.equity;
        sv.free();
        return { oop: sv.evBb[0] / turn.pot / e, ip: sv.evBb[1] / turn.pot / (1 - e) };
      };
      const aOop = realize(A, B);
      const aIp = realize(B, A);
      expect(aIp.ip, `${board}: A`).toBeGreaterThan(aOop.oop);
      expect(aOop.ip, `${board}: B`).toBeGreaterThan(aIp.oop);
      if (board === 'Qs Jh 7d 4c') {
        expect(aOop.oop).toBeGreaterThan(1); // the stronger range wins a little more than its equity OOP
        expect(aIp.ip - aOop.oop).toBeGreaterThan(0.05); // and clearly more IP
        expect(aOop.ip).toBeLessThan(1); // the weaker range wins less than its equity either way
        expect(aIp.oop).toBeLessThan(aOop.ip - 0.05); // much less out of position
      }
    }
  });

  for (const id of ['turn-qj74', 'turn-kt63']) {
    it(`4.6, 4.7, 4.8: ${id}`, () => {
      const sv = solveDrill(id);
      const r = sv.node([]);
      expect(r.actions).toEqual(['Check', 'Bet 6.6']);
      const board = boardOf(r);
      const g0 = sv.info.hands[0]!.map((h) => group(h, board));
      const g1 = sv.info.hands[1]!.map((h) => group(h, board));
      const is = (gs: string[], g: string) => (h: number) => gs[h] === g;
      // 4.7: some of the strongest hands check.
      const strongCheck = freq(sv, r, 0, is(g0, 'strong'));
      const [lo, hi] = id === 'turn-qj74' ? [0.15, 0.35] : [0.3, 0.5]; // "about a quarter" / "about two in five"
      expect(strongCheck).toBeGreaterThan(lo);
      expect(strongCheck).toBeLessThan(hi);
      const afterCheck = sv.node([0]);
      expect(afterCheck.actions).toEqual(['Check', 'Bet 5', 'Bet 10']);
      expect(1 - freq(sv, afterCheck, 0, is(g1, 'strong'))).toBeGreaterThan(0.8); // IP bets its strong hands
      // 4.6: facing a pot-sized bet after checking.
      const cr = sv.node([0, 2]);
      expect(cr.actions).toEqual(['Fold', 'Call', 'Raise 40']);
      expect(freq(sv, cr, 0, is(g0, 'strong'))).toBeLessThan(0.01);
      const strongRaise = freq(sv, cr, 2, is(g0, 'strong'));
      expect(strongRaise).toBeGreaterThan(0.35);
      expect(strongRaise).toBeLessThan(0.7);
      expect(freq(sv, cr, 2, is(g0, 'pair'))).toBeLessThan(0.05);
      expect(freq(sv, cr, 0, is(g0, 'draw'))).toBeGreaterThan(0.7);
      expect(freq(sv, cr, 2, is(g0, 'draw'))).toBeGreaterThan(0);
      const parts = ['strong', 'pair', 'draw'].map((g) => composition(sv, cr, 2, is(g0, g)));
      expect(parts[0]!).toBeGreaterThan(Math.max(parts[1]!, parts[2]!)); // strong hands are the largest group of raises
      if (id === 'turn-qj74') {
        // Draws split by strength: the open-ended T9s mostly raises, the gutshot A-K mostly folds.
        expect(freq(sv, cr, 2, handsOf(sv, 0, 'T9s'))).toBeGreaterThan(0.6); // worked hand 4.6
        expect(freq(sv, cr, 0, handsOf(sv, 0, 'AK'))).toBeGreaterThan(0.75);
        expect(g0.filter((g, h) => g === 'draw' && handsOf(sv, 0, 'AK')(h)).length).toBeGreaterThan(0); // A-K counts as a draw
        const qj = handsOf(sv, 0, 'QJs');
        expect(freq(sv, r, 0, qj)).toBeGreaterThan(0.1); // worked hand 4.7: QJs both checks…
        expect(freq(sv, r, 0, qj)).toBeLessThan(0.9); // …and bets
        // 4.8: draws bet more often than one-pair hands.
        expect(freq(sv, r, 1, is(g0, 'draw'))).toBeGreaterThan(freq(sv, r, 1, is(g0, 'pair')));
      }
      sv.free();
    });
  }

  it('4.8, 4.9: river sizes, range shapes and defence', () => {
    const sv = solveDrill('river-qj742');
    const r = sv.node([]);
    expect(r.actions).toEqual(['Check', 'Bet 3.3', 'Bet 7.5', 'Bet 15']);
    const g = riverGroups(sv, r, 0);
    const is = (x: string) => (h: number) => g[h] === x;
    expect(composition(sv, r, 1, is('medium'))).toBeGreaterThan(0.4); // small bet: merged
    for (const k of [2, 3]) expect(composition(sv, r, k, is('medium')), `size ${k}`).toBeLessThan(0.05); // big bets: polarized
    expect(freq(sv, r, 2, is('medium')) + freq(sv, r, 3, is('medium'))).toBeLessThan(0.02); // medium hands check or bet small
    // Worked hand 4.9: strong hands split between the small bet, three quarters and checking; rarely overbet.
    for (const k of [0, 1, 2]) expect(freq(sv, r, k, is('strong')), `strong uses action ${k}`).toBeGreaterThan(0.15);
    expect(freq(sv, r, 3, is('strong'))).toBeLessThan(0.1);
    const pot = r.pot;
    let lastFold = 0;
    for (const [k, bet] of [[1, 3.3], [2, 7.5], [3, 15]] as const) {
      const f = sv.node([k]);
      expect(f.actions[0]).toBe('Fold');
      const fold = freq(sv, f, 0);
      expect(fold, `bet ${bet}`).toBeGreaterThan(lastFold); // bigger bets get more folds
      lastFold = fold;
      const mdf = pot / (pot + bet);
      expect(Math.abs(1 - fold - mdf), `defence vs MDF at ${bet}`).toBeLessThan(0.06);
      const gf = riverGroups(sv, f, 1);
      if (k === 1) expect(freq(sv, f, 1, (h) => gf[h] === 'medium')).toBeGreaterThan(0.95); // medium hands call the small bet
      if (k === 3) expect(freq(sv, f, 0, (h) => gf[h] === 'medium')).toBeGreaterThan(0.5); // and fold over half to the biggest
    }
    sv.free();
  });
});

describe('Level 5 solver claims', () => {
  it('5.4: J♦T♦ is medium and bets small; K♥Q♦ is strong here and bets three quarters', () => {
    const sv = solveDrill('river-qj742');
    const r = sv.node([]);
    const g = riverGroups(sv, r, 0);
    const find = (c: string) => sv.info.hands[0]!.findIndex((h) => h === c || h === c.slice(2) + c.slice(0, 2));
    const jt = find('JdTd');
    const kq = find('KhQd');
    expect(g[jt]).toBe('medium');
    expect(freq(sv, r, 1, (h) => h === jt)).toBeGreaterThan(0.9);
    expect(freq(sv, r, 2, (h) => h === jt) + freq(sv, r, 3, (h) => h === jt)).toBeLessThan(0.05);
    expect(g[kq]).toBe('strong');
    const kq75 = freq(sv, r, 2, (h) => h === kq);
    expect(kq75).toBeGreaterThan(0.5); // "about two times in three"
    expect(kq75).toBeLessThan(0.8);
    sv.free();
  });

  it('5.5: on a three-heart river, high-card hands with a heart bluff over twice as often', () => {
    const sv = solveDrill('river-k9472');
    const r = sv.node([]);
    expect(r.actions).toEqual(['Check', 'Bet 3.3', 'Bet 7.5', 'Bet 15']);
    const board = boardOf(r);
    const hands = sv.info.hands[0]!;
    const highCard = (h: number) => ev(hands[h]! + board).categoryIndex === 0;
    const heart = (h: number) => hands[h]![1] === 'h' || hands[h]![3] === 'h';
    const bet = (k: number[], keep: (h: number) => boolean) => k.reduce((a, x) => a + freq(sv, r, x, keep), 0);
    const withHeart = (h: number) => highCard(h) && heart(h);
    const without = (h: number) => highCard(h) && !heart(h);
    expect(bet([1, 2, 3], withHeart)).toBeGreaterThan(2 * bet([1, 2, 3], without));
    expect(bet([2], withHeart)).toBeGreaterThan(2 * bet([2], without));
    // Worked hand: queen-jack with the queen of hearts bets more than without a heart.
    const one = (c: string) => (h: number) => hands[h] === c || hands[h] === c.slice(2) + c.slice(0, 2);
    expect(bet([1, 2, 3], one('QhJc'))).toBeGreaterThan(bet([1, 2, 3], one('QsJc')));
    sv.free();
  });

  it('5.5: on the dry river, weak hands with no showdown value bluff more than weak hands with some', () => {
    const sv = solveDrill('river-qj742');
    const r = sv.node([]);
    const board = boardOf(r);
    const opp = sv.info.hands[1]!;
    const so = opp.map((h) => ev(h + board).strength);
    const eqOf = sv.info.hands[0]!.map((h) => {
      const x = ev(h + board).strength;
      let w = 0;
      let e = 0;
      opp.forEach((o, j) => {
        const rr = r.reach[1]![j]!;
        if (!rr || overlap(h, o)) return;
        w += rr;
        e += rr * (x > so[j]! ? 1 : x === so[j]! ? 0.5 : 0);
      });
      return e / w;
    });
    const betAny = (keep: (h: number) => boolean) => 1 - freq(sv, r, 0, keep);
    expect(betAny((h) => eqOf[h]! < 0.05)).toBeGreaterThan(betAny((h) => eqOf[h]! >= 0.1 && eqOf[h]! < 0.25));
    sv.free();
  });
});

const ANY = '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o';
const shares = (sv: Solved, n: SolverNode & { kind: 'action' }) => n.actions.map((_, k) => freq(sv, n, k));

describe('Level 7 solver claims', () => {
  it('7.1, 7.2: on the river the first player checks about half, bets small most, overbets rarely', () => {
    const sv = solveDrill('river-qj742');
    const s = shares(sv, sv.node([]));
    expect(s[0]!).toBeGreaterThan(0.4);
    expect(s[0]!).toBeLessThan(0.6);
    expect(s[1]!).toBeGreaterThan(s[2]!);
    expect(s[2]!).toBeGreaterThan(s[3]!);
    expect(s[1]!).toBeGreaterThan(s[2]! + s[3]!); // "mostly bets small when it bets"
    expect(s[3]!).toBeLessThan(0.05);
    sv.free();
  });

  for (const id of ['turn-qj74', 'turn-kt63']) {
    it(`7.2: after a check on ${id}, the pot-sized bet is used more, for strong hands and draws`, () => {
      const sv = solveDrill(id);
      const n = sv.node([0]);
      expect(n.actions).toEqual(['Check', 'Bet 5', 'Bet 10']);
      const s = shares(sv, n);
      expect(s[2]!).toBeGreaterThan(2 * s[1]!);
      const g = sv.info.hands[1]!.map((h) => group(h, boardOf(n)));
      expect(composition(sv, n, 2, (h) => g[h] === 'strong' || g[h] === 'draw')).toBeGreaterThan(0.6);
      const strong = (h: number) => g[h] === 'strong';
      expect(freq(sv, n, 2, strong)).toBeGreaterThan(0.7);
      sv.free();
    });
  }

  it('7.3: with half a pot behind, all-in is common and medium hands bet more than deep', () => {
    const deep = solveDrill('river-qj742');
    const short = solveDrill('river-qj742-short');
    const rs = short.node([]);
    expect(rs.actions).toEqual(['Check', 'Bet 3.3', 'All-in 5']);
    expect(freq(short, rs, 2)).toBeGreaterThan(0.3);
    const medium = (sv: Solved) => {
      const n = sv.node([]);
      const g = riverGroups(sv, n, 0);
      return 1 - freq(sv, n, 0, (h) => g[h] === 'medium');
    };
    expect(medium(short) - medium(deep)).toBeGreaterThan(0.1);
    deep.free();
    short.free();
  });

  it('7.5: fewer sizes change the strategy a lot and the EV a little; more options never lower EV', () => {
    const base = drill('river-qj742').spot;
    const withSizes = (oop: string) => ({ ...base, sizes: { ...base.sizes, river: { ...base.sizes.river!, oop: { ...base.sizes.river!.oop, bet: oop } } } });
    const all = solve(base, 0.05, 5000);
    const only75 = solve(withSizes('75'), 0.05, 5000);
    const only33 = solve(withSizes('33'), 0.05, 5000);
    // Equilibrium EVs (each within its exploitability): the superset is at least as good.
    const slack = (0.05 / 100) * 10;
    expect(all.evBb[0]).toBeGreaterThan(only75.evBb[0] - slack);
    expect(all.evBb[0]).toBeGreaterThan(only33.evBb[0] - slack);
    expect(all.evBb[0] - Math.min(only75.evBb[0], only33.evBb[0])).toBeLessThan(0.02 * 10); // "a small share of the pot"
    const medium = (sv: Solved) => {
      const n = sv.node([]);
      const g = riverGroups(sv, n, 0);
      return 1 - freq(sv, n, 0, (h) => g[h] === 'medium');
    };
    expect(medium(all) - medium(only75)).toBeGreaterThan(0.2); // "far fewer medium hands bet"
    for (const sv of [all, only75, only33]) sv.free();
  });

  it('7.7: after ten iterations the toy game is several points off; it settles later', () => {
    const run = (its: number) => {
      const s = new Solver(JSON.stringify(toySpot(10, 75, 1)), 1e9, false);
      s.step(its);
      const info = JSON.parse(s.info()) as SolverInfo;
      const f = JSON.parse(s.node('[1]')) as SolverNode & { kind: 'action' };
      const H = info.hands[1]!.length;
      let c = 0;
      let t = 0;
      info.hands[1]!.forEach((_, i) => {
        t += f.reach[1]![i]!;
        c += f.reach[1]![i]! * f.strategy[H + i]!;
      });
      s.free();
      return c / t;
    };
    const mdf = 10 / 17.5;
    expect(Math.abs(run(10) - mdf)).toBeGreaterThan(0.03);
    expect(Math.abs(run(3000) - mdf)).toBeLessThan(0.002);
  });

  it('7.4: A-A loses a lot of equity to a second opponent but stays far above a third; 8-7 suited drops to about a third', () => {
    const mc = (ranges: string[]) =>
      (JSON.parse(equity(JSON.stringify({ ranges, board: '', dead: '', mode: 'montecarlo', seed: 3, samples: 400000 }))) as { players: { equity: number; stdError: number }[] }).players[0]!;
    const aa2 = mc(['AsAd', ANY]);
    const aa3 = mc(['AsAd', ANY, ANY]);
    expect(aa2.equity - aa3.equity).toBeGreaterThan(0.08);
    expect(aa3.equity).toBeGreaterThan(0.6);
    const sc2 = mc(['8h7h', ANY]);
    const sc3 = mc(['8h7h', ANY, ANY]);
    expect(sc2.equity).toBeLessThan(0.5);
    expect(sc2.equity).toBeGreaterThan(0.45); // "a little under half"
    expect(Math.abs(sc3.equity - 1 / 3)).toBeLessThan(0.02); // "about a fair third"
  });
});
