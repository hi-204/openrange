// The bundled course content (D-060): lessons, glossary and placement questions.

import { parseGlossary, parseLesson, type Facts, type Glossary, type Lesson, type QuizQuestion } from './lessonMeta';
import { parse as parseYaml } from 'yaml';
import glossarySource from '../../content/en/glossary.yaml?raw';
import placementSource from '../../content/en/placement.yaml?raw';
import factsJson from '../../content/en/facts.json';

const files = import.meta.glob('../../content/en/lessons/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const byId = (a: Lesson, b: Lesson) => {
  const [x, y] = [a.meta.id.split('.').map(Number), b.meta.id.split('.').map(Number)];
  return x[0]! - y[0]! || x[1]! - y[1]!;
};

/** All lessons in course order. */
export const LESSONS: Lesson[] = Object.entries(files)
  .map(([path, src]) => parseLesson(src, path.replace('../../content/en/', '')))
  .sort(byId);

export const GLOSSARY: Glossary = parseGlossary(glossarySource);

/** Lesson equities computed at build time (scripts/gen-lesson-facts.mjs). */
export const FACTS: Facts = factsJson as Facts;

export type PlacementQuestion = QuizQuestion & { level: number };
export const PLACEMENT: PlacementQuestion[] = (parseYaml(placementSource) as PlacementQuestion[]) ?? [];

export function lesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.meta.id === id);
}

export const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7];
/** Levels whose lessons exist in this build (5–7 arrive in M8). */
export const AVAILABLE_LEVELS = [...new Set(LESSONS.map((l) => l.meta.level))].sort((a, b) => a - b);
