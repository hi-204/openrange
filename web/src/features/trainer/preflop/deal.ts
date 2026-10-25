// Preflop drill: which chart decisions can be drilled, how they group into spot families, and
// how a hand is dealt (D-051, D-054). Pure functions over chart files.

import type { Chart, ChartFile, ChartIndexEntry } from '../../../lib/provenance/types';
import { pickFamily, type FamilyState } from '../srs';

/** Reach below this: the hand (almost) never gets to the decision (same as the chart grid). */
export const UNREACHED = 0.005;

export type DrillSource = { file: string; family: string; players: number; graded: boolean };

/** Cash charts are practice only (D-050, D-051); everything else in the library is graded. */
export function drillSources(index: ChartIndexEntry[]): DrillSource[] {
  return index.map((e) => ({ file: e.file, family: e.family, players: e.players, graded: e.family !== 'cash-6max' }));
}

export type Difficulty = 'any' | 'easy' | 'medium' | 'hard';

export type Filters = {
  /** Chart files to draw from. */
  files: string[];
  /** Seats to play; empty = any. */
  seats: string[];
  /** Scenarios (first-in, vs-open, …); empty = any. */
  scenarios: string[];
  stackMin: number;
  stackMax: number;
  difficulty: Difficulty;
};

export const stackOf = (doc: ChartFile, chart: Chart) => chart.stack ?? doc.stack!;

export function scenarioOf(chart: Chart): string {
  if (chart.scenario) return chart.scenario;
  if (chart.id.startsWith('sb-shove')) return 'first-in';
  if (chart.id.startsWith('bb-call')) return 'vs-all-in';
  return 'other';
}

/** The decision without its stack, e.g. "sb-shove" for "sb-shove-10". */
export function decisionKey(chart: Chart): string {
  return chart.stack !== undefined ? chart.id.replace(new RegExp(`-${chart.stack}$`), '') : chart.id;
}

export function stackBand(family: string, stack: number): string {
  if (family === 'cash-6max') return `${stack}`;
  return stack <= 7 ? '2-7' : stack <= 14 ? '8-14' : '15-25';
}

export function familyKey(doc: ChartFile, chart: Chart): string {
  return `preflop|${doc.family}|${decisionKey(chart)}|${stackBand(doc.family, stackOf(doc, chart))}`;
}

export const combosIn = (name: string) => (name.length === 2 ? 6 : name[2] === 's' ? 4 : 12);

/** How hard a hand's decision is: close EVs or a mixed strategy are hard. */
export function difficultyOf(chart: Chart, k: number): Exclude<Difficulty, 'any'> {
  const strat = chart.strategy[k]!;
  if (Math.max(...strat) < 0.9) return 'hard';
  const evs = (chart.ev?.[k] ?? []).filter((e): e is number => e !== null).sort((a, b) => b - a);
  if (evs.length < 2) return 'hard';
  const gap = evs[0]! - evs[1]!;
  return gap < 0.1 ? 'hard' : gap < 0.5 ? 'medium' : 'easy';
}

/** Dealing weight of each class: its combos × how often the player gets here with it. */
export function classWeights(chart: Chart, classes: string[], difficulty: Difficulty): number[] {
  return classes.map((name, k) => {
    const reach = chart.reach ? chart.reach[k]! : 1;
    if (reach < UNREACHED || !chart.ev?.[k]) return 0;
    if (difficulty !== 'any' && difficultyOf(chart, k) !== difficulty) return 0;
    return combosIn(name) * reach;
  });
}

export type Candidate = { source: DrillSource; doc: ChartFile; chart: Chart; weights: number[] };

/** Drillable decisions under the filters, grouped by spot family. */
export function candidates(docs: { source: DrillSource; doc: ChartFile }[], f: Filters): Map<string, Candidate[]> {
  const out = new Map<string, Candidate[]>();
  for (const { source, doc } of docs) {
    if (!f.files.includes(source.file)) continue;
    for (const chart of doc.charts) {
      const stack = stackOf(doc, chart);
      if (stack < f.stackMin || stack > f.stackMax) continue;
      if (f.seats.length && !f.seats.includes(chart.seat)) continue;
      if (f.scenarios.length && !f.scenarios.includes(scenarioOf(chart))) continue;
      const weights = classWeights(chart, doc.classes, f.difficulty);
      if (!weights.some((w) => w > 0)) continue;
      const key = familyKey(doc, chart);
      out.set(key, [...(out.get(key) ?? []), { source, doc, chart, weights }]);
    }
  }
  return out;
}

export type Dealt = Candidate & { family: string; classIndex: number; handClass: string; combo: string; stack: number };

const SUITS = 'shdc';

/** A uniformly random combo of a class, e.g. "AhKh" for AKs. */
export function randomCombo(name: string, rnd: () => number): string {
  const [a, b] = [name[0]!, name[1]!];
  const pick = (n: number) => Math.floor(rnd() * n);
  if (name.length === 2) {
    const s1 = pick(4);
    const s2 = (s1 + 1 + pick(3)) % 4;
    return `${a}${SUITS[s1]}${b}${SUITS[s2]}`;
  }
  if (name[2] === 's') {
    const s = SUITS[pick(4)]!;
    return `${a}${s}${b}${s}`;
  }
  const s1 = pick(4);
  const s2 = (s1 + 1 + pick(3)) % 4;
  return `${a}${SUITS[s1]}${b}${SUITS[s2]}`;
}

function weighted(weights: number[], rnd: () => number): number {
  const total = weights.reduce((s, w) => s + w, 0);
  let x = rnd() * total;
  for (let i = 0; i < weights.length; i++) {
    x -= weights[i]!;
    if (x < 0 && weights[i]! > 0) return i;
  }
  return weights.findLastIndex((w) => w > 0);
}

/**
 * Deal the next hand: graded families are chosen by the scheduler (overdue, then new, then
 * soonest due), practice families at random; then a decision within the family, a class by
 * dealing weight and a combo of that class.
 */
export function deal(pool: Map<string, Candidate[]>, states: Map<string, FamilyState>, now: number, rnd: () => number): Dealt | null {
  const keys = [...pool.keys()];
  if (!keys.length) return null;
  const graded = keys.filter((k) => pool.get(k)![0]!.source.graded);
  // Mix in practice families only when the filters include nothing graded or by chance.
  const usePractice = graded.length === 0 || (graded.length < keys.length && rnd() < (keys.length - graded.length) / keys.length);
  const family = usePractice
    ? keys.filter((k) => !graded.includes(k))[Math.floor(rnd() * (keys.length - graded.length))]!
    : pickFamily(shuffle(graded, rnd), states, now)!;
  const options = pool.get(family)!;
  const c = options[Math.floor(rnd() * options.length)]!;
  const classIndex = weighted(c.weights, rnd);
  const handClass = c.doc.classes[classIndex]!;
  return { ...c, family, classIndex, handClass, combo: randomCombo(handClass, rnd), stack: stackOf(c.doc, c.chart) };
}

/** New families come in a random order rather than chart-file order. */
function shuffle<T>(xs: T[], rnd: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Seeded PRNG (mulberry32), so tests and "replay this deal" are reproducible. */
export function mulberry32(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
