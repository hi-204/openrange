// Drill links from lessons and the daily plan (front-matter `drills`).

import { href } from '../../app/route';
import { MATH_DRILLS } from '../trainer/math/drills';
import { DRILL_SPOTS } from '../trainer/postflop/spots';

/** Every valid drill id: preflop[:file], postflop[:spot], math[:drill]. */
export function drillIds(chartFiles: string[]): Set<string> {
  return new Set([
    'preflop',
    'postflop',
    'math',
    'review',
    ...chartFiles.map((f) => `preflop:${f}`),
    ...DRILL_SPOTS.map((s) => `postflop:${s.id}`),
    ...MATH_DRILLS.map((d) => `math:${d.id}`),
  ]);
}

export function drillHref(id: string): string {
  const [kind = '', arg] = id.split(':');
  if (kind === 'preflop') return href('trainer', ['preflop'], arg ? { files: arg } : {});
  if (kind === 'postflop') return href('trainer', ['postflop'], arg ? { spot: arg } : {});
  if (kind === 'math') return href('trainer', ['math'], arg ? { drill: arg } : {});
  return href('trainer', ['review']);
}
