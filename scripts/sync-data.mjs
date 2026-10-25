// Copies generated data the app serves (charts, preflop equities, flop reports) from data/ into
// web/public/data/ and writes an index of the chart files. Runs before `dev` and `build`;
// the copy is git-ignored, data/ is the source of truth.
// Usage: node scripts/sync-data.mjs
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/repo.mjs';

const OUT = join(ROOT, 'web', 'public', 'data');
const charts = join(ROOT, 'data', 'charts');
mkdirSync(join(OUT, 'charts'), { recursive: true });
mkdirSync(join(OUT, 'equity'), { recursive: true });

const index = [];
if (existsSync(charts)) {
  for (const name of readdirSync(charts).filter((f) => f.endsWith('.json')).sort()) {
    copyFileSync(join(charts, name), join(OUT, 'charts', name));
    const doc = JSON.parse(readFileSync(join(charts, name), 'utf8'));
    const stacks = [...new Set(doc.charts.map((c) => c.stack ?? doc.stack))].sort((a, b) => a - b);
    index.push({
      file: name,
      family: doc.family,
      players: doc.players ?? 2,
      stacks,
      source: doc.provenance.source,
      generatedAt: doc.provenance.generatedAt,
      gitCommit: doc.provenance.gitCommit,
      gitDirty: doc.provenance.gitDirty,
      charts: doc.charts.length,
      outOfBand: (doc.sanityBands ?? []).some((b) => !b.inBand),
    });
  }
}
// Show exact results first: heads-up push/fold, then multiway push/fold, then cash.
const rank = (e) => (e.family === 'pushfold-hu' ? 0 : e.family.startsWith('pushfold-') ? 1 : 2);
index.sort((a, b) => rank(a) - rank(b) || a.players - b.players || b.stacks[0] - a.stacks[0]);
writeFileSync(join(OUT, 'charts', 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
copyFileSync(join(ROOT, 'data', 'equity', 'preflop-pairs.json'), join(OUT, 'equity', 'preflop-pairs.json'));
// Aggregated flop reports (solver-cli report).
const reports = join(ROOT, 'data', 'reports');
if (existsSync(reports)) {
  mkdirSync(join(OUT, 'reports'), { recursive: true });
  for (const name of readdirSync(reports).filter((f) => f.endsWith('.json'))) copyFileSync(join(reports, name), join(OUT, 'reports', name));
}
console.log(`sync-data: ${index.length} chart files and preflop equities copied to web/public/data`);
