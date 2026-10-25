// The coach (docs/DESIGN.md §6, D-065): a plain-English card built only from the checked claims
// of a decision (D-053). Phrase variants are picked by a hash of the decision, so the same
// decision always reads the same and tests are stable.

import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import type { Claim } from '../trainer/explain/claims';
import { fmtBb, fmtLoss } from '../trainer/explain/render';
import { MIX_THRESHOLD, type Category, type Unit } from '../trainer/grading';

export type Detail = 'simple' | 'standard' | 'detailed';

/** Two actions in a mix are "close" (one only slightly more common) within this gap. */
export const CLOSE_MIX = 0.3;

/** Below this frequency an action is "never played" and is never praised. */
export const PRAISE_MIN_FREQUENCY = 0.005;

export type CoachContext = {
  /** Stable seed for phrase variants (spot + hand + choice). */
  seed: string;
  drill: 'preflop' | 'postflop';
  /** Seat or "OOP"/"IP". */
  position: string;
  /** Hand class, e.g. "AKs". */
  hand: string;
  /** Players still to act after the hero (preflop, first in), when known. */
  playersBehind?: number;
  detail: Detail;
};

export type Tone = 'best' | 'fine' | 'small' | 'mistake' | 'blunder' | 'ungraded';

export type CoachCard = {
  tone: Tone;
  category: Category | null;
  verdict: string;
  why: string[];
  keyIdea: string;
  lookFor: string;
  /** What the coach recommends (best actions in the data), shown in the verdict. */
  recommended: string[];
  learnMore: { topic: string; href: string };
};

/** FNV-1a: small, deterministic hash for picking phrase variants. */
export function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Pick one of the numbered variants `${key}.1` … `${key}.n` by seed. */
function variant(key: string, n: number, seed: string, params: Record<string, string | number> = {}): string {
  return t(`${key}.${(hash(`${seed}|${key}`) % n) + 1}` as MessageKey, params);
}

const find = <K extends Claim['kind']>(claims: Claim[], kind: K) => claims.find((c) => c.kind === kind) as Extract<Claim, { kind: K }> | undefined;

const SENTENCES: Record<Detail, number> = { simple: 2, standard: 3, detailed: 4 };

const handKind = (cls: string) => (cls.length === 2 ? 'pair' : cls.endsWith('s') ? 'suited' : 'offsuit');

