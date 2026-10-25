// Trainer and course persistence (D-056, D-060): answers, scheduling state, settings, lesson
// progress, math-drill attempts and the placement result, on this device only.
// The app uses the Dexie (IndexedDB) store; tests use the in-memory one.

import Dexie, { type Table } from 'dexie';
import type { Category, Thresholds, Unit } from './grading';
import type { FamilyState } from './srs';

export type AnswerRecord = {
  id?: number;
  at: number;
  drill: 'preflop' | 'postflop';
  /** False for practice answers (no graded reference): kept for history, excluded from stats. */
  graded: boolean;
  family: string;
  /** Where the reference came from (file + chart, or postflop preset + solve accuracy). */
  reference: Record<string, string | number | boolean | null>;
  hand: string;
  handClass: string;
  actions: string[];
  chosen: number;
  unit: Unit;
  category: Category | null;
  loss: number | null;
  gradedLoss: number | null;
  /** Stats dimensions: drill, position, scenario, street, hand class… */
  groups: Record<string, string>;
};

export type TrainerSettings = { thresholds: Record<Unit, Thresholds> | null };

export type LessonProgress = { id: string; completedAt: number; lastScore: number; bestScore: number; questions: number; attempts: number };

export type MathAttempt = { id?: number; at: number; drill: string; correct: boolean; given: string; answer: string };

export type PlacementResult = { at: number; perLevel: { level: number; correct: number; total: number }[]; startLevel: number; chosen: boolean };

export type TrainerExport = {
  schema: 'openrange.trainer/2';
  exportedAt: string;
  answers: AnswerRecord[];
  families: FamilyState[];
  settings: TrainerSettings;
  lessons: LessonProgress[];
  math: MathAttempt[];
  placement: PlacementResult | null;
};

export interface TrainerStore {
  addAnswer(a: AnswerRecord): Promise<void>;
  answers(): Promise<AnswerRecord[]>;
  families(): Promise<Map<string, FamilyState>>;
  putFamily(f: FamilyState): Promise<void>;
  settings(): Promise<TrainerSettings>;
  putSettings(s: TrainerSettings): Promise<void>;
  lessons(): Promise<Map<string, LessonProgress>>;
  putLesson(p: LessonProgress): Promise<void>;
  addMath(a: MathAttempt): Promise<void>;
  math(): Promise<MathAttempt[]>;
  placement(): Promise<PlacementResult | null>;
  putPlacement(p: PlacementResult): Promise<void>;
  reset(): Promise<void>;
}

const DEFAULT_SETTINGS: TrainerSettings = { thresholds: null };

export class MemoryStore implements TrainerStore {
  private a: AnswerRecord[] = [];
  private f = new Map<string, FamilyState>();
  private s: TrainerSettings = DEFAULT_SETTINGS;
  private l = new Map<string, LessonProgress>();
  private m: MathAttempt[] = [];
  private pl: PlacementResult | null = null;
  async lessons() {
    return new Map(this.l);
  }
  async putLesson(p: LessonProgress) {
    this.l.set(p.id, p);
  }
  async addMath(a: MathAttempt) {
    this.m.push({ ...a, id: this.m.length + 1 });
  }
  async math() {
    return [...this.m];
  }
  async placement() {
    return this.pl;
  }
  async putPlacement(p: PlacementResult) {
    this.pl = p;
  }
  async addAnswer(a: AnswerRecord) {
    this.a.push({ ...a, id: this.a.length + 1 });
  }
  async answers() {
    return [...this.a];
  }
  async families() {
    return new Map(this.f);
  }
  async putFamily(f: FamilyState) {
    this.f.set(f.family, f);
  }
  async settings() {
    return this.s;
  }
  async putSettings(s: TrainerSettings) {
    this.s = s;
  }
  async reset() {
    this.a = [];
    this.f.clear();
    this.s = DEFAULT_SETTINGS;
    this.l.clear();
    this.m = [];
    this.pl = null;
  }
}

