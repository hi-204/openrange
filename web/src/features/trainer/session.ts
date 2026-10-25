// Record an answer and update the family's schedule (graded answers only, D-054).

import { INTENSITY_SCALE, newFamily, review, type FamilyState } from './srs';
import type { AnswerRecord, TrainerStore } from './store';

export async function recordAnswer(store: TrainerStore, rec: AnswerRecord, families: Map<string, FamilyState>, intensity: keyof typeof INTENSITY_SCALE = 'normal'): Promise<Map<string, FamilyState>> {
  await store.addAnswer(rec);
  if (!rec.graded || !rec.category) return families;
  const next = review(families.get(rec.family) ?? newFamily(rec.family, rec.at), rec.category, rec.at, INTENSITY_SCALE[intensity]);
  await store.putFamily(next);
  return new Map(families).set(rec.family, next);
}

export const handType = (cls: string) => (cls.length === 2 ? 'pair' : cls.endsWith('s') ? 'suited' : 'offsuit');
