// Weakness-targeted sessions (D-089): one tap builds a drill session from your leaks when the
// stats can show them, otherwise from your recent mistakes and the review items you lapsed on.

import type { FamilyState } from '../trainer/srs';
import { groupStats, STATS_DIMENSIONS, type GradedAnswer } from '../trainer/stats';
import type { AnswerRecord } from '../trainer/store';

export const DIMENSIONS = STATS_DIMENSIONS;
/** How many recent answers the fallback looks at, and how many families a session targets. */
export const RECENT = 60;
export const MAX_FAMILIES = 8;

export type WeakPlan = {
  source: 'leaks' | 'recent' | 'none';
  /** Leak groups the plan came from (dimension = value), for the explanation. */
  leaks: { dimension: string; value: string }[];
  /** Preflop spot families to drill, and the chart files they come from. */
  families: string[];
  files: string[];
  /** Postflop drill spots with weak answers. */
  postflopSpots: string[];
};

const graded = (a: AnswerRecord): a is AnswerRecord & { category: NonNullable<AnswerRecord['category']>; loss: number } => a.graded && a.category !== null && a.loss !== null;
const isError = (a: AnswerRecord) => a.category === 'mistake' || a.category === 'blunder';

function collect(answers: AnswerRecord[]): Pick<WeakPlan, 'families' | 'files' | 'postflopSpots'> {
  const families: string[] = [];
  const files = new Set<string>();
  const spots = new Set<string>();
  // Most recent first, so a capped session keeps the freshest weaknesses.
  for (const a of [...answers].sort((x, y) => y.at - x.at)) {
    if (a.drill === 'preflop') {
      if (!families.includes(a.family) && families.length < MAX_FAMILIES) families.push(a.family);
      if (typeof a.reference.file === 'string') files.add(a.reference.file);
    } else if (a.drill === 'postflop' && typeof a.reference.spot === 'string') spots.add(a.reference.spot);
  }
  return { families, files: [...files], postflopSpots: [...spots] };
}

export function weakPlan(answers: AnswerRecord[], families: Map<string, FamilyState>): WeakPlan {
  const g = answers.filter(graded);
  const stats = groupStats(
    g.map((a): GradedAnswer => ({ unit: a.unit, loss: a.loss, category: a.category, groups: a.groups })),
    DIMENSIONS,
  );
  const leaks = stats.filter((s) => s.leak);
  if (leaks.length) {
    const inLeak = g.filter((a) => leaks.some((l) => a.unit === l.unit && a.groups[l.dimension] === l.value) && (isError(a) || a.category === 'inaccuracy'));
    const c = collect(inLeak);
    if (c.families.length || c.postflopSpots.length) return { source: 'leaks', leaks: leaks.map((l) => ({ dimension: l.dimension, value: l.value })), ...c };
  }
  // Not enough data for leaks: recent mistakes, plus families you lapsed on in review.
  const recent = [...g].sort((x, y) => y.at - x.at).slice(0, RECENT).filter(isError);
  const lapsed = new Set([...families.values()].filter((f) => f.lapses > 0).map((f) => f.family));
  const fromLapses = g.filter((a) => lapsed.has(a.family));
  const c = collect([...recent, ...fromLapses]);
  if (c.families.length || c.postflopSpots.length) return { source: 'recent', leaks: [], ...c };
  return { source: 'none', leaks: [], families: [], files: [], postflopSpots: [] };
}
