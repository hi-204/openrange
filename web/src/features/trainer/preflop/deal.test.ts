import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChartFile, ChartIndexEntry } from '../../../lib/provenance/types';
import { newFamily, review } from '../srs';
import { candidates, deal, decisionKey, difficultyOf, drillSources, familyKey, mulberry32, randomCombo, UNREACHED, type Filters } from './deal';

const root = (p: string) => fileURLToPath(new URL(`../../../../../${p}`, import.meta.url));
const load = (f: string) => JSON.parse(readFileSync(root(`data/charts/${f}`), 'utf8')) as ChartFile;
const files = ['pushfold-hu.json', 'pushfold-3max.json', 'pushfold-6max.json', 'cash-6max-100bb.json'];
const index = files.map((file) => {
  const d = load(file);
  return { file, family: d.family, players: d.players ?? 6 } as ChartIndexEntry;
});
const sources = drillSources(index);
const docs = sources.map((source) => ({ source, doc: load(source.file) }));
const all: Filters = { files, seats: [], scenarios: [], stackMin: 0, stackMax: 1000, difficulty: 'any' };

describe('preflop dealing', () => {
  it('grades push/fold and treats cash charts as practice', () => {
    expect(sources.find((s) => s.family === 'cash-6max')!.graded).toBe(false);
    expect(sources.filter((s) => s.family !== 'cash-6max').every((s) => s.graded)).toBe(true);
  });

  it('groups decisions into families by decision and stack band', () => {
    const hu = docs[0]!.doc;
    const c10 = hu.charts.find((c) => c.id === 'sb-shove-10')!;
    const c12 = hu.charts.find((c) => c.id === 'sb-shove-12')!;
    const c20 = hu.charts.find((c) => c.id === 'sb-shove-20')!;
    expect(decisionKey(c10)).toBe('sb-shove');
    expect(familyKey(hu, c10)).toBe(familyKey(hu, c12));
    expect(familyKey(hu, c10)).not.toBe(familyKey(hu, c20));
  });

  it('only deals hands that reach the decision, within the filters', () => {
    const pool = candidates(docs, { ...all, seats: ['BB'], stackMax: 20 });
    const rnd = mulberry32(7);
    for (let i = 0; i < 500; i++) {
      const d = deal(pool, new Map(), 0, rnd)!;
      expect(d.chart.seat).toBe('BB');
      expect(d.stack).toBeLessThanOrEqual(20);
      const reach = d.chart.reach?.[d.classIndex] ?? 1;
      expect(reach).toBeGreaterThanOrEqual(UNREACHED);
      expect(d.combo.length).toBe(4);
    }
  });

  it('respects the difficulty filter', () => {
    const pool = candidates(docs, { ...all, files: ['pushfold-hu.json'], difficulty: 'hard' });
    const rnd = mulberry32(1);
    for (let i = 0; i < 300; i++) {
      const d = deal(pool, new Map(), 0, rnd)!;
      expect(difficultyOf(d.chart, d.classIndex)).toBe('hard');
    }
  });

  it('serves overdue families before new ones', () => {
    const pool = candidates(docs, { ...all, files: ['pushfold-hu.json'] });
    const keys = [...pool.keys()];
    const now = 10 ** 12;
    const states = new Map(keys.map((k) => [k, { ...review(newFamily(k, 0), 'best', 0), due: now + 1e9 }]));
    const target = keys[1]!;
    states.set(target, { ...states.get(target)!, due: now - 1 });
    expect(deal(pool, states, now, mulberry32(3))!.family).toBe(target);
  });

  it('deals real combos of the class', () => {
    const rnd = mulberry32(11);
    for (const name of ['AA', 'AKs', 'AKo', '72o']) {
      for (let i = 0; i < 50; i++) {
        const c = randomCombo(name, rnd);
        expect(c[0]! + c[2]!).toBe(name.slice(0, 2));
        if (name.endsWith('s')) expect(c[1]).toBe(c[3]);
        else expect(c[1]).not.toBe(c[3]);
      }
    }
  });
});
