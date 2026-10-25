// Turn claims into sentences. Uses only the claim's own fields (D-053), so a consistent claim
// can't produce a sentence that contradicts the numbers.

import { pct } from '../../../lib/format';
import { t, type MessageKey } from '../../../lib/i18n';
import { MIX_THRESHOLD, type Unit } from '../grading';
import type { Claim } from './claims';

export const fmtBb = (x: number) => t('trainer.bb', { x: x.toFixed(2) });
export const fmtLoss = (x: number, unit: Unit) => (unit === 'bb' ? fmtBb(x) : t('trainer.pctPot', { x: x.toFixed(1) }));

export type Sentence = { kind: Claim['kind']; text: string };

export function renderClaim(c: Claim): string[] {
  switch (c.kind) {
    case 'verdict': {
      const out: string[] = [];
      if (c.lowerFrequency) out.push(t('trainer.verdict.mixed', { chosen: c.chosen, freq: pct(c.chosenFrequency, 0), top: c.topAction }));
      else if (c.best.includes(c.chosen))
        out.push(c.best.length > 1 ? t('trainer.verdict.bestTie', { chosen: c.chosen, others: c.best.filter((b) => b !== c.chosen).join(', ') }) : t('trainer.verdict.best', { chosen: c.chosen }));
      else if (c.chosenFrequency >= MIX_THRESHOLD) out.push(t('trainer.verdict.inMix', { chosen: c.chosen, freq: pct(c.chosenFrequency, 0) }));
      const inMix = c.chosenFrequency >= MIX_THRESHOLD;
      if (!c.best.includes(c.chosen) && c.loss > 0) {
        // Inside the mix a small EV gap is convergence noise, not a better play.
        if (inMix) {
          if (!c.unconverged) out.push(t('trainer.verdict.mixNoise', { loss: fmtLoss(c.loss, c.unit) }));
        } else if (c.category === 'best') {
          // Best despite a gap: either the sampling allowance covers it or it's below the Best threshold.
          const key = c.gradedLoss < c.loss ? 'trainer.verdict.withinNoise' : 'trainer.verdict.tiny';
          out.push(t(key, { best: c.best.join(' / '), loss: fmtLoss(c.loss, c.unit) }));
        } else out.push(t('trainer.verdict.loss', { best: c.best.join(' / '), chosen: c.chosen, loss: fmtLoss(c.loss, c.unit) }));
      }
      if (c.gradedLoss < c.loss && c.category !== 'best') out.push(t('trainer.verdict.allowance', { graded: fmtLoss(c.gradedLoss, c.unit) }));
      if (c.unconverged) out.push(t('trainer.verdict.unconverged', { loss: fmtLoss(c.loss, c.unit) }));
      return out;
    }
    case 'evRank':
      return [
        t('trainer.evRank', {
          list: c.order
            .map((r) => (r.stdError ? t('trainer.evItemSe', { action: r.action, ev: fmtBb(r.ev), se: r.stdError.toFixed(2) }) : t('trainer.evItem', { action: r.action, ev: fmtBb(r.ev) })))
            .join(', '),
        }),
      ];
    case 'mix':
      // Actions the solution (almost) never takes would only clutter the sentence.
      return [t('trainer.mix', { list: c.frequencies.filter((f) => f.p >= 0.005).map((f) => `${f.action} ${pct(f.p, 0)}`).join(', ') })];
    case 'sampled':
      return [t('trainer.sampled', { se: c.largestStdError.toFixed(2) })];
    case 'practice':
      return [t('trainer.practice')];
    case 'callMath': {
      const key: MessageKey = c.verdict === 'continue' ? 'trainer.callMath.continue' : c.verdict === 'fold' ? 'trainer.callMath.fold' : 'trainer.callMath.even';
      const out = [
        t('trainer.callMath', { toCall: c.toCall.toFixed(2), pot: c.potAfterCall.toFixed(2), required: pct(c.required, 1), equity: pct(c.equity, 1) }),
        t(key, { diff: fmtBb(Math.abs(c.evDiff)) }),
      ];
      if (!c.exact) out.push(t('trainer.callMath.rough'));
      return out;
    }
    case 'accuracy':
      return [t('trainer.accuracy', { x: c.exploitabilityPct.toFixed(2) })];
    case 'offPath':
      return [t('trainer.offPath', { share: pct(c.reachShare, 1) })];
    case 'potOdds': {
      const key: MessageKey = c.verdict === 'continue' ? 'trainer.potOdds.call' : c.verdict === 'fold' ? 'trainer.potOdds.fold' : 'trainer.potOdds.even';
      const out = [
        t('trainer.potOdds', { toCall: c.toCall.toFixed(2), pot: c.potAfterCall.toFixed(2), required: pct(c.required, 1), equity: pct(c.equity, 1) }),
        t(key, { diff: fmtBb(Math.abs(c.evDiff)) }),
      ];
      if (!c.exact) {
        out.push(t('trainer.potOdds.raw'));
        if (c.verdict !== 'even' && c.verdict !== c.rawVerdict) out.push(t('trainer.potOdds.disagree'));
      }
      return out;
    }
    case 'mdf':
      return [t('trainer.mdf', { mdf: pct(c.mdf, 0), defend: pct(c.defend, 0) })];
    case 'spr':
      return [t('trainer.spr', { spr: c.spr.toFixed(1), stack: c.stack.toFixed(1), pot: c.pot.toFixed(1) })];
    case 'texture': {
      const parts = [
        t(c.paired ? 'trainer.texture.paired' : 'trainer.texture.unpaired'),
        c.maxSuit >= 3 ? t('trainer.texture.flush3', { n: c.maxSuit }) : t(c.maxSuit === 2 ? 'trainer.texture.flush2' : 'trainer.texture.rainbow'),
        t(c.straightPossible ? 'trainer.texture.straight' : 'trainer.texture.noStraight'),
        t('trainer.texture.high', { rank: c.highCard }),
      ];
      return [t('trainer.texture', { board: c.board.join(' '), parts: parts.join(', ') })];
    }
    case 'advantage':
      return [
        t('trainer.advantage', {
          equity: pct(c.heroEquity, 1),
          lead: t(c.lead === 'hero' ? 'trainer.advantage.hero' : c.lead === 'villain' ? 'trainer.advantage.villain' : 'trainer.advantage.even'),
          heroNuts: pct(c.heroNuts, 0),
          villainNuts: pct(c.villainNuts, 0),
          nut: pct(c.nut, 0),
        }),
      ];
    case 'blockers':
      return [t('trainer.blockers', { strong: pct(c.strongBlocked, 0), weak: pct(c.weakBlocked, 0) })];
    case 'shoveMath':
      return [
        c.equityWhenCalled === null
          ? t('trainer.shoveMath.neverCalled', { evShove: fmtBb(c.evShove), evFold: fmtBb(c.evFold) })
          : t('trainer.shoveMath', { fold: pct(c.foldShare, 0), eqCalled: pct(c.equityWhenCalled, 1), evShove: fmtBb(c.evShove), evFold: fmtBb(c.evFold) }),
      ];
  }
}

/** The lesson that matches the strongest claim (lessons themselves arrive in M7). */
export function lessonFor(claims: Claim[], fallback: MessageKey): MessageKey {
  if (claims.some((c) => c.kind === 'callMath')) return 'trainer.lesson.potOdds';
  if (claims.some((c) => c.kind === 'shoveMath')) return 'trainer.lesson.pushFold';
  if (claims.some((c) => c.kind === 'potOdds')) return 'trainer.lesson.potOdds';
  if (claims.some((c) => c.kind === 'mdf')) return 'trainer.lesson.mdf';
  if (claims.some((c) => c.kind === 'verdict' && c.lowerFrequency)) return 'trainer.lesson.mixed';
  return fallback;
}
