// Math drills (D-062): generated problems with worked solutions. Every number in a problem and
// its solution is computed here (or by the engine), never typed.

import { combosOf, DECK } from '../../lessons/widgets/cards';
import { t, type MessageKey } from '../../../lib/i18n';
import { texture } from '../postflop/features';

export type MathDrillId = 'potodds' | 'outs' | 'equity' | 'mdf' | 'bluff' | 'combos' | 'texture' | 'reading';

export const MATH_DRILLS: { id: MathDrillId }[] = [{ id: 'potodds' }, { id: 'mdf' }, { id: 'bluff' }, { id: 'outs' }, { id: 'equity' }, { id: 'combos' }, { id: 'texture' }, { id: 'reading' }];

/** What a problem needs from the engine (the worker in the app, WASM directly in tests). */
export type Engine = {
  outs(hero: string, villain: string, board: string): Promise<{ behindNow: boolean; ahead: string[]; tied: string[]; behind: string[] }>;
  equity(a: string, b: string, board: string): Promise<number>;
};

/** One worked-solution step: a message key and its numbers (rendered through i18n). */
export type Step = { key: string; params: Record<string, string | number> };

export type MathProblem = {
  drill: MathDrillId;
  prompt: Step;
  /** percent: answer is a share (0–1), accepted within ±1 point; count: exact; choice: index. */
  kind: 'percent' | 'count' | 'choice';
  answer: number;
  choices?: string[];
  steps: Step[];
  /** Cards to show with the problem. */
  cards?: { hero?: string; villain?: string; board?: string; known?: string };
  /** Raw numbers, for tests and the coach. */
  facts: Record<string, number | string>;
};

export const PERCENT_TOLERANCE = 0.01;

const pick = <T,>(xs: readonly T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)]!;
const pctText = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const half = (x: number) => Math.round(x * 2) / 2;
const FRACTIONS = [1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 3 / 2, 2];

function potAndBet(rnd: () => number) {
  const pot = 4 + Math.floor(rnd() * 37);
  const bet = Math.max(0.5, half(pot * pick(FRACTIONS, rnd)));
  return { pot, bet };
}

function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Equity bands for the estimation drill (upper bounds). */
export const EQUITY_BANDS = [0.2, 0.35, 0.45, 0.55, 0.65, 0.8, 1.0001];
export const bandLabel = (k: number) => `${k === 0 ? 0 : Math.round(EQUITY_BANDS[k - 1]! * 100)}–${Math.min(100, Math.round(EQUITY_BANDS[k]! * 100))}%`;
export const bandOf = (eq: number) => EQUITY_BANDS.findIndex((b) => eq < b);

const COMBO_HANDS = ['AA', 'KK', 'QQ', '77', 'AK', 'AKs', 'AKo', 'AQs', 'KQo', 'QJs', 'T9s', 'A5s'];

type Shape = { suits: 1 | 2 | 3; paired: boolean; straight: boolean };
const SUIT_KEY = { 1: 'rainbow', 2: 'twotone', 3: 'monotone' } as const;
/** A flop description from its texture (suits, pairing, connectedness). */
export const describeFlop = (s: Shape) =>
  t('math.texture.desc', {
    suits: t(`math.texture.${SUIT_KEY[s.suits]}` as MessageKey),
    pair: t(s.paired ? 'math.texture.paired' : 'math.texture.unpaired'),
    straight: t(s.straight ? 'math.texture.straight' : 'math.texture.noStraight'),
  });
/** Shapes a flop can have (a paired flop can't be monotone). */
const SHAPES: Shape[] = ([1, 2, 3] as const).flatMap((suits) => [false, true].flatMap((paired) => [false, true].map((straight) => ({ suits, paired, straight })))).filter((s) => !(s.paired && s.suits === 3));
const RANK_ORDER = 'AKQJT98765432';

