// Spot library (D-089): every solved spot the app can drill, with the facts to filter on. Pure,
// so tests can check the catalogue against the chart files and drill spots.

import { href } from '../../app/route';
import type { ChartFile, ChartIndexEntry } from '../../lib/provenance/types';
import { texture } from '../trainer/postflop/features';
import { DRILL_SPOTS, SITUATIONS } from '../trainer/postflop/spots';
import { drillSources, scenarioOf, stackOf } from '../trainer/preflop/deal';

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type PotType = 'unopened' | 'vs-open' | '3-bet' | '4-bet+' | 'squeeze' | 'push-fold' | 'single-raised';
export type TextureTag = 'rainbow' | 'two-tone' | 'monotone' | 'paired' | 'connected';

export type LibraryItem = {
  id: string;
  kind: 'preflop' | 'postflop' | 'situation';
  /** Message key and params for the title. */
  title: { key: string; params: Record<string, string | number> };
  street: Street;
  /** Seat (preflop) or OOP / IP (postflop; "any" when you play both seats). */
  position: string;
  pot: PotType;
  textures: TextureTag[];
  /** Effective stack in bb. */
  stack: number;
  /** Stack-to-pot ratio at the start (postflop). */
  spr?: number;
  board?: string;
  graded: boolean;
  href: string;
  /** Lower-case text for search. */
  search: string;
  /** Key of the study note for this spot (D-091), and the note when there is one. */
  noteKey: string;
  note?: string;
};

/** Pot type of a preflop chart decision from its scenario. */
export function potOf(family: string, scenario: string): PotType {
  if (family.startsWith('pushfold')) return 'push-fold';
  if (scenario === 'first-in') return 'unopened';
  if (scenario === 'vs-open') return 'vs-open';
  if (scenario === 'vs-3bet') return '3-bet';
  if (scenario === 'squeeze') return 'squeeze';
  return '4-bet+';
}

export function textureTags(board: string[]): TextureTag[] {
  const tex = texture(board.slice(0, 3));
  const tags: TextureTag[] = [tex.maxSuit >= 3 ? 'monotone' : tex.maxSuit === 2 ? 'two-tone' : 'rainbow'];
  if (tex.paired) tags.push('paired');
  if (tex.straightPossible) tags.push('connected');
  return tags;
}

export function preflopItems(index: ChartIndexEntry[], docs: Map<string, ChartFile>): LibraryItem[] {
  const out: LibraryItem[] = [];
  for (const src of drillSources(index)) {
    const doc = docs.get(src.file);
    if (!doc) continue;
    for (const chart of doc.charts) {
      const scenario = scenarioOf(chart);
      const stack = stackOf(doc, chart);
      out.push({
        id: `preflop|${src.file}|${chart.id}`,
        kind: 'preflop',
        title: { key: 'library.title.preflop', params: { chart: chart.title } },
        street: 'preflop',
        position: chart.seat,
        pot: potOf(doc.family, scenario),
        textures: [],
        stack,
        graded: src.graded,
        href: href('train', ['preflop'], { files: src.file, chart: chart.id }),
        noteKey: `chart:${src.file}:${chart.id}`,
        search: `${chart.title} ${chart.seat} ${scenario} ${doc.family} ${stack}bb`.toLowerCase(),
      });
    }
  }
  return out;
}

export function postflopItems(): LibraryItem[] {
  const out: LibraryItem[] = [];
  for (const d of DRILL_SPOTS) {
    const board = d.spot.board.split(' ');
    const base = { street: d.street, pot: 'single-raised' as PotType, textures: textureTags(board), stack: d.spot.stack, spr: d.spot.stack / d.spot.pot, board: d.spot.board, graded: true };
    out.push({
      ...base,
      id: `postflop|${d.id}`,
      kind: 'postflop',
      title: { key: 'library.title.postflop', params: { spot: d.id } },
      position: 'any',
      href: href('train', ['postflop'], { spot: d.id }),
      noteKey: `postflop:${d.id}`,
      search: `${d.id} ${d.street} ${d.spot.board} ${base.textures.join(' ')}`.toLowerCase(),
    });
    for (const s of SITUATIONS.filter((x) => x.spot === d.id)) {
      out.push({
        ...base,
        id: `situation|${d.id}|${s.id}`,
        kind: 'situation',
        title: { key: 'library.title.situation', params: { spot: d.id, situation: s.id } },
        position: s.hero === 0 ? 'OOP' : 'IP',
        href: href('train', ['postflop'], { spot: d.id, focus: s.id }),
        noteKey: `postflop:${d.id}:${s.id}`,
        search: `${d.id} ${s.id} ${d.street} ${d.spot.board} ${base.textures.join(' ')}`.toLowerCase(),
      });
    }
  }
  return out;
}

export type LibraryFilters = { streets: Street[]; positions: string[]; pots: PotType[]; textures: TextureTag[]; stackMin: number; stackMax: number; gradedOnly: boolean; query: string };

export const NO_FILTERS: LibraryFilters = { streets: [], positions: [], pots: [], textures: [], stackMin: 0, stackMax: 1000, gradedOnly: false, query: '' };

export function filterItems(items: LibraryItem[], f: LibraryFilters): LibraryItem[] {
  const words = f.query.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter(
    (it) =>
      (!f.streets.length || f.streets.includes(it.street)) &&
      (!f.positions.length || f.positions.includes(it.position) || (it.position === 'any' && f.positions.some((p) => p === 'OOP' || p === 'IP'))) &&
      (!f.pots.length || f.pots.includes(it.pot)) &&
      (!f.textures.length || f.textures.every((x) => it.textures.includes(x))) &&
      it.stack >= f.stackMin &&
      it.stack <= f.stackMax &&
      (!f.gradedOnly || it.graded) &&
      words.every((w) => it.search.includes(w)),
  );
}
