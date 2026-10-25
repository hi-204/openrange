// Compute every {{eq …}} in the lessons with the engine and write
// web/src/content/en/facts.json (D-059, DESIGN.md §8). Runs before dev/build; a Vitest test
// fails if the committed file is stale. Equities are exact (full enumeration).

import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/repo.mjs';

const lessons = join(ROOT, 'web', 'src', 'content', 'en', 'lessons');
const out = join(ROOT, 'web', 'src', 'content', 'en', 'facts.json');
const wasm = await import(new URL('../web/public/wasm/solver_wasm.js', import.meta.url).href);
wasm.initSync({ module: readFileSync(join(ROOT, 'web', 'public', 'wasm', 'solver_wasm_bg.wasm')) });

function files(dir) {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : p.endsWith('.md') ? [p] : [];
  });
}

/** Same parsing as parseEq in web/src/features/lessons/lesson.ts. */
function parseEq(body) {
  const [main, board = ''] = body.split(/\s+on\s+/);
  const [a, b] = (main ?? '').split(/\s+vs\s+/);
  if (!a?.trim() || !b?.trim()) throw new Error(`eq "${body}": write it as "<hand> vs <hand> [on <board>]"`);
  return { a: a.trim(), b: b.trim(), board: board.trim() };
}
const key = (e) => `${e.a} vs ${e.b}${e.board ? ` on ${e.board}` : ''}`;

const facts = {};
for (const f of files(lessons)) {
  for (const m of readFileSync(f, 'utf8').matchAll(/\{\{eq\s+([^}]+)\}\}/g)) {
    const e = parseEq(m[1]);
    if (key(e) in facts) continue;
    const r = JSON.parse(wasm.equity(JSON.stringify({ ranges: [e.a, e.b], board: e.board, dead: '', mode: 'exact' })));
    if (!r.ok) throw new Error(`${f}: {{eq ${m[1]}}}: ${r.error}`);
    facts[key(e)] = r.players[0].equity;
  }
}
const sorted = Object.fromEntries(Object.entries(facts).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(out, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`gen-lesson-facts: ${Object.keys(sorted).length} equities written to web/src/content/en/facts.json`);
