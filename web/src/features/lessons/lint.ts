// Lesson lint (D-059): structure, references and the "no typed numbers" rule. Returns a list of
// problems ("<file>: <message>"); the test suite requires it to be empty for every lesson.

import { evaluate, parseCalc } from './calc';
import { parseEq, renderLesson, type Glossary, type Lesson } from './lesson';
import { WIDGETS } from './widgets/registry';

export type LintContext = {
  glossary: Glossary;
  /** Chart file → chart ids. */
  charts: Map<string, Set<string>>;
  drills: Set<string>;
  /** Postflop drill spot ids (mini-solver widget). */
  spots: Set<string>;
};

export const REQUIRED_SECTIONS = ['Worked hand', 'Common mistakes', 'Check yourself'];

/** Strip everything where numbers are allowed: fences, math, directives, inline code, front links. */
export function prose(body: string): string {
  return body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\$\$[\s\S]*?\$\$/g, ' ')
    .replace(/\$[^$\n]*\$/g, ' ')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/\]\([^)]*\)/g, ']');
}

/**
 * Typed percentages, decimals and dollar signs. Allowed: the blinds "0.5/1" and amounts in big
 * blinds such as "2.5 bb", which are inputs of a scenario, not results (D-069).
 */
export function bareNumbers(body: string): string[] {
  const text = prose(body)
    .replace(/\b0\.5\/1\b/g, ' ')
    .replace(/\b\d+\.\d+(?= ?bb\b)/g, ' ')
    .replace(/\b([Ll]essons?|and) \d\.\d+\b/g, ' ');
  const found: string[] = [];
  for (const re of [/\d+(?:\.\d+)?\s?%/g, /\b\d+\.\d+\b/g, /\$/g, /\bper ?cent\b/gi]) for (const m of text.matchAll(re)) found.push(m[0]);
  return found;
}

export function lintLessons(lessons: Lesson[], ctx: LintContext): string[] {
  const bad: string[] = [];
  const ids = new Map<string, Lesson>();
  for (const l of lessons) {
    if (ids.has(l.meta.id)) bad.push(`${l.path}: duplicate id ${l.meta.id}`);
    ids.set(l.meta.id, l);
  }
  const order = (id: string) => id.split('.').map(Number);
  const before = (a: string, b: string) => {
    const [x, y] = [order(a), order(b)];
    return x[0]! < y[0]! || (x[0] === y[0] && x[1]! < y[1]!);
  };

  for (const l of lessons) {
    const p = (msg: string) => bad.push(`${l.path}: ${msg}`);
    const m = l.meta;
    if (!/^\d\.\d+$/.test(m.id)) p(`id "${m.id}" must look like "2.3"`);
    if (Number(m.id.split('.')[0]) !== m.level) p(`id ${m.id} doesn't match level ${m.level}`);
    if (!m.title) p('missing title');
    if (!(m.minutes >= 5 && m.minutes <= 10)) p(`minutes must be 5–10, got ${m.minutes}`);
    if (m.objectives.length < 2 || m.objectives.length > 4) p(`needs 2–4 objectives ("What you'll learn"), has ${m.objectives.length}`);
    if (m.recap.length < 2 || m.recap.length > 4) p(`needs 2–4 recap points, has ${m.recap.length}`);
    for (const n of bareNumbers([...m.objectives, ...m.recap].join(' '))) p(`front-matter: typed number "${n}"`);
    for (const pre of m.prerequisites) {
      if (!ids.has(pre)) p(`unknown prerequisite ${pre}`);
      else if (!before(pre, m.id)) p(`prerequisite ${pre} comes after ${m.id}`);
    }
    for (const d of m.drills) if (!ctx.drills.has(d)) p(`unknown drill link "${d}"`);
    for (const g of m.glossary) {
      if (!ctx.glossary.has(g.toLowerCase())) p(`front-matter glossary term "${g}" is not in the glossary`);
      if (!l.body.toLowerCase().includes(`[[${g.toLowerCase()}`)) p(`glossary term "${g}" is listed but never marked with [[…]]`);
    }
    // Sections.
    const headings = [...l.body.matchAll(/^##\s+(.+)$/gm)].map((h) => h[1]!.trim());
    for (const s of REQUIRED_SECTIONS) if (!headings.includes(s)) p(`missing section "## ${s}"`);
    // Inline references.
    // Inside a table the label separator is written `\|`.
    for (const g of l.body.matchAll(/\[\[([^\]|\\]+)(?:\\?\|[^\]]+)?\]\]/g)) if (!ctx.glossary.has(g[1]!.trim().toLowerCase())) p(`glossary term "${g[1]}" is not defined`);
    for (const c of l.body.matchAll(/\{\{calc\s+([^}]+)\}\}/g)) {
      try {
        evaluate(parseCalc(c[1]!).expr);
      } catch (e) {
        p((e as Error).message);
      }
    }
    for (const e of l.body.matchAll(/\{\{eq\s+([^}]+)\}\}/g)) {
      try {
        parseEq(e[1]!);
      } catch (err) {
        p((err as Error).message);
      }
    }
    for (const n of bareNumbers(l.body)) p(`typed number "${n}": compute it with {{calc …}} or {{eq …}} (D-059)`);
    // Rendering, widgets and quizzes.
    try {
      const segs = renderLesson(l.body, ctx.glossary);
      const quizzes = segs.filter((s) => s.kind === 'quiz');
      if (quizzes.length !== 1) p(`needs exactly one quiz, found ${quizzes.length}`);
      for (const s of segs) {
        if (s.kind === 'html' && s.html.includes('gloss-missing')) p('a glossary term has no definition');
        if ((s.kind === 'html' || s.kind === 'callout') && /\{\{|\[\[/.test(s.html)) p(`a directive or glossary term was not rendered: ${(/(\{\{|\[\[)[^}\]]*/.exec(s.html) ?? [''])[0]} (inside a table write | as \|)`);
        if (s.kind === 'widget') {
          const check = WIDGETS[s.name];
          if (!check) p(`unknown widget "${s.name}"`);
          else for (const e of check(s.config)) p(`widget ${s.name}: ${e}`);
          if (s.name === 'chart') {
            const ids2 = ctx.charts.get(String(s.config.file));
            if (!ids2) p(`chart file ${String(s.config.file)} not found`);
            else if (!ids2.has(String(s.config.chart))) p(`chart ${String(s.config.chart)} not in ${String(s.config.file)}`);
          }
          if (s.name === 'minisolver' && !ctx.spots.has(String(s.config.spot))) p(`unknown solver spot "${String(s.config.spot)}"`);
        }
        if (s.kind === 'quiz') {
          if (s.questions.length < 3 || s.questions.length > 5) p(`quiz needs 3–5 questions, has ${s.questions.length}`);
          s.questions.forEach((q, k) => {
            if (!q.q || !Array.isArray(q.choices) || q.choices.length < 2) p(`quiz question ${k + 1} needs a question and at least two choices`);
            else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.choices.length)) p(`quiz question ${k + 1}: answer index out of range`);
            if (!q.explain) p(`quiz question ${k + 1} has no explanation`);
            for (const n of bareNumbers([q.q, ...(q.choices ?? []), q.explain].join(' '))) p(`quiz question ${k + 1}: typed number "${n}"`);
          });
        }
      }
    } catch (e) {
      p(`doesn't render: ${(e as Error).message}`);
    }
  }
  return bad;
}