class TrainerDb extends Dexie {
  answers!: Table<AnswerRecord, number>;
  families!: Table<FamilyState, string>;
  settings!: Table<{ key: string; value: TrainerSettings }, string>;
  lessons!: Table<LessonProgress, string>;
  math!: Table<MathAttempt, number>;
  placement!: Table<{ key: string; value: PlacementResult }, string>;
  constructor() {
    super('openrange-trainer');
    this.version(1).stores({ answers: '++id, at, drill, family', families: 'family', settings: 'key' });
    // Schema 2 (M7): course progress. Adding tables keeps existing data.
    this.version(2).stores({ lessons: 'id', math: '++id, at, drill', placement: 'key' });
  }
}

export class DexieStore implements TrainerStore {
  private db = new TrainerDb();
  async addAnswer(a: AnswerRecord) {
    const { id: _id, ...rest } = a;
    await this.db.answers.add(rest);
  }
  async answers() {
    return this.db.answers.orderBy('at').toArray();
  }
  async families() {
    const all = await this.db.families.toArray();
    return new Map(all.map((f) => [f.family, f]));
  }
  async putFamily(f: FamilyState) {
    await this.db.families.put(f);
  }
  async settings() {
    return (await this.db.settings.get('trainer'))?.value ?? DEFAULT_SETTINGS;
  }
  async putSettings(s: TrainerSettings) {
    await this.db.settings.put({ key: 'trainer', value: s });
  }
  async lessons() {
    const all = await this.db.lessons.toArray();
    return new Map(all.map((p) => [p.id, p]));
  }
  async putLesson(p: LessonProgress) {
    await this.db.lessons.put(p);
  }
  async addMath(a: MathAttempt) {
    const { id: _id, ...rest } = a;
    await this.db.math.add(rest);
  }
  async math() {
    return this.db.math.orderBy('at').toArray();
  }
  async placement() {
    return (await this.db.placement.get('placement'))?.value ?? null;
  }
  async putPlacement(p: PlacementResult) {
    await this.db.placement.put({ key: 'placement', value: p });
  }
  async reset() {
    const db = this.db;
    await db.transaction('rw', [db.answers, db.families, db.settings, db.lessons, db.math, db.placement], async () => {
      await Promise.all([db.answers.clear(), db.families.clear(), db.settings.clear(), db.lessons.clear(), db.math.clear(), db.placement.clear()]);
    });
  }
}

export async function exportAll(store: TrainerStore): Promise<TrainerExport> {
  return {
    schema: 'openrange.trainer/2',
    exportedAt: new Date().toISOString(),
    answers: await store.answers(),
    families: [...(await store.families()).values()],
    settings: await store.settings(),
    lessons: [...(await store.lessons()).values()],
    math: await store.math(),
    placement: await store.placement(),
  };
}

/**
 * Replace everything in the store with an export (schema 2, or schema 1 from before the
 * course existed). Validates the shape before touching data.
 */
export async function importAll(store: TrainerStore, data: unknown): Promise<number> {
  const d = data as Partial<Omit<TrainerExport, 'schema'>> & { schema?: string };
  const known = d?.schema === 'openrange.trainer/1' || d?.schema === 'openrange.trainer/2';
  if (!d || !known || !Array.isArray(d.answers) || !Array.isArray(d.families)) {
    throw new Error('this file is not an OpenRange trainer export');
  }
  if (d.schema === 'openrange.trainer/2' && (!Array.isArray(d.lessons) || !Array.isArray(d.math))) {
    throw new Error('this trainer export is incomplete');
  }
  await store.reset();
  for (const a of d.answers) await store.addAnswer(a);
  for (const f of d.families) await store.putFamily(f);
  await store.putSettings(d.settings ?? DEFAULT_SETTINGS);
  for (const l of d.lessons ?? []) await store.putLesson(l);
  for (const m of d.math ?? []) await store.addMath(m);
  if (d.placement) await store.putPlacement(d.placement);
  return d.answers.length;
}

let shared: TrainerStore | null = null;
export function trainerStore(): TrainerStore {
  shared ??= new DexieStore();
  return shared;
}
