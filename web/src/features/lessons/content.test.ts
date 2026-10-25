// Every real lesson passes the lint (D-059), and the build-time equities in facts.json are
// current: recomputed here with the engine.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { equity, initSync } from '../../../public/wasm/solver_wasm.js';
import { DRILL_SPOTS } from '../trainer/postflop/spots';
import { FACTS, GLOSSARY, LESSONS, PLACEMENT } from './content';
import { eqDirectives, eqKey, renderInline } from './lesson';
import { bareNumbers, lintLessons } from './lint';
import { drillIds } from './links';

const root = (p: string) => fileURLToPath(new URL(`../../../../${p}`, import.meta.url));
initSync({ module: readFileSync(root('web/public/wasm/solver_wasm_bg.wasm')) });
const index = JSON.parse(readFileSync(root('web/public/data/charts/index.json'), 'utf8')) as { file: string }[];
const charts = new Map(
  index.map((e) => {
    const doc = JSON.parse(readFileSync(root(`data/charts/${e.file}`), 'utf8')) as { charts: { id: string }[] };
    return [e.file, new Set(doc.charts.map((c) => c.id))];
  }),
);

describe('course content', () => {
  it('every lesson passes the lint', () => {
    expect(LESSONS.length).toBeGreaterThan(0);
    const problems = lintLessons(LESSONS, { glossary: GLOSSARY, charts, drills: drillIds(index.map((e) => e.file)), spots: new Set(DRILL_SPOTS.map((s) => s.id)) });
    expect(problems).toEqual([]);
  });

  // Exact preflop range equities are slow, so this test has its own time limit (D-070).
  it('facts.json holds exactly the current engine equities for every {{eq}}', { timeout: 300_000 }, () => {
    const wanted = new Map<string, ReturnType<typeof eqDirectives>[number]>();
    for (const l of LESSONS) for (const e of eqDirectives(l.body)) wanted.set(eqKey(e), e);
    for (const [k, e] of wanted) {
      const r = JSON.parse(equity(JSON.stringify({ ranges: [e.a, e.b], board: e.board, dead: '', mode: 'exact' })));
      expect(r.ok, k).toBe(true);
      expect(FACTS[k], `${k} missing or stale: run npm run facts`).toBeCloseTo(r.players[0].equity, 12);
    }
    expect(Object.keys(FACTS).sort()).toEqual([...wanted.keys()].sort());
  });

  it('the glossary has plain definitions and placement questions are well formed', () => {
    for (const [term, def] of GLOSSARY) {
      expect(def.length, term).toBeGreaterThan(20);
      expect(bareNumbers(def), term).toEqual([]);
    }
    for (const q of PLACEMENT) {
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      expect(q.answer).toBeLessThan(q.choices.length);
      expect(q.level).toBeGreaterThanOrEqual(0);
      expect(renderInline(q.q, GLOSSARY)).not.toContain('gloss-missing');
    }
  });
});
