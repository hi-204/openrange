// Lesson metadata and parsing without any rendering dependency (front-matter, glossary, eq
// directives), so pages that only list lessons don't load KaTeX or markdown-it.

import { parse as parseYaml } from 'yaml';

export type LessonMeta = {
  id: string;
  level: number;
  title: string;
  minutes: number;
  prerequisites: string[];
  drills: string[];
  glossary: string[];
  /** "What you'll learn" (2–4 items) and "Recap" (2–4 items). */
  objectives: string[];
  recap: string[];
};

export type Lesson = { meta: LessonMeta; body: string; path: string };

export type QuizQuestion = { q: string; choices: string[]; answer: number; explain: string };

export type Glossary = Map<string, string>;

export function parseLesson(source: string, path: string): Lesson {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(source);
  if (!m) throw new Error(`${path}: missing front-matter`);
  const fm = parseYaml(m[1]!) as Record<string, unknown>;
  const list = (k: string) => (Array.isArray(fm[k]) ? (fm[k] as unknown[]).map(String) : []);
  const meta: LessonMeta = {
    id: String(fm.id ?? ''),
    level: Number(fm.level),
    title: String(fm.title ?? ''),
    minutes: Number(fm.minutes),
    prerequisites: list('prerequisites'),
    drills: list('drills'),
    glossary: list('glossary'),
    objectives: list('objectives'),
    recap: list('recap'),
  };
  return { meta, body: m[2]!, path };
}

export const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** The lesson's "## " sections, for the table of contents. */
export function sections(body: string): { id: string; title: string }[] {
  return [...body.matchAll(/^##\s+(.+)$/gm)].map((m) => ({ id: slug(m[1]!.trim()), title: m[1]!.trim() }));
}

/** "AhAs vs KdKc on Jh7h2c" → parts; ranges may contain commas and spaces. */
export function parseEq(body: string): { a: string; b: string; board: string } {
  const [main, board = ''] = body.split(/\s+on\s+/);
  const [a, b] = (main ?? '').split(/\s+vs\s+/);
  if (!a?.trim() || !b?.trim()) throw new Error(`eq "${body}": write it as "<hand> vs <hand> [on <board>]"`);
  return { a: a.trim(), b: b.trim(), board: board.trim() };
}

/** Equities computed at build time (scripts/gen-lesson-facts.mjs → facts.json), by eq key. */
export type Facts = Record<string, number>;
export const eqKey = (e: { a: string; b: string; board: string }) => `${e.a} vs ${e.b}${e.board ? ` on ${e.board}` : ''}`;

/** Load the glossary file (term → definition, terms lower-cased). */
export function parseGlossary(source: string): Glossary {
  // An empty file (or one with only comments) parses to null.
  const raw = (parseYaml(source) ?? {}) as Record<string, string>;
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new Error('the glossary must map terms to definitions');
  return new Map(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
}

/** Every `{{eq …}}` in a lesson body (for the build-time facts and their freshness test). */
export function eqDirectives(body: string): { a: string; b: string; board: string }[] {
  return [...body.matchAll(/\{\{eq\s+([^}]+)\}\}/g)].map((m) => parseEq(m[1]!));
}
