// Trainer persistence (D-056): answers, scheduling state and settings, on this device only.
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

export type TrainerExport = {
  schema: 'openrange.trainer/1';
  exportedAt: string;
  answers: AnswerRecord[];
  families: FamilyState[];
  settings: TrainerSettings;
};

export interface TrainerStore {
  addAnswer(a: AnswerRecord): Promise<void>;
  answers(): Promise<AnswerRecord[]>;
  families(): Promise<Map<string, FamilyState>>;
  putFamily(f: FamilyState): Promise<void>;
  settings(): Promise<TrainerSettings>;
  putSettings(s: TrainerSettings): Promise<void>;
  reset(): Promise<void>;
}

const DEFAULT_SETTINGS: TrainerSettings = { thresholds: null };

export class MemoryStore implements TrainerStore {
  private a: AnswerRecord[] = [];
  private f = new Map<string, FamilyState>();
  private s: TrainerSettings = DEFAULT_SETTINGS;
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
  }
}

class TrainerDb extends Dexie {
  answers!: Table<AnswerRecord, number>;
  families!: Table<FamilyState, string>;
  settings!: Table<{ key: string; value: TrainerSettings }, string>;
  constructor() {
    super('openrange-trainer');
    this.version(1).stores({ answers: '++id, at, drill, family', families: 'family', settings: 'key' });
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
  async reset() {
    await this.db.transaction('rw', this.db.answers, this.db.families, this.db.settings, async () => {
      await this.db.answers.clear();
      await this.db.families.clear();
      await this.db.settings.clear();
    });
  }
}

export async function exportAll(store: TrainerStore): Promise<TrainerExport> {
  return {
    schema: 'openrange.trainer/1',
    exportedAt: new Date().toISOString(),
    answers: await store.answers(),
    families: [...(await store.families()).values()],
    settings: await store.settings(),
  };
}

/** Replace everything in the store with an export. Validates the shape before touching data. */
export async function importAll(store: TrainerStore, data: unknown): Promise<number> {
  const d = data as Partial<TrainerExport>;
  if (!d || d.schema !== 'openrange.trainer/1' || !Array.isArray(d.answers) || !Array.isArray(d.families)) {
    throw new Error('this file is not an OpenRange trainer export');
  }
  await store.reset();
  for (const a of d.answers) await store.addAnswer(a);
  for (const f of d.families) await store.putFamily(f);
  await store.putSettings(d.settings ?? DEFAULT_SETTINGS);
  return d.answers.length;
}

let shared: TrainerStore | null = null;
export function trainerStore(): TrainerStore {
  shared ??= new DexieStore();
  return shared;
}
