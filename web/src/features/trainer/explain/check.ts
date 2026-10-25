// Predicates for every claim kind (D-053): recompute each claim from the raw decision and
// report any disagreement. Used by tests over synthetic and real data; an empty list means
// the explanation is consistent with the numbers.

import { grade as gradeOf, type DecisionInput } from '../grading';
import { ADVANTAGE_MARGIN, EVEN_MARGIN_BB, STRONG_EQUITY, verdictOf, WEAK_EQUITY, type Claim } from './claims';
import { EXACT_TOLERANCE_POSTFLOP_BB, type PostflopContext } from './postflop';
import { EXACT_TOLERANCE_BB } from './preflop';

const close = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol;

/** Raw numbers the claims were built from. `input` is null for practice (ungraded) spots. */
export type RawDecision = { actions: string[]; input: DecisionInput };

export function checkClaims(raw: RawDecision, claims: Claim[], graded: boolean): string[] {
  const bad: string[] = [];
  const { actions, input } = raw;
  const ev = input.ev;
  const g = graded ? gradeOf(input) : null;
  const label = (i: number) => actions[i]!;

  for (const c of claims) {
    switch (c.kind) {
      case 'verdict': {
        if (!g) {
          bad.push('verdict on an ungraded spot');
          break;
        }
        if (c.category !== g.category) bad.push(`category ${c.category} ≠ ${g.category}`);
        if (c.chosen !== label(input.chosen)) bad.push('wrong chosen action');
        if (c.best.join() !== g.bestActions.map(label).join()) bad.push('wrong best actions');
        if (!close(c.loss, g.loss) || !close(c.gradedLoss, g.gradedLoss)) bad.push('wrong loss');
        if (c.lowerFrequency !== g.lowerFrequency || c.unconverged !== g.unconverged) bad.push('wrong mix flags');
        if (c.lowerFrequency && c.category !== 'best') bad.push('a mixed action is not graded Best');
        break;
      }
      case 'evRank': {
        for (let k = 1; k < c.order.length; k++) if (c.order[k]!.ev > c.order[k - 1]!.ev) bad.push('EV ranking out of order');
        for (const r of c.order) {
          const i = actions.indexOf(r.action);
          if (i < 0 || ev[i] === null || !close(r.ev, ev[i]!)) bad.push(`EV of ${r.action} misreported`);
        }
        const available = ev.filter((e) => e !== null).length;
        if (c.order.length !== available) bad.push('EV ranking misses actions');
        break;
      }
      case 'mix':
        c.frequencies.forEach((f, i) => {
          if (f.action !== label(i) || !close(f.p, input.strategy[i]!)) bad.push('mix misreported');
        });
        break;
      case 'sampled':
        if (!input.evStdError) bad.push('sampled note on an exact reference');
        break;
      case 'practice':
        if (graded) bad.push('practice note on a graded spot');
        break;
      case 'callMath': {
        const [fold, call] = [ev[0], ev[1]];
        if (fold == null || call == null) {
          bad.push('call math without EVs');
          break;
        }
        if (!close(c.required, c.toCall / c.potAfterCall)) bad.push('required equity miscomputed');
        if (!close(c.evDiff, call - fold)) bad.push('call EV difference misreported');
        if (c.verdict !== verdictOf(c.evDiff)) bad.push('call verdict contradicts the EVs');
        const identity = c.equity * c.potAfterCall - c.toCall;
        if (c.exact !== Math.abs(c.evDiff - identity) <= EXACT_TOLERANCE_BB) bad.push('exact flag wrong');
        // The pot-odds sentence ("you need X%, you have Y%") must point the same way as the EVs.
        if (c.exact && Math.abs(c.evDiff) >= EVEN_MARGIN_BB && Math.sign(c.equity - c.required) !== Math.sign(c.evDiff))
          bad.push('pot odds point the other way from the EVs');
        break;
      }
      case 'accuracy':
      case 'offPath':
      case 'potOdds':
      case 'mdf':
      case 'spr':
      case 'texture':
      case 'advantage':
      case 'blockers':
        break; // checked by checkPostflopClaims
      case 'shoveMath': {
        if (ev[0] == null || ev[1] == null || !close(c.evFold, ev[0]) || !close(c.evShove, ev[1])) bad.push('shove EVs misreported');
        if (Math.abs(c.rebuilt - c.evShove) > EXACT_TOLERANCE_BB) bad.push(`shove EV rebuilt as ${c.rebuilt}, reference ${c.evShove}`);
        if (c.foldShare < 0 || c.foldShare > 1) bad.push('fold share out of range');
        break;
      }
    }
  }
  return bad;
}

/**
 * Postflop predicates. Shared kinds go through `checkClaims`; the postflop kinds are recomputed
 * here with their own arithmetic (not the generator's helpers).
 */
