// Math Lab drills (D-087): multi-part problems with worked solutions. Every number in a problem
// and its solution is computed here from the problem's inputs or by the engine, never typed.
// Problem inputs (pot, bet, fold share, …) are random; they are not strategy claims.

import { combosOf, DECK } from '../lessons/widgets/cards';
import { t, type MessageKey } from '../../lib/i18n';
import type { Step } from '../trainer/math/drills';

export type LabDrillId = 'potdecision' | 'rule24' | 'estimate' | 'ev' | 'implied' | 'blockers' | 'spr';
export const LAB_DRILLS: LabDrillId[] = ['potdecision', 'rule24', 'estimate', 'ev', 'implied', 'blockers', 'spr'];

/** What the drills need from the engine (the worker in the app, WASM directly in tests). */
export type LabEngine = {
  /** Exact equity of `hero` (a hand or range) against `villain` (a hand or range) on `board`. */
  equity(hero: string, villain: string, board: string): Promise<number>;
  outs(hero: string, villain: string, board: string): Promise<{ behindNow: boolean; ahead: string[]; tied: string[]; behind: string[] }>;
  /** Hand category index (0 = high card … 8 = straight flush) of 5–7 cards. */
  category(cards: string): Promise<number>;
};

/**
 * One answer the learner gives. percent: a share (0–1) within `tolerance` (default one point);
 * count: exact; bb / number: within `tolerance`; choice: an index, any of `accept` counts as right
 * (close decisions accept both).
 */
export type Part = {
  prompt: Step;
  kind: 'percent' | 'count' | 'bb' | 'number' | 'choice';
  answer: number;
  tolerance?: number;
  choices?: string[];
  accept?: number[];
};

export type LabProblem = {
  drill: LabDrillId;
  intro: Step;
  parts: Part[];
  /** Worked solution, in order. */
  steps: Step[];
  cards?: { hero?: string; villain?: string; board?: string };
  /** Raw numbers, for tests, the coach and calibration tracking. */
  facts: Record<string, number | string>;
};

export const PERCENT_TOLERANCE = 0.01;
/** Decisions within this many points of break-even accept either answer. */
export const CLOSE = 0.02;
/** An equity estimate within this many points counts as right (the error is always shown). */
export const ESTIMATE_TOLERANCE = 0.05;
/** EV comparisons within this many bb accept either answer. */
export const EV_CLOSE = 0.1;

const pick = <T,>(xs: readonly T[], rnd: () => number): T => xs[Math.floor(rnd() * xs.length)]!;
export const pctText = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const bbText = (x: number) => x.toFixed(2);
const half = (x: number) => Math.round(x * 2) / 2;
const FRACTIONS = [1 / 3, 1 / 2, 2 / 3, 3 / 4, 1, 3 / 2];
const RANKS = 'AKQJT98765432';