export function buildCoach(claims: Claim[], ctx: CoachContext): CoachCard {
  const v = find(claims, 'verdict');
  const call = find(claims, 'callMath');
  const shove = find(claims, 'shoveMath');
  const odds = find(claims, 'potOdds');
  const mdf = find(claims, 'mdf');
  const mix = find(claims, 'mix');
  const adv = find(claims, 'advantage');
  const tex = find(claims, 'texture');
  const blk = find(claims, 'blockers');
  const rank = find(claims, 'evRank');
  const off = find(claims, 'offPath');
  const practice = find(claims, 'practice');
  const seed = ctx.seed;

  // Verdict.
  let tone: Tone = 'ungraded';
  let verdict: string;
  let recommended: string[] = [];
  if (!v) {
    verdict = off ? t('coach.verdict.offPath') : practice ? t('coach.verdict.practice') : t('coach.verdict.noReference');
    recommended = rank?.order.length ? [rank.order[0]!.action] : [];
  } else {
    recommended = v.best;
    const played = v.chosenFrequency >= PRAISE_MIN_FREQUENCY;
    const loss = fmtLoss(v.loss, v.unit as Unit);
    if (v.category === 'best') {
      if (v.lowerFrequency) {
        tone = 'fine';
        // "Slightly more common" only when the two frequencies really are close.
        const topP = mix?.frequencies.find((f) => f.action === v.topAction)?.p ?? 1;
        const params = { chosen: v.chosen, top: v.topAction, pc: pct(v.chosenFrequency, 0), pt: pct(topP, 0) };
        verdict = topP - v.chosenFrequency < CLOSE_MIX ? variant('coach.verdict.mixed', 2, seed, params) : variant('coach.verdict.mixedMain', 2, seed, params);
      } else if (played && (v.best.includes(v.chosen) || v.chosenFrequency >= MIX_THRESHOLD)) {
        tone = 'best';
        verdict = variant('coach.verdict.best', 3, seed, { chosen: v.chosen });
      } else {
        // Within the Best threshold but not what the solution plays: a close call, not praise.
        tone = 'fine';
        verdict = t('coach.verdict.close', { best: v.best.join(' / '), loss });
      }
    } else if (v.category === 'acceptable') {
      tone = 'fine';
      verdict = t('coach.verdict.acceptable', { best: v.best.join(' / '), loss });
    } else if (v.category === 'inaccuracy') {
      tone = 'small';
      verdict = t('coach.verdict.inaccuracy', { best: v.best.join(' / '), loss });
    } else if (v.category === 'mistake') {
      tone = 'mistake';
      verdict = t('coach.verdict.mistake', { best: v.best.join(' / '), loss });
    } else {
      tone = 'blunder';
      verdict = t('coach.verdict.blunder', { best: v.best.join(' / '), loss });
    }
  }

  // Why: most specific reasons first; the detail level decides how many.
  const why: string[] = [];
  let topic: { key: string; lesson: string } = ctx.drill === 'preflop' ? { key: 'ranges', lesson: '1.5' } : { key: 'postflop', lesson: '4.1' };
  if (off) why.push(t('coach.why.offPath', { share: pct(off.reachShare, 1) }));
  if (practice) why.push(t('coach.why.practice'));
  if (call) {
    why.push(t('coach.why.price', { toCall: call.toCall.toFixed(1), pot: call.potAfterCall.toFixed(1), required: pct(call.required, 1) }));
    why.push(t('coach.why.equityVsShove', { equity: pct(call.equity, 1), verdict: t(call.equity >= call.required ? 'coach.enough' : 'coach.notEnough') }));
    topic = { key: 'potOdds', lesson: '2.3' };
  }
  if (shove) {
    why.push(shove.equityWhenCalled === null ? t('coach.why.alwaysFolds') : t('coach.why.foldEquity', { fold: pct(shove.foldShare, 0), equity: pct(shove.equityWhenCalled, 1) }));
    why.push(t('coach.why.shoveTotal', { shove: fmtBb(shove.evShove), fold: fmtBb(shove.evFold) }));
    topic = { key: 'pushFold', lesson: '1.5' };
  }
  if (odds) {
    why.push(t('coach.why.price', { toCall: odds.toCall.toFixed(1), pot: odds.potAfterCall.toFixed(1), required: pct(odds.required, 1) }));
    why.push(t('coach.why.equityVsRange', { equity: pct(odds.equity, 1) }));
    if (!odds.exact && odds.verdict !== 'even' && odds.verdict !== odds.rawVerdict) why.push(t('coach.why.futureBetting'));
    topic = { key: 'potOdds', lesson: '2.3' };
  }
  if (v && v.lowerFrequency && mix) {
    const played = mix.frequencies.filter((f) => f.p >= MIX_THRESHOLD).sort((a, b) => b.p - a.p);
    if (played.length >= 2) why.unshift(t('coach.why.mix', { a: played[0]!.action, pa: pct(played[0]!.p, 0), b: played[1]!.action, pb: pct(played[1]!.p, 0) }));
    topic = { key: 'mixed', lesson: '5.6' };
  }
  if (ctx.drill === 'preflop' && ctx.playersBehind !== undefined && ctx.playersBehind > 0)
    why.push(t(ctx.playersBehind === 1 ? 'coach.why.behindOne' : 'coach.why.behind', { seat: ctx.position, n: ctx.playersBehind }));
  if (ctx.drill === 'preflop') why.push(t(`coach.why.hand.${handKind(ctx.hand)}` as MessageKey, { hand: ctx.hand }));
  if (adv) why.push(t(`coach.why.advantage.${adv.lead}` as MessageKey, { equity: pct(adv.heroEquity, 0) }));
  if (mdf && !odds) why.push(t('coach.why.mdf', { mdf: pct(mdf.mdf, 0), defend: pct(mdf.defend, 0) }));
  if (blk && Math.abs(blk.strongBlocked - blk.weakBlocked) >= 0.05) why.push(t(blk.strongBlocked > blk.weakBlocked ? 'coach.why.blocksValue' : 'coach.why.blocksBluffs', { strong: pct(blk.strongBlocked, 0), weak: pct(blk.weakBlocked, 0) }));
  if (tex) why.push(t('coach.why.texture', { board: tex.board.join(' '), wet: t(tex.maxSuit >= 3 || tex.straightPossible ? 'coach.wet' : 'coach.dry') }));
  if (v && !v.best.includes(v.chosen) && !v.lowerFrequency && rank) {
    const best = rank.order[0]!;
    const mine = rank.order.find((r) => r.action === v.chosen);
    if (mine) why.push(t('coach.why.evGap', { best: best.action, bestEv: fmtBb(best.ev), chosen: mine.action, chosenEv: fmtBb(mine.ev) }));
  }
  const limit = SENTENCES[ctx.detail];

  const keyIdea = variant(`coach.idea.${topic.key}`, 2, seed);
  const lookFor = t(`coach.look.${topic.key}` as MessageKey);
  return {
    tone,
    category: v?.category ?? null,
    verdict,
    why: why.slice(0, limit),
    keyIdea,
    lookFor,
    recommended,
    learnMore: { topic: t(`coach.topic.${topic.key}` as MessageKey), href: `#/learn/${topic.lesson}` },
  };
}

/** Coaching for a math drill: right or wrong, with the worked solution as the "why". */
export function mathCoach(correct: boolean, drill: string, given: string, answer: string, steps: string[], seed: string): CoachCard {
  return {
    tone: correct ? 'best' : 'mistake',
    category: correct ? 'best' : 'mistake',
    verdict: correct ? variant('coach.math.right', 3, seed, { answer }) : t('coach.math.wrong', { given, answer }),
    why: steps,
    keyIdea: t(`coach.math.idea.${drill}` as MessageKey),
    lookFor: t(`coach.math.look.${drill}` as MessageKey),
    recommended: [answer],
    learnMore: { topic: t(`math.drill.${drill}` as MessageKey), href: `#/learn/${MATH_LESSON[drill] ?? '2.3'}` },
  };
}

const MATH_LESSON: Record<string, string> = { potodds: '2.3', outs: '2.1', equity: '2.4', mdf: '5.2', bluff: '5.3', combos: '2.7' };