export function checkPostflopClaims(ctx: PostflopContext, claims: Claim[]): string[] {
  const input: DecisionInput = { ev: ctx.ev, strategy: ctx.strategy, chosen: ctx.chosen, unit: 'pctPot', potBb: ctx.pot, noiseFloorPct: ctx.exploitabilityPct };
  const graded = !ctx.offPath && ctx.grade !== null;
  const shared = claims.filter((c) => ['verdict', 'evRank', 'mix', 'sampled', 'practice'].includes(c.kind));
  const bad = checkClaims({ actions: ctx.actions, input }, shared, graded);
  const villain = 1 - ctx.heroSeat;
  const toCall = Math.max(0, ctx.committed[villain]! - ctx.committed[ctx.heroSeat]!);
  for (const c of claims) {
    switch (c.kind) {
      case 'offPath':
        if (!ctx.offPath) bad.push('off-path note on an on-path decision');
        if (claims.some((x) => x.kind === 'verdict')) bad.push('off-path decision has a verdict');
        break;
      case 'accuracy':
        if (!close(c.exploitabilityPct, ctx.exploitabilityPct)) bad.push('accuracy misreported');
        break;
      case 'potOdds': {
        const f = ctx.actions.indexOf('Fold');
        const k = ctx.actions.indexOf('Call');
        if (!close(c.toCall, toCall) || !close(c.potAfterCall, ctx.pot + toCall)) bad.push('price misreported');
        if (!close(c.required, toCall / (ctx.pot + toCall))) bad.push('required equity miscomputed');
        if (!close(c.evDiff, ctx.ev[k]! - ctx.ev[f]!)) bad.push('call EV difference misreported');
        if (c.verdict !== verdictOf(c.evDiff)) bad.push('call verdict contradicts the EVs');
        if (c.rawVerdict !== (c.equity >= c.required ? 'continue' : 'fold')) bad.push('raw verdict wrong');
        if (c.exact !== (ctx.street === 'River')) bad.push('exact flag wrong');
        if (c.exact) {
          const identity = c.equity * c.potAfterCall - c.toCall;
          if (Math.abs(identity - c.evDiff) > EXACT_TOLERANCE_POSTFLOP_BB) bad.push(`river identity off: equity says ${identity.toFixed(4)}, EVs ${c.evDiff.toFixed(4)}`);
          if (c.verdict !== 'even' && c.rawVerdict !== c.verdict) bad.push('pot odds point the other way from the EVs on the river');
        }
        break;
      }
      case 'mdf':
        if (!close(c.mdf, 1 - ctx.committed[villain]! / ctx.pot)) bad.push('MDF miscomputed');
        if (ctx.heroDefend === null || !close(c.defend, ctx.heroDefend)) bad.push('defence frequency misreported');
        break;
      case 'spr': {
        const earlier = (ctx.pot - ctx.startPot - ctx.committed[0] - ctx.committed[1]) / 2;
        const stack = ctx.startStack - earlier - ctx.committed[ctx.heroSeat]!;
        if (!close(c.stack, stack) || !close(c.spr, stack / ctx.pot)) bad.push('SPR miscomputed');
        break;
      }
      case 'texture': {
        const ranks = ctx.board.map((x) => x[0]);
        if (c.paired !== (new Set(ranks).size < ranks.length)) bad.push('paired flag wrong');
        const bySuit = ['c', 'd', 'h', 's'].map((s) => ctx.board.filter((x) => x[1] === s).length);
        if (c.maxSuit !== Math.max(...bySuit)) bad.push('suit count wrong');
        if (!ranks.includes(c.highCard)) bad.push('high card not on the board');
        break;
      }
      case 'advantage': {
        if (!ctx.heroRange || !ctx.villainRange) {
          bad.push('advantage without ranges');
          break;
        }
        let w = 0;
        let e = 0;
        for (const x of ctx.heroRange) {
          w += x.weight;
          e += x.weight * x.equity;
        }
        if (!close(c.heroEquity, e / w, 1e-9)) bad.push('range equity misreported');
        const expected = c.heroEquity > 0.5 + ADVANTAGE_MARGIN ? 'hero' : c.heroEquity < 0.5 - ADVANTAGE_MARGIN ? 'villain' : 'even';
        if (c.lead !== expected) bad.push('range advantage points the wrong way');
        const nuts = (r: { weight: number; equity: number }[]) => r.filter((x) => x.equity >= c.nut).reduce((s, x) => s + x.weight, 0) / r.reduce((s, x) => s + x.weight, 0);
        if (!close(c.heroNuts, nuts(ctx.heroRange), 1e-9) || !close(c.villainNuts, nuts(ctx.villainRange), 1e-9)) bad.push('nut shares misreported');
        break;
      }
      case 'blockers': {
        if (!ctx.villainRange) {
          bad.push('blockers without a range');
          break;
        }
        const held = new Set([ctx.heroCombo.slice(0, 2), ctx.heroCombo.slice(2, 4)]);
        const share = (pick: (eq: number) => boolean) => {
          const group = ctx.villainRange!.filter((x) => pick(x.equity));
          const total = group.reduce((s, x) => s + x.weight, 0);
          const blocked = group.filter((x) => held.has(x.combo.slice(0, 2)) || held.has(x.combo.slice(2, 4))).reduce((s, x) => s + x.weight, 0);
          return blocked / total;
        };
        if (!close(c.strongBlocked, share((q) => q >= STRONG_EQUITY), 1e-9) || !close(c.weakBlocked, share((q) => q <= WEAK_EQUITY), 1e-9)) bad.push('blocker shares misreported');
        break;
      }
      default:
        break;
    }
  }
  return bad;
}
