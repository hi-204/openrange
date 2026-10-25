// Predicates for every claim kind (D-053): recompute each claim from the raw decision and
// report any disagreement. Used by tests over synthetic and real data; an empty list means
// the explanation is consistent with the numbers.

import { grade as gradeOf, type DecisionInput } from '../grading';
import { EVEN_MARGIN_BB, verdictOf, type Claim } from './claims';
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