function shuffle<T>(xs: readonly T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

const callFold = () => [t('lab.call'), t('lab.fold')];
/** Choice part for "call or fold": either is accepted when the equity is within CLOSE of the price. */
function decision(prompt: Step, equity: number, required: number): Part {
  const answer = equity >= required ? 0 : 1;
  return { prompt, kind: 'choice', answer, choices: callFold(), accept: Math.abs(equity - required) < CLOSE ? [0, 1] : [answer] };
}

/** Distinct board ranks, highest first. */
const boardRanks = (board: string[]) => [...new Set(board.map((c) => c[0]!))].sort((a, b) => RANKS.indexOf(a) - RANKS.indexOf(b));

/**
 * "Top pair or better" on this board, as hand classes: overpairs, sets, two pair of board ranks,
 * and top pair with a ten-or-better kicker. Card removal is left to the engine.
 */
export function valueRange(board: string[]): string {
  const ranks = boardRanks(board);
  const top = ranks[0]!;
  const out = new Set<string>();
  for (const r of RANKS.slice(0, RANKS.indexOf(top))) out.add(r + r);
  for (const r of ranks) out.add(r + r);
  for (let i = 0; i < ranks.length; i++) for (let j = i + 1; j < ranks.length; j++) out.add(ranks[i]! + ranks[j]!);
  for (const k of 'AKQJT') if (k !== top) out.add(RANKS.indexOf(k) < RANKS.indexOf(top) ? k + top : top + k);
  return [...out].join(',');
}

/** "Any pair or better": every pocket pair and every hand containing a board rank. */
export function pairRange(board: string[]): string {
  const ranks = boardRanks(board);
  const out = new Set<string>();
  for (const r of RANKS) out.add(r + r);
  for (const b of ranks) for (const r of RANKS) if (r !== b) out.add(RANKS.indexOf(r) < RANKS.indexOf(b) ? r + b : b + r);
  return [...out].join(',');
}

/** Four to a flush, or four ranks within a five-rank window (open-ended or gutshot). */
export function hasDraw(hero: string[], board: string[]): boolean {
  const cards = [...hero, ...board];
  const suits = new Map<string, number>();
  for (const c of cards) suits.set(c[1]!, (suits.get(c[1]!) ?? 0) + 1);
  if ([...suits.values()].some((n) => n === 4)) return true;
  const vals = new Set(cards.map((c) => 14 - RANKS.indexOf(c[0]!)));
  if (vals.has(14)) vals.add(1);
  for (let lo = 1; lo <= 10; lo++) {
    let n = 0;
    for (let v = lo; v < lo + 5; v++) if (vals.has(v)) n++;
    if (n === 4) return true;
  }
  return false;
}

function potAndBet(rnd: () => number) {
  const pot = 4 + Math.floor(rnd() * 37);
  const bet = Math.max(1, half(pot * pick(FRACTIONS, rnd)));
  return { pot, bet };
}

export async function generateLab(drill: LabDrillId, rnd: () => number, engine: LabEngine): Promise<LabProblem> {
  switch (drill) {
    case 'potdecision': {
      // Facing a bet: the price (required equity), the equity against a stated range, the decision.
      const wantDraw = rnd() < 0.5;
      for (let attempt = 0; attempt < 400; attempt++) {
        const deck = shuffle(DECK, rnd);
        const street = rnd() < 0.5 ? 3 : 4;
        const board = deck.slice(0, street);
        const hero = deck.slice(street, street + 2);
        if (hasDraw(hero, board) !== wantDraw) continue;
        const wide = rnd() < 0.5;
        const range = wide ? pairRange(board) : valueRange(board);
        const eq = await engine.equity(hero.join(''), range, board.join(''));
        if (eq < 0.08 || eq > 0.65) continue;
        const { pot, bet } = potAndBet(rnd);
        const final = pot + 2 * bet;
        const required = bet / final;
        const oneIn = final / bet;
        const rangeKey: MessageKey = wide ? 'lab.range.pair' : 'lab.range.value';
        return {
          drill,
          intro: { key: 'lab.potdecision.intro', params: { pot, bet, range: t(rangeKey), street: t(street === 3 ? 'lab.street.flop' : 'lab.street.turn') } },
          parts: [
            { prompt: { key: 'lab.potdecision.q1', params: {} }, kind: 'percent', answer: required },
            decision({ key: 'lab.potdecision.q2', params: {} }, eq, required),
          ],
          steps: [
            { key: 'lab.potdecision.s1', params: { pot, bet, final, required: pctText(required) } },
            { key: 'lab.potdecision.s2', params: { n: oneIn.toFixed(1) } },
            { key: 'lab.potdecision.s3', params: { equity: pctText(eq), range: t(rangeKey) } },
            { key: Math.abs(eq - required) < CLOSE ? 'lab.potdecision.close' : eq >= required ? 'lab.potdecision.call' : 'lab.potdecision.fold', params: { equity: pctText(eq), required: pctText(required), close: CLOSE * 100 } },
            { key: street === 3 ? 'lab.potdecision.caveatFlop' : 'lab.potdecision.caveatTurn', params: {} },
          ],
          cards: { hero: hero.join(''), board: board.join('') },
          facts: { pot, bet, final, required, equity: eq, draw: String(wantDraw), range: wide ? 'pair' : 'value', street },
        };
      }
      throw new Error('could not deal a pot-odds problem');
    }

    case 'rule24': {
      // Count clean outs against a known hand, estimate with the rule of 2 and 4, compare with exact.
      for (let attempt = 0; attempt < 400; attempt++) {
        const deck = shuffle(DECK, rnd);
        const street = rnd() < 0.6 ? 3 : 4;
        const hero = deck.slice(0, 2);
        const villain = deck.slice(2, 4);
        const board = deck.slice(4, 4 + street);
        const o = await engine.outs(hero.join(''), villain.join(''), board.join(''));
        if (!o.behindNow || o.ahead.length < 3 || o.ahead.length > 15) continue;
        const outs = o.ahead.length;
        // Tainted outs: cards that improve your hand's category but still lose.
        const now = await engine.category([...hero, ...board].join(''));
        const tainted: string[] = [];
        for (const c of o.behind) if ((await engine.category([...hero, ...board, c].join(''))) > now) tainted.push(c);
        const mult = street === 3 ? 4 : 2;
        const estimate = (outs * mult) / 100;
        const exact = await engine.equity(hero.join(''), villain.join(''), board.join(''));
        const error = estimate - exact;
        return {
          drill,
          intro: { key: 'lab.rule24.intro', params: { street: t(street === 3 ? 'lab.street.flop' : 'lab.street.turn') } },
          parts: [
            { prompt: { key: 'lab.rule24.q1', params: {} }, kind: 'count', answer: outs },
            { prompt: { key: 'lab.rule24.q2', params: { mult } }, kind: 'percent', answer: estimate },
          ],
          steps: [
            { key: 'lab.rule24.s1', params: { outs, cards: o.ahead.join(' ') } },
            ...(o.tied.length ? [{ key: 'lab.rule24.tied', params: { n: o.tied.length, cards: o.tied.join(' ') } }] : []),
            ...(tainted.length ? [{ key: 'lab.rule24.tainted', params: { n: tainted.length, cards: tainted.join(' ') } }] : []),
            { key: street === 3 ? 'lab.rule24.s2flop' : 'lab.rule24.s2turn', params: { outs, mult, estimate: pctText(estimate, 0) } },
            { key: 'lab.rule24.s3', params: { exact: pctText(exact), error: `${error >= 0 ? '+' : '−'}${Math.abs(error * 100).toFixed(1)}` } },
          ],
          cards: { hero: hero.join(''), villain: villain.join(''), board: board.join('') },
          facts: { outs, tied: o.tied.length, tainted: tainted.length, estimate, exact, error, street },
        };
      }
      throw new Error('could not deal a drawing hand');
    }

    case 'estimate': {
      // Estimate equity as a number; scored by the absolute error, tracked for calibration.
      const deck = shuffle(DECK, rnd);
      const flop = rnd() < 0.5;
      const hero = deck.slice(0, 2);
      const board = flop ? deck.slice(2, 5) : [];
      const vsRange = flop && rnd() < 0.5;
      const villain = vsRange ? valueRange(board) : deck.slice(5, 7).join('');
      const exact = await engine.equity(hero.join(''), villain, board.join(''));
      return {
        drill,
        intro: { key: vsRange ? 'lab.estimate.introRange' : flop ? 'lab.estimate.introFlop' : 'lab.estimate.intro', params: { range: t('lab.range.value') } },
        parts: [{ prompt: { key: 'lab.estimate.q', params: { tol: ESTIMATE_TOLERANCE * 100 } }, kind: 'percent', answer: exact, tolerance: ESTIMATE_TOLERANCE }],
        steps: [{ key: 'lab.estimate.s1', params: { exact: pctText(exact) } }],
        cards: { hero: hero.join(''), ...(vsRange ? {} : { villain }), ...(flop ? { board: board.join('') } : {}) },
        facts: { exact, vsRange: String(vsRange), flop: String(flop) },
      };
    }

    case 'ev': {
      // EV = Σ pᵢ vᵢ for a bet: fold, call and win, call and lose; compared with checking down.
      const { pot, bet } = potAndBet(rnd);
      const fold = Math.round((0.1 + rnd() * 0.6) * 20) / 20;
      const win = Math.round((0.1 + rnd() * 0.6) * 20) / 20;
      const checkWin = Math.min(0.95, Math.round((win + rnd() * 0.25) * 20) / 20);
      const branches = [
        { key: 'lab.ev.fold', p: fold, v: pot },
        { key: 'lab.ev.callWin', p: (1 - fold) * win, v: pot + bet },
        { key: 'lab.ev.callLose', p: (1 - fold) * (1 - win), v: -bet },
      ];
      const ev = branches.reduce((s, b) => s + b.p * b.v, 0);
      const evCheck = checkWin * pot;
      const answer = ev >= evCheck ? 0 : 1;
      const close = Math.abs(ev - evCheck) < EV_CLOSE;
      return {
        drill,
        intro: { key: 'lab.ev.intro', params: { pot, bet, fold: pctText(fold, 0), win: pctText(win, 0), checkWin: pctText(checkWin, 0) } },
        parts: [
          { prompt: { key: 'lab.ev.q1', params: {} }, kind: 'bb', answer: ev, tolerance: Math.max(0.1, Math.abs(ev) * 0.02) },
          { prompt: { key: 'lab.ev.q2', params: {} }, kind: 'choice', answer, choices: [t('lab.bet'), t('lab.check')], accept: close ? [0, 1] : [answer] },
        ],
        steps: [
          ...branches.map((b) => ({ key: 'lab.ev.branch', params: { label: t(b.key as MessageKey), p: pctText(b.p), v: bbText(b.v), product: bbText(b.p * b.v) } })),
          { key: 'lab.ev.sum', params: { ev: bbText(ev) } },
          { key: 'lab.ev.check', params: { checkWin: pctText(checkWin, 0), pot, evCheck: bbText(evCheck) } },
          { key: close ? 'lab.ev.close' : answer === 0 ? 'lab.ev.betBetter' : 'lab.ev.checkBetter', params: { diff: bbText(Math.abs(ev - evCheck)), close: EV_CLOSE } },
        ],
        facts: { pot, bet, fold, win, checkWin, ev, evCheck },
      };
    }

    case 'implied': {
      // On the turn with a draw that isn't priced in: how much more must you win when you hit?
      for (let attempt = 0; attempt < 400; attempt++) {
        const deck = shuffle(DECK, rnd);
        const hero = deck.slice(0, 2);
        const villain = deck.slice(2, 4);
        const board = deck.slice(4, 8);
        const o = await engine.outs(hero.join(''), villain.join(''), board.join(''));
        if (!o.behindNow || o.ahead.length < 4 || o.ahead.length > 12) continue;
        const { pot, bet } = potAndBet(rnd);
        const final = pot + 2 * bet;
        const required = bet / final;
        const eq = (o.ahead.length + o.tied.length / 2) / 44;
        if (eq >= required) continue;
        // Break-even: e·(pot + bet + W) − (1 − e)·bet = 0.
        const extra = bet / eq - final;
        const now = await engine.category([...hero, ...board].join(''));
        const tainted: string[] = [];
        for (const c of o.behind) if ((await engine.category([...hero, ...board, c].join(''))) > now) tainted.push(c);
        return {
          drill,
          intro: { key: 'lab.implied.intro', params: { pot, bet } },
          parts: [
            { prompt: { key: 'lab.implied.q1', params: {} }, kind: 'percent', answer: required },
            { prompt: { key: 'lab.implied.q2', params: {} }, kind: 'bb', answer: extra, tolerance: Math.max(0.5, extra * 0.05) },
          ],
          steps: [
            { key: 'lab.implied.s1', params: { bet, final, required: pctText(required) } },
            { key: 'lab.implied.s2', params: { outs: o.ahead.length, tied: o.tied.length, equity: pctText(eq) } },
            { key: 'lab.implied.s3', params: { equity: pctText(eq), pot, bet, extra: bbText(extra) } },
            { key: tainted.length ? 'lab.implied.reverse' : 'lab.implied.noReverse', params: { n: tainted.length, cards: tainted.join(' ') } },
          ],
          cards: { hero: hero.join(''), villain: villain.join(''), board: board.join('') },
          facts: { pot, bet, final, required, equity: eq, extra, outs: o.ahead.length, tied: o.tied.length, tainted: tainted.length },
        };
      }
      throw new Error('could not deal an implied-odds problem');
    }

    case 'blockers': {
      // How your cards and the board change an opponent's value-to-bluff mix.
      for (let attempt = 0; attempt < 400; attempt++) {
        const deck = shuffle(DECK, rnd);
        const board = deck.slice(0, 5);
        const ranks = boardRanks(board);
        if (ranks.length < 4) continue;
        const [top, mid] = ranks as [string, string];
        const over = RANKS[Math.max(0, RANKS.indexOf(top) - 1)]!;
        const valueCands = [...new Set([top + top, mid + mid, top + mid, top === 'A' ? 'AK' : 'A' + top, ...(over !== top ? [over + over] : [])])];
        const bluffCands = ['QJs', 'JTs', 'T9s', '98s', '87s', '76s', '65s', 'A5s', 'A4s', 'KJs', 'KTs', 'QTs'].filter((h) => !ranks.includes(h[0]!) && !ranks.includes(h[1]!));
        if (bluffCands.length < 2) continue;
        const value = shuffle(valueCands, rnd).slice(0, 2 + Math.floor(rnd() * 2));
        const bluffs = shuffle(bluffCands, rnd).slice(0, 2);
        // Your hand often holds a card of a value hand's rank, so it blocks.
        const pool = deck.slice(5).filter((c) => value.some((v) => v.includes(c[0]!)));
        const first = rnd() < 0.7 && pool.length ? pick(pool, rnd) : deck[5]!;
        const second = deck.slice(5).find((c) => c !== first)!;
        const hero = [first, second];
        const known = [...board, ...hero];
        const left = (h: string) => combosOf(h).filter((c) => !known.some((k) => c.includes(k))).length;
        const valueBefore = value.reduce((s, h) => s + combosOf(h).filter((c) => !board.some((k) => c.includes(k))).length, 0);
        const valueLeft = value.reduce((s, h) => s + left(h), 0);
        const bluffLeft = bluffs.reduce((s, h) => s + left(h), 0);
        if (valueLeft + bluffLeft === 0 || valueBefore === valueLeft) continue;
        const share = valueLeft / (valueLeft + bluffLeft);
        return {
          drill,
          intro: { key: 'lab.blockers.intro', params: { value: value.join(', '), bluffs: bluffs.join(', ') } },
          parts: [
            { prompt: { key: 'lab.blockers.q1', params: {} }, kind: 'count', answer: valueLeft },
            { prompt: { key: 'lab.blockers.q2', params: {} }, kind: 'percent', answer: share },
          ],
          steps: [
            ...value.map((h) => ({ key: 'lab.blockers.hand', params: { hand: h, total: combosOf(h).length, left: left(h) } })),
            ...bluffs.map((h) => ({ key: 'lab.blockers.hand', params: { hand: h, total: combosOf(h).length, left: left(h) } })),
            { key: 'lab.blockers.s1', params: { before: valueBefore, after: valueLeft } },
            { key: 'lab.blockers.s2', params: { value: valueLeft, bluffs: bluffLeft, share: pctText(share) } },
          ],
          cards: { hero: hero.join(''), board: board.join('') },
          facts: { valueBefore, valueLeft, bluffLeft, share, value: value.join(','), bluffs: bluffs.join(',') },
        };
      }
      throw new Error('could not deal a blocker problem');
    }

    case 'spr': {
      // SPR on the flop, the price of calling an all-in, and whether your hand commits.
      for (let attempt = 0; attempt < 400; attempt++) {
        const deck = shuffle(DECK, rnd);
        const board = deck.slice(0, 3);
        const hero = deck.slice(3, 5);
        const pot = 4 + Math.floor(rnd() * 30);
        const stack = Math.max(2, Math.round(pot * pick([0.5, 1, 1.5, 2, 3, 4, 6, 8, 12], rnd)));
        const spr = stack / pot;
        const required = stack / (pot + 2 * stack);
        const eq = await engine.equity(hero.join(''), valueRange(board), board.join(''));
        if (eq < 0.1 || eq > 0.75) continue;
        return {
          drill,
          intro: { key: 'lab.spr.intro', params: { pot, stack, range: t('lab.range.value') } },
          parts: [
            { prompt: { key: 'lab.spr.q1', params: {} }, kind: 'number', answer: spr, tolerance: 0.1 },
            { prompt: { key: 'lab.spr.q2', params: {} }, kind: 'percent', answer: required },
            decision({ key: 'lab.spr.q3', params: {} }, eq, required),
          ],
          steps: [
            { key: 'lab.spr.s1', params: { stack, pot, spr: spr.toFixed(2) } },
            { key: 'lab.spr.s2', params: { stack, pot, required: pctText(required) } },
            { key: 'lab.spr.s3', params: { equity: pctText(eq) } },
            { key: Math.abs(eq - required) < CLOSE ? 'lab.spr.close' : eq >= required ? 'lab.spr.commit' : 'lab.spr.fold', params: { close: CLOSE * 100 } },
            { key: spr <= 3 ? 'lab.spr.low' : 'lab.spr.high', params: {} },
          ],
          cards: { hero: hero.join(''), board: board.join('') },
          facts: { pot, stack, spr, required, equity: eq },
        };
      }
      throw new Error('could not deal an SPR problem');
    }
  }
}

/** Parse a typed number: "25", "25%", "0.25", "1,5". NaN if it isn't one. */
function parse(input: string): { v: number; percentSign: boolean } {
  const raw = input.trim().replace(',', '.');
  if (!raw) return { v: NaN, percentSign: false };
  return { v: Number(raw.replace('%', '').replace(/bb$/i, '').trim()), percentSign: raw.endsWith('%') };
}

/** The learner's value for a part (a share for percent parts), or NaN. */
export function valueOf(part: Part, input: string): number {
  if (part.kind === 'choice') return Number(input);
  const { v, percentSign } = parse(input);
  if (!Number.isFinite(v)) return NaN;
  return part.kind === 'percent' && (percentSign || v > 1) ? v / 100 : v;
}

/** Is this answer to a part right? */
export function checkPart(part: Part, input: string): boolean {
  const v = valueOf(part, input);
  if (!Number.isFinite(v)) return false;
  if (part.kind === 'choice') return (part.accept ?? [part.answer]).includes(v);
  if (part.kind === 'count') return v === part.answer;
  const tol = part.tolerance ?? (part.kind === 'percent' ? PERCENT_TOLERANCE : 0);
  return Math.abs(v - part.answer) <= tol + 1e-9;
}

/** The right answer, as text. */
export function partAnswerText(part: Part): string {
  if (part.kind === 'percent') return pctText(part.answer);
  if (part.kind === 'choice') return part.choices![part.answer]!;
  if (part.kind === 'bb') return `${bbText(part.answer)} bb`;
  if (part.kind === 'number') return part.answer.toFixed(2);
  return String(part.answer);
}
