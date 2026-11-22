import { describe, expect, it } from 'vitest';
import { newFamily } from './srs';
import { exportAll, importAll, MemoryStore, type AnswerRecord } from './store';

const answer: AnswerRecord = {
  at: 1,
  drill: 'preflop',
  graded: true,
  family: 'f',
  reference: { file: 'charts/pushfold-hu.json', chart: 'sb-shove-10' },
  hand: 'AhKd',
  handClass: 'AKo',
  actions: ['Fold', 'All-in'],
  chosen: 1,
  unit: 'bb',
  category: 'best',
  loss: 0,
  gradedLoss: 0,
  groups: { drill: 'preflop', position: 'SB' },
};

describe('trainer store', () => {
  it('round-trips through export and import', async () => {
    const a = new MemoryStore();
    await a.addAnswer(answer);
    await a.putFamily(newFamily('f', 0));
    const dump = JSON.parse(JSON.stringify(await exportAll(a)));
    const b = new MemoryStore();
    expect(await importAll(b, dump)).toBe(1);
    expect((await b.answers())[0]!.hand).toBe('AhKd');
    expect((await b.families()).get('f')!.ease).toBe(2.5);
  });

  it('carries course progress and still imports schema-1 files', async () => {
    const a = new MemoryStore();
    await a.putLesson({ id: '2.3', completedAt: 5, lastScore: 3, bestScore: 4, questions: 4, attempts: 2 });
    await a.addMath({ at: 6, drill: 'potodds', correct: true, given: '25', answer: '25%' });
    await a.putPlacement({ at: 7, perLevel: [{ level: 0, correct: 3, total: 3 }], startLevel: 1, chosen: false });
    const dump = JSON.parse(JSON.stringify(await exportAll(a)));
    expect(dump.schema).toBe('openrange.trainer/4');
    const b = new MemoryStore();
    await importAll(b, dump);
    expect((await b.lessons()).get('2.3')!.bestScore).toBe(4);
    expect(await b.math()).toHaveLength(1);
    expect((await b.placement())!.startLevel).toBe(1);
    const old = { schema: 'openrange.trainer/1', exportedAt: '', answers: [answer], families: [], settings: { thresholds: null } };
    const c = new MemoryStore();
    expect(await importAll(c, old)).toBe(1);
    expect(await c.lessons()).toEqual(new Map());
  });

  it('refuses files that are not trainer exports without touching data', async () => {
    const s = new MemoryStore();
    await s.addAnswer(answer);
    await expect(importAll(s, { schema: 'something-else' })).rejects.toThrow(/not an OpenRange trainer export/);
    expect(await s.answers()).toHaveLength(1);
  });

  it('carries study notes, and imports schema-2 files (before notes) unchanged', async () => {
    const a = new MemoryStore();
    await a.putNote({ key: 'chart:pushfold-hu.json:sb-shove-10', text: 'shove all aces', updatedAt: 9 });
    await a.addAnswer(answer);
    const dump = JSON.parse(JSON.stringify(await exportAll(a)));
    expect(dump.notes).toHaveLength(1);
    const b = new MemoryStore();
    await importAll(b, dump);
    expect(await b.notes()).toEqual([{ key: 'chart:pushfold-hu.json:sb-shove-10', text: 'shove all aces', updatedAt: 9 }]);
    // A schema-2 export has no notes: it imports, and existing notes are replaced by none.
    const v2 = { ...dump, schema: 'openrange.trainer/2', notes: undefined };
    expect(await importAll(b, v2)).toBe(1);
    expect(await b.notes()).toEqual([]);
    // A schema-3 export without its notes list is incomplete and leaves the data alone.
    await b.putNote({ key: 'k', text: 't', updatedAt: 1 });
    await expect(importAll(b, { ...dump, notes: undefined })).rejects.toThrow(/incomplete/);
    expect(await b.notes()).toHaveLength(1);
  });

  it('carries the journal, and imports schema-3 files (before the journal)', async () => {
    const a = new MemoryStore();
    await a.addJournal({ at: 1, kind: 'goal', goal: 'take a break after big pots', rested: true, stopRule: true });
    await a.addJournal({ at: 2, kind: 'reflection', mood: 4, tilt: 1, wentWell: 'folded early', toImprove: 'two fast hands', nextFocus: 'breaks' });
    const dump = JSON.parse(JSON.stringify(await exportAll(a)));
    expect(dump.journal).toHaveLength(2);
    const b = new MemoryStore();
    await importAll(b, dump);
    expect((await b.journal()).map((e) => e.kind)).toEqual(['goal', 'reflection']);
    const v3 = { ...dump, schema: 'openrange.trainer/3', journal: undefined };
    await importAll(b, v3);
    expect(await b.journal()).toEqual([]);
    await expect(importAll(b, { ...dump, journal: undefined })).rejects.toThrow(/incomplete/);
  });
});
