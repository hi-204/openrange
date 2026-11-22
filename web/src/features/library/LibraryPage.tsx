// Spot library (D-089): browse every solved spot by street, position, pot type, texture and
// stack depth, search, and launch a drill from any of them.

import { useEffect, useId, useMemo, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { loadJson, type ChartFile, type ChartIndexEntry } from '../../lib/provenance/types';
import { Badge, ErrorState, Skeleton } from '../../lib/ui/components';
import { CardRow } from '../table/Card';
import { trainerStore } from '../trainer/store';
import { filterItems, NO_FILTERS, postflopItems, preflopItems, type LibraryFilters, type LibraryItem, type PotType, type Street, type TextureTag } from './library';

const STREETS: Street[] = ['preflop', 'flop', 'turn', 'river'];
const POTS: PotType[] = ['unopened', 'vs-open', '3-bet', '4-bet+', 'squeeze', 'push-fold', 'single-raised'];
const TEXTURES: TextureTag[] = ['rainbow', 'two-tone', 'monotone', 'paired', 'connected'];
const POSITIONS = ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB', 'OOP', 'IP'];
const PAGE = 40;

function title(it: LibraryItem): string {
  const p = it.title.params;
  if (it.kind === 'postflop') return t('library.title.postflop', { spot: t(`trainer.post.spot.${p.spot}` as MessageKey) });
  if (it.kind === 'situation') return t('library.title.situation', { spot: t(`trainer.post.spot.${p.spot}` as MessageKey), situation: t(`trainer.post.situation.${p.situation}` as MessageKey) });
  return t('library.title.preflop', p);
}

function Checks<T extends string>({ legend, options, value, onChange, label }: { legend: string; options: T[]; value: T[]; onChange: (v: T[]) => void; label: (v: T) => string }) {
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {options.map((o) => (
          <label key={o} className="flex items-center gap-1 text-sm">
            <input type="checkbox" checked={value.includes(o)} onChange={() => onChange(value.includes(o) ? value.filter((x) => x !== o) : [...value, o])} />
            {label(o)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function LibraryPage() {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<LibraryFilters>(NO_FILTERS);
  const [shown, setShown] = useState(PAGE);
  const ids = { query: useId(), min: useId(), max: useId() };

  useEffect(() => {
    (async () => {
      const index = await loadJson<ChartIndexEntry[]>('data/charts/index.json');
      const docs = new Map<string, ChartFile>();
      await Promise.all(index.map(async (e) => docs.set(e.file, await loadJson<ChartFile>(`data/charts/${e.file}`))));
      const notes = new Map((await trainerStore().notes()).map((n) => [n.key, n.text]));
      setItems([...postflopItems(), ...preflopItems(index, docs)].map((it) => (notes.has(it.noteKey) ? { ...it, note: notes.get(it.noteKey)!, search: `${it.search} ${notes.get(it.noteKey)!.toLowerCase()}` } : it)));
    })().catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => setShown(PAGE), [f]);

  const list = useMemo(() => (items ? filterItems(items, f) : []), [items, f]);
  if (error) return <ErrorState title={t('flow.errorTitle')} message={error} />;
  if (!items) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-5" data-testid="library">
      <p className="max-w-prose text-sm text-ink-muted">{t('library.intro')}</p>
      <section className="card space-y-4" aria-label={t('library.filters')}>
        <div>
          <label htmlFor={ids.query} className="mb-1 block text-sm font-medium">
            {t('library.search')}
          </label>
          <input id={ids.query} className="field" type="search" value={f.query} placeholder={t('library.searchHint')} onChange={(e) => setF({ ...f, query: e.target.value })} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Checks legend={t('library.street')} options={STREETS} value={f.streets} onChange={(streets) => setF({ ...f, streets })} label={(s) => t(`library.street.${s}` as MessageKey)} />
          <Checks legend={t('library.position')} options={POSITIONS} value={f.positions} onChange={(positions) => setF({ ...f, positions })} label={(p) => p} />
          <Checks legend={t('library.pot')} options={POTS} value={f.pots} onChange={(pots) => setF({ ...f, pots })} label={(p) => t(`library.pot.${p}` as MessageKey)} />
          <Checks legend={t('library.texture')} options={TEXTURES} value={f.textures} onChange={(textures) => setF({ ...f, textures })} label={(x) => t(`library.texture.${x}` as MessageKey)} />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor={ids.min} className="mb-1 block text-sm font-medium">
              {t('library.stackMin')}
            </label>
            <input id={ids.min} className="field num w-28" type="number" min={0} value={f.stackMin} onChange={(e) => setF({ ...f, stackMin: Number(e.target.value) })} />
          </div>
          <div>
            <label htmlFor={ids.max} className="mb-1 block text-sm font-medium">
              {t('library.stackMax')}
            </label>
            <input id={ids.max} className="field num w-28" type="number" min={0} value={f.stackMax} onChange={(e) => setF({ ...f, stackMax: Number(e.target.value) })} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={f.gradedOnly} onChange={(e) => setF({ ...f, gradedOnly: e.target.checked })} />
            {t('library.gradedOnly')}
          </label>
          <button type="button" className="btn-quiet" onClick={() => setF(NO_FILTERS)}>
            {t('library.clear')}
          </button>
        </div>
      </section>
      <p className="text-sm" role="status" data-testid="library-count">
        {t('library.count', { n: list.length, total: items.length })}
      </p>
      <ul className="grid gap-3 md:grid-cols-2">
        {list.slice(0, shown).map((it) => (
          <li key={it.id} className="card flex flex-col gap-2" data-testid="library-item">
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{title(it)}</p>
              <Badge tone={it.graded ? 'good' : 'warn'}>{t(it.graded ? 'library.graded' : 'library.practice')}</Badge>
            </div>
            {it.board && <CardRow cards={it.board.split(' ')} size="sm" />}
            {it.note && (
              <p className="text-xs" data-testid="library-note">
                {t('library.note', { text: it.note.length > 80 ? `${it.note.slice(0, 80)}…` : it.note })}
              </p>
            )}
            <p className="text-xs text-ink-muted">
              {[t(`library.street.${it.street}` as MessageKey), it.position === 'any' ? t('library.anySeat') : it.position, t(`library.pot.${it.pot}` as MessageKey), t('library.stack', { n: it.stack }), ...(it.spr !== undefined ? [t('library.spr', { spr: it.spr.toFixed(1) })] : []), ...it.textures.map((x) => t(`library.texture.${x}` as MessageKey))].join(' · ')}
            </p>
            <a className="btn-secondary self-start" href={it.href}>
              {t('library.drill')}
            </a>
          </li>
        ))}
      </ul>
      {list.length > shown && (
        <button type="button" className="btn-secondary" onClick={() => setShown((n) => n + PAGE)}>
          {t('library.more', { n: Math.min(PAGE, list.length - shown) })}
        </button>
      )}
    </div>
  );
}