export async function generate(drill: MathDrillId, rnd: () => number, engine: Engine): Promise<MathProblem> {
  switch (drill) {
    case 'potodds': {
      const { pot, bet } = potAndBet(rnd);
      const final = pot + 2 * bet;
      const answer = bet / final;
      return {
        drill,
        kind: 'percent',
        answer,
        prompt: { key: 'math.potodds.q', params: { pot, bet } },
        steps: [
          { key: 'math.potodds.s1', params: { pot, bet, final } },
          { key: 'math.potodds.s2', params: { bet, final, answer: pctText(answer) } },
        ],
        facts: { pot, bet, final, answer },
      };
    }
    case 'mdf': {
      const { pot, bet } = potAndBet(rnd);
      const answer = pot / (pot + bet);
      return {
        drill,
        kind: 'percent',
        answer,
        prompt: { key: 'math.mdf.q', params: { pot, bet } },
        steps: [
          { key: 'math.mdf.s1', params: { pot, bet, alpha: pctText(bet / (pot + bet)) } },
          { key: 'math.mdf.s2', params: { pot, bet, answer: pctText(answer) } },
        ],
        facts: { pot, bet, answer },
      };
    }
    case 'bluff': {
      const { pot, bet } = potAndBet(rnd);
      const answer = bet / (pot + 2 * bet);
      return {
        drill,
        kind: 'percent',
        answer,
        prompt: { key: 'math.bluff.q', params: { pot, bet } },
        steps: [
          { key: 'math.bluff.s1', params: { pot, bet, price: pctText(answer) } },
          { key: 'math.bluff.s2', params: { answer: pctText(answer), value: pctText(1 - answer), ratio: ((pot + bet) / bet).toFixed(1) } },
        ],
        facts: { pot, bet, answer },
      };
    }
    case 'combos': {
      const hand = pick(COMBO_HANDS, rnd);
      // Known cards: often one of the hand's ranks, so card removal matters.
      const ranks = [hand[0]!, hand[1]!];
      const known: string[] = [];
      const n = 1 + Math.floor(rnd() * 3);
      while (known.length < n) {
        const pool = rnd() < 0.6 ? DECK.filter((c) => ranks.includes(c[0]!)) : DECK;
        const c = pick(pool, rnd);
        if (!known.includes(c)) known.push(c);
      }
      const all = combosOf(hand);
      const left = all.filter((c) => !known.some((k) => c.includes(k)));
      return {
        drill,
        kind: 'count',
        answer: left.length,
        prompt: { key: 'math.combos.q', params: { hand, known: known.join(' ') } },
        steps: [
          { key: 'math.combos.s1', params: { hand, total: all.length } },
          { key: 'math.combos.s2', params: { removed: all.length - left.length, left: left.length } },
        ],
        cards: { known: known.join('') },
        facts: { hand, total: all.length, left: left.length },
      };
    }
    case 'outs': {
      for (let attempt = 0; attempt < 200; attempt++) {
        const deck = shuffle(DECK, rnd);
        const hero = deck.slice(0, 2).join('');
        const villain = deck.slice(2, 4).join('');
        const board = deck.slice(4, 7).join('');
        const o = await engine.outs(hero, villain, board);
        if (!o.behindNow || o.ahead.length < 4 || o.ahead.length > 15) continue;
        const eq = await engine.equity(hero, villain, board);
        const outs = o.ahead.length;
        return {
          drill,
          kind: 'count',
          answer: outs,
          prompt: { key: 'math.outs.q', params: {} },
          steps: [
            { key: 'math.outs.s1', params: { outs, cards: o.ahead.join(' ') } },
            { key: 'math.outs.s2', params: { outs, estimate: `${outs * 4}%` } },
            { key: 'math.outs.s3', params: { exact: pctText(eq) } },
          ],
          cards: { hero, villain, board },
          facts: { outs, exact: eq, estimate: outs * 0.04 },
        };
      }
      throw new Error('could not deal a drawing hand');
    }
    case 'equity': {
      const deck = shuffle(DECK, rnd);
      const hero = deck.slice(0, 2).join('');
      const villain = deck.slice(2, 4).join('');
      const eq = await engine.equity(hero, villain, '');
      const band = bandOf(eq);
      // Four neighbouring bands that include the right one.
      const first = Math.max(0, Math.min(EQUITY_BANDS.length - 4, band - Math.floor(rnd() * 4)));
      const options = [first, first + 1, first + 2, first + 3];
      return {
        drill,
        kind: 'choice',
        answer: options.indexOf(band),
        choices: options.map(bandLabel),
        prompt: { key: 'math.equity.q', params: {} },
        steps: [{ key: 'math.equity.s1', params: { exact: pctText(eq), band: bandLabel(band) } }],
        cards: { hero, villain },
        facts: { exact: eq, band },
      };
    }
    case 'texture': {
      const board = shuffle(DECK, rnd).slice(0, 3);
      const tex = texture(board);
      const right: Shape = { suits: tex.maxSuit as 1 | 2 | 3, paired: tex.paired, straight: tex.straightPossible };
      const same = (a: Shape, b: Shape) => a.suits === b.suits && a.paired === b.paired && a.straight === b.straight;
      const options = shuffle([right, ...shuffle(SHAPES.filter((s) => !same(s, right)), rnd).slice(0, 3)], rnd);
      const answer = options.findIndex((s) => same(s, right));
      return {
        drill,
        kind: 'choice',
        answer,
        choices: options.map(describeFlop),
        prompt: { key: 'math.texture.q', params: {} },
        steps: [
          { key: tex.maxSuit === 3 ? 'math.texture.s.monotone' : tex.maxSuit === 2 ? 'math.texture.s.twotone' : 'math.texture.s.rainbow', params: {} },
          { key: tex.paired ? 'math.texture.s.paired' : 'math.texture.s.unpaired', params: {} },
          { key: tex.straightPossible ? 'math.texture.s.straight' : 'math.texture.s.noStraight', params: {} },
        ],
        cards: { board: board.join('') },
        facts: { suits: tex.maxSuit, paired: String(tex.paired), straight: String(tex.straightPossible) },
      };
    }
    case 'reading': {
      for (let attempt = 0; attempt < 200; attempt++) {
        const deck = shuffle(DECK, rnd);
        const board = deck.slice(0, 3);
        const hero = deck.slice(3, 5);
        const ranks = [...new Set(board.map((c) => c[0]!))].sort((a, b) => RANK_ORDER.indexOf(a) - RANK_ORDER.indexOf(b));
        if (ranks.length < 3) continue;
        const [top, mid, low] = ranks as [string, string, string];
        const kicker = top === 'A' ? 'K' : 'A';
        const over = RANK_ORDER[Math.max(0, RANK_ORDER.indexOf(top) - 1)]!;
        // Hands an opponent might bet with here: sets, two pair, top pair with a top kicker, an overpair.
        const candidates = [...new Set([top + top, mid + mid, low + low, top + mid, top + low, kicker + top, ...(over !== top ? [over + over] : [])])];
        const [a, b] = shuffle(candidates, rnd) as [string, string];
        const known = [...board, ...hero];
        const left = (h: string) => combosOf(h).filter((c) => !known.some((k) => c.includes(k))).length;
        const na = left(a);
        const nb = left(b);
        if (na === 0 && nb === 0) continue;
        const answer = na > nb ? 0 : nb > na ? 1 : 2;
        return {
          drill,
          kind: 'choice',
          answer,
          choices: [a, b, t('math.reading.same')],
          prompt: { key: 'math.reading.q', params: { a, b } },
          steps: [
            { key: 'math.reading.s1', params: { hand: a, total: combosOf(a).length, left: na } },
            { key: 'math.reading.s1', params: { hand: b, total: combosOf(b).length, left: nb } },
            { key: answer === 2 ? 'math.reading.s2same' : 'math.reading.s2', params: { more: answer === 1 ? b : a, ratio: (Math.max(na, nb) / Math.max(1, Math.min(na, nb))).toFixed(1) } },
          ],
          cards: { hero: hero.join(''), board: board.join('') },
          facts: { a, b, na, nb },
        };
      }
      throw new Error('could not deal a reading problem');
    }
  }
}

/** Is the typed answer right? Percent answers accept "25", "25%" or "0.25" within ±1 point. */
export function check(p: MathProblem, input: string): boolean {
  if (p.kind === 'choice') return Number(input) === p.answer;
  const raw = input.trim().replace(',', '.');
  if (!raw) return false;
  const v = Number(raw.replace('%', ''));
  if (!Number.isFinite(v)) return false;
  if (p.kind === 'count') return v === p.answer;
  const share = raw.endsWith('%') || v > 1 ? v / 100 : v;
  return Math.abs(share - p.answer) <= PERCENT_TOLERANCE + 1e-12;
}
