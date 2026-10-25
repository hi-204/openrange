// Lesson files (D-060): YAML front-matter + Markdown with math, glossary terms, computed numbers
// (D-059), widget fences and quiz fences. Rendering produces segments: HTML for prose and
// structured blocks for widgets and quizzes (rendered as React components).

import katex from 'katex';
import markdownit, { type MarkdownIt, type StateBlock, type StateInline, type Token } from 'markdown-it';
import { parse as parseYaml } from 'yaml';
import { renderCalc } from './calc';

export type LessonMeta = {
  id: string;
  level: number;
  title: string;
  minutes: number;
  prerequisites: string[];
  drills: string[];
  glossary: string[];
};

export type Lesson = { meta: LessonMeta; body: string; path: string };

export type QuizQuestion = { q: string; choices: string[]; answer: number; explain: string };

export type Segment =
  | { kind: 'html'; html: string }
  | { kind: 'widget'; name: string; config: Record<string, unknown> }
  | { kind: 'quiz'; questions: QuizQuestion[] };

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
  };
  return { meta, body: m[2]!, path };
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** "AhAs vs KdKc on Jh7h2c" → parts; ranges may contain commas and spaces. */
export function parseEq(body: string): { a: string; b: string; board: string } {
  const [main, board = ''] = body.split(/\s+on\s+/);
  const [a, b] = (main ?? '').split(/\s+vs\s+/);
  if (!a?.trim() || !b?.trim()) throw new Error(`eq "${body}": write it as "<hand> vs <hand> [on <board>]"`);
  return { a: a.trim(), b: b.trim(), board: board.trim() };
}

function mathInline(state: StateInline, silent: boolean): boolean {
  const src = state.src;
  const start = state.pos;
  if (src[start] !== '$' || src[start + 1] === '$') return false;
  const end = src.indexOf('$', start + 1);
  if (end < 0) return false;
  if (!silent) {
    const t = state.push('math_inline', 'math', 0);
    t.content = src.slice(start + 1, end);
  }
  state.pos = end + 1;
  return true;
}

function mathBlock(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const lineText = (n: number) => state.src.slice(state.bMarks[n]! + state.tShift[n]!, state.eMarks[n]!);
  if (lineText(startLine).trim() !== '$$') return false;
  let next = startLine + 1;
  while (next < endLine && lineText(next).trim() !== '$$') next++;
  if (next >= endLine) return false;
  if (silent) return true;
  const t = state.push('math_block', 'math', 0);
  t.content = Array.from({ length: next - startLine - 1 }, (_, k) => lineText(startLine + 1 + k)).join('\n');
  t.map = [startLine, next + 1];
  state.line = next + 1;
  return true;
}

/** `{{calc …}}`, `{{eq …}}` and `[[term]]` / `[[term|label]]`. */
function directive(state: StateInline, silent: boolean): boolean {
  const src = state.src.slice(state.pos);
  const d = /^\{\{(calc|eq)\s+([^}]+)\}\}/.exec(src);
  if (d) {
    if (!silent) {
      const t = state.push(d[1] === 'calc' ? 'calc' : 'eq', '', 0);
      t.content = d[2]!.trim();
    }
    state.pos += d[0].length;
    return true;
  }
  const g = /^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(src);
  if (g) {
    if (!silent) {
      const t = state.push('glossary', '', 0);
      t.meta = { term: g[1]!.trim().toLowerCase(), label: (g[2] ?? g[1]!).trim() };
    }
    state.pos += g[0].length;
    return true;
  }
  return false;
}

let glossaryId = 0;

export function markdown(glossary: Glossary): MarkdownIt {
  const md = markdownit({ html: false, linkify: false, typographer: false });
  md.inline.ruler.before('escape', 'math_inline', mathInline);
  md.inline.ruler.before('link', 'directive', directive);
  md.block.ruler.before('fence', 'math_block', mathBlock);
  md.renderer.rules.math_inline = (tokens, i) => katex.renderToString(tokens[i]!.content, { throwOnError: true });
  md.renderer.rules.math_block = (tokens, i) => `<div class="lesson-math">${katex.renderToString(tokens[i]!.content, { throwOnError: true, displayMode: true })}</div>`;
  md.renderer.rules.calc = (tokens, i) => `<span class="lesson-calc">${escape(renderCalc(tokens[i]!.content))}</span>`;
  md.renderer.rules.eq = (tokens, i) => {
    const e = parseEq(tokens[i]!.content);
    return `<span class="lesson-eq" data-a="${escape(e.a)}" data-b="${escape(e.b)}" data-board="${escape(e.board)}">…</span>`;
  };
  md.renderer.rules.glossary = (tokens, i) => {
    const { term, label } = tokens[i]!.meta as { term: string; label: string };
    const def = glossary.get(term);
    if (!def) return `<span class="gloss-missing">${escape(label)}</span>`;
    const id = `gloss-${++glossaryId}`;
    return `<span class="gloss" tabindex="0" aria-describedby="${id}">${escape(label)}<span class="gloss-tip" role="tooltip" id="${id}"><strong>${escape(term)}</strong>: ${escape(def)}</span></span>`;
  };
  return md;
}

export function renderLesson(body: string, glossary: Glossary): Segment[] {
  const md = markdown(glossary);
  const env = {};
  const tokens = md.parse(body, env);
  const out: Segment[] = [];
  let buf: Token[] = [];
  const flush = () => {
    if (buf.length) out.push({ kind: 'html', html: md.renderer.render(buf, md.options, env) });
    buf = [];
  };
  for (const t of tokens) {
    const info = t.type === 'fence' ? t.info.trim() : '';
    if (info.startsWith('widget')) {
      flush();
      const name = info.slice('widget'.length).trim();
      out.push({ kind: 'widget', name, config: t.content.trim() ? (JSON.parse(t.content) as Record<string, unknown>) : {} });
    } else if (info === 'quiz') {
      flush();
      out.push({ kind: 'quiz', questions: JSON.parse(t.content) as QuizQuestion[] });
    } else buf.push(t);
  }
  flush();
  return out;
}

/** Load the glossary file (term → definition, terms lower-cased). */
export function parseGlossary(source: string): Glossary {
  const raw = parseYaml(source) as Record<string, string>;
  return new Map(Object.entries(raw).map(([k, v]) => [k.toLowerCase(), String(v).trim()]));
}
