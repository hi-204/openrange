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

  it('refuses files that are not trainer exports without touching data', async () => {
    const s = new MemoryStore();
    await s.addAnswer(answer);
    await expect(importAll(s, { schema: 'something-else' })).rejects.toThrow(/not an OpenRange trainer export/);
    expect(await s.answers()).toHaveLength(1);
  });
});
