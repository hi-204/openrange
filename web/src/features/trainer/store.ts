// Trainer and course persistence (D-056, D-060): answers, scheduling state, settings, lesson
// progress, math-drill attempts and the placement result, on this device only.
// The app uses the Dexie (IndexedDB) store; tests use the in-memory one.

import Dexie, { type Table } from 'dexie';
import type { Category, Thresholds, Unit } from './grading';
import type { FamilyState } from './srs';

export type AnswerRecord = {
  id?: number;
  at: number;
  drill: 'preflop' | 'postflop' | 'tournament';
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
  /** Hints revealed before answering (recorded; never counted against accuracy). */
  hints?: number;
  /** Stats dimensions: drill, position, scenario, street, hand class… */
  groups: Record<string, string>;
};

export type TrainerSettings = { thresholds: Record<Unit, Thresholds> | null };

export type LessonProgress = { id: string; completedAt: number; lastScore: number; bestScore: number; questions: number; attempts: number };

export type MathAttempt = {
  id?: number;
  at: number;
  drill: string;
  correct: boolean;
  given: string;
  answer: string;
  /** Math Lab (D-087): each part right or wrong. */
  parts?: boolean[];
  /** Equity estimates (Math Lab): the learner's estimate and the exact equity, as shares. */
  estimate?: number;
  exact?: number;
};

/** A study note attached to a spot (D-091), e.g. key "chart:cash-6max-100bb.json:first-in-BTN". */
export type SpotNote = { key: string; text: string; updatedAt: number };

export type PlacementResult = { at: number; perLevel: { level: number; correct: number; total: number }[]; startLevel: number; chosen: boolean };

/** Export format version; imports also accept /1 and /2 (D-091). */
export const EXPORT_SCHEMA = 'openrange.trainer/3';

export type TrainerExport = {
  schema: typeof EXPORT_SCHEMA;
  exportedAt: string;
  answers: AnswerRecord[];
  families: FamilyState[];
  settings: TrainerSettings;
  lessons: LessonProgress[];
  math: MathAttempt[];
  placement: PlacementResult | null;
  /** App settings (display, modes, coaching…); absent in exports made before M6.5. */
  app?: unknown;
  /** Study notes (schema 3). */
  notes: SpotNote[];
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
  /** App settings as stored (normalised by lib/settings). */
  appSettings(): Promise<unknown>;
  putAppSettings(s: unknown): Promise<void>;
  notes(): Promise<SpotNote[]>;
  putNote(n: SpotNote): Promise<void>;
  deleteNote(key: string): Promise<void>;
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
  private app: unknown = null;
  private n = new Map<string, SpotNote>();
  async notes() {
    return [...this.n.values()];
  }
  async putNote(n: SpotNote) {
    this.n.set(n.key, n);
  }
  async deleteNote(key: string) {
    this.n.delete(key);
  }
  async appSettings() {
    return this.app;
  }
  async putAppSettings(s: unknown) {
    this.app = s;
  }
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
    this.app = null;
    this.n.clear();
  }
}

class TrainerDb extends Dexie {
  answers!: Table<AnswerRecord, number>;
  families!: Table<FamilyState, string>;
  // Holds "trainer" (grading thresholds) and "app" (lib/settings) under their keys.
  settings!: Table<{ key: string; value: unknown }, string>;
  lessons!: Table<LessonProgress, string>;
  math!: Table<MathAttempt, number>;
  placement!: Table<{ key: string; value: PlacementResult }, string>;
  notes!: Table<SpotNote, string>;
  constructor() {
    super('openrange-trainer');
    this.version(1).stores({ answers: '++id, at, drill, family', families: 'family', settings: 'key' });
    // Schema 2 (M7): course progress. Adding tables keeps existing data.
    this.version(2).stores({ lessons: 'id', math: '++id, at, drill', placement: 'key' });
    // Schema 3 (expansion Phase 4): study notes. Adding a table keeps existing data.
    this.version(3).stores({ notes: 'key' });
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
    return ((await this.db.settings.get('trainer'))?.value as TrainerSettings | undefined) ?? DEFAULT_SETTINGS;
  }
  async putSettings(s: TrainerSettings) {
    await this.db.settings.put({ key: 'trainer', value: s });
  }
  async appSettings() {
    return (await this.db.settings.get('app'))?.value ?? null;
  }
  async putAppSettings(s: unknown) {
    await this.db.settings.put({ key: 'app', value: s });
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
  async notes() {
    return this.db.notes.toArray();
  }
  async putNote(n: SpotNote) {
    await this.db.notes.put(n);
  }
  async deleteNote(key: string) {
    await this.db.notes.delete(key);
  }
  async reset() {
    const db = this.db;
    await db.transaction('rw', [db.answers, db.families, db.settings, db.lessons, db.math, db.placement, db.notes], async () => {
      await Promise.all([db.answers.clear(), db.families.clear(), db.settings.clear(), db.lessons.clear(), db.math.clear(), db.placement.clear(), db.notes.clear()]);
    });
  }
}

export async function exportAll(store: TrainerStore): Promise<TrainerExport> {
  return {
    schema: EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    answers: await store.answers(),
    families: [...(await store.families()).values()],
    settings: await store.settings(),
    lessons: [...(await store.lessons()).values()],
    math: await store.math(),
    placement: await store.placement(),
    app: await store.appSettings(),
    notes: await store.notes(),
  };
}

/**
 * Replace everything in the store with an export: schema 3, 2 (before notes) or 1 (before the
 * course existed). Validates the shape before touching data.
 */
export async function importAll(store: TrainerStore, data: unknown): Promise<number> {
  const d = data as Partial<Omit<TrainerExport, 'schema'>> & { schema?: string };
  const version = d?.schema === 'openrange.trainer/1' ? 1 : d?.schema === 'openrange.trainer/2' ? 2 : d?.schema === EXPORT_SCHEMA ? 3 : 0;
  if (!d || !version || !Array.isArray(d.answers) || !Array.isArray(d.families)) {
    throw new Error('this file is not an OpenRange trainer export');
  }
  if (version >= 2 && (!Array.isArray(d.lessons) || !Array.isArray(d.math))) {
    throw new Error('this trainer export is incomplete');
  }
  if (version >= 3 && !Array.isArray(d.notes)) {
    throw new Error('this trainer export is incomplete');
  }
  await store.reset();
  for (const a of d.answers) await store.addAnswer(a);
  for (const f of d.families) await store.putFamily(f);
  await store.putSettings(d.settings ?? DEFAULT_SETTINGS);
  for (const l of d.lessons ?? []) await store.putLesson(l);
  for (const m of d.math ?? []) await store.addMath(m);
  if (d.placement) await store.putPlacement(d.placement);
  if (d.app) await store.putAppSettings(d.app);
  for (const n of d.notes ?? []) await store.putNote(n);
  return d.answers.length;
}

let shared: TrainerStore | null = null;
export function trainerStore(): TrainerStore {
  shared ??= new DexieStore();
  return shared;
}
