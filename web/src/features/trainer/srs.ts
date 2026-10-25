// SM-2 scheduling per spot family (D-019, D-054).

import type { Category } from './grading';

export type FamilyState = {
  family: string;
  ease: number;
  repetitions: number;
  /** Current interval in days (0 after a lapse). */
  intervalDays: number;
  /** When the family is next due (ms since epoch). */
  due: number;
  lapses: number;
  answers: number;
};

const DAY = 86_400_000;
export const LAPSE_DELAY_MS = 10 * 60_000;

export const QUALITY: Record<Category, number> = {
  best: 5,
  acceptable: 4,
  inaccuracy: 3,
  mistake: 2,
  blunder: 1,
};

export function newFamily(family: string, now: number): FamilyState {
  return { family, ease: 2.5, repetitions: 0, intervalDays: 0, due: now, lapses: 0, answers: 0 };
}

/**
 * Update a family after a graded answer. Answers before the family is due only count when
 * they are lapses, so drilling one family many times in a row can't inflate its interval.
 */
export function review(state: FamilyState, category: Category, now: number, intervalScale = 1): FamilyState {
  const q = QUALITY[category];
  const s = { ...state, answers: state.answers + 1 };
  if (q < 3) {
    return {
      ...s,
      repetitions: 0,
      intervalDays: 0,
      lapses: s.lapses + 1,
      ease: Math.max(1.3, s.ease - 0.2),
      due: now + LAPSE_DELAY_MS,
    };
  }
  if (now < state.due) return s;
  const repetitions = s.repetitions + 1;
  const intervalDays = repetitions === 1 ? 1 : repetitions === 2 ? 6 : Math.round(s.intervalDays * s.ease);
  // Review intensity (Settings → Training): light spaces reviews out, intense brings them back.
  const scheduledDays = Math.max(1, Math.round(intervalDays * intervalScale));
  // SM-2 ease update.
  const ease = Math.max(1.3, s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  return { ...s, repetitions, intervalDays, ease, due: now + scheduledDays * DAY };
}

/**
 * Pick the family to drill next among `candidates` (already filtered by the user): the most
 * overdue family; otherwise one never seen (first in the given order); otherwise the one due
 * soonest.
 */
export function pickFamily(candidates: string[], states: Map<string, FamilyState>, now: number): string | null {
  if (candidates.length === 0) return null;
  let overdue: FamilyState | null = null;
  let soonest: FamilyState | null = null;
  let unseen: string | null = null;
  for (const f of candidates) {
    const s = states.get(f);
    if (!s) {
      unseen ??= f;
      continue;
    }
    if (s.due <= now && (!overdue || s.due < overdue.due)) overdue = s;
    if (!soonest || s.due < soonest.due) soonest = s;
  }
  return overdue?.family ?? unseen ?? soonest!.family;
}

/** Interval multiplier for the review-intensity setting. */
export const INTENSITY_SCALE = { light: 1.5, normal: 1, intense: 0.6 } as const;
