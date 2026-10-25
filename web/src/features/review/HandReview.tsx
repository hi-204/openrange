// Post-session hand review (D-078): import PokerStars / GGPoker hand histories, replay each
// hand, and see a reference for every decision where one exists. Hands stay in this tab.

import { useEffect, useId, useMemo, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import { loadJson, type ChartFile } from '../../lib/provenance/types';
import { EmptyState } from '../../lib/ui/components';
import { Cards } from '../../lib/poker/Cards';
import { parseFile, type Hand, type ParseResult } from './handHistory';
import { CASH_FILES, HU_FILE, reviewHand, type Decision } from './reviewHand';
import { GG, STARS } from './samples';

/** bb the player put in (after uncalled bets were returned) and collected. */
export function result(hand: Hand, player: string): number {
  const put = hand.actions.filter((a) => a.player === player).reduce((s, a) => s + a.amount, 0);
  return (hand.collected[player] ?? 0) - put;
}

const FILES = [...Object.values(CASH_FILES), HU_FILE];

export function DecisionCard({ d }: { d: Decision }) {
  if (d.status === 'none')
    return (
      <p className="text-sm text-ink-muted" data-testid="decision-none">
        {t('review.none', { reason: d.reason ?? '' })}
      </p>
    );
  return (
    <div className="space-y-1 text-sm" data-testid={`decision-${d.status}`}>
      <p className="font-medium">
        {d.status === 'graded' ? t('review.graded', { category: t(`trainer.category.${d.grade?.category ?? 'best'}` as MessageKey) }) : t('review.practice')}
        <span className="ml-2 font-mono text-xs text-ink-muted">{d.ref?.chart}</span>
      </p>
      <ul className="flex flex-wrap gap-3">
        {d.actions!.map((a, k) => (
          <li key={a} className={k === d.chosen ? 'font-semibold' : ''}>
            {a} <span className="num">{pct(d.strategy![k]!, 0)}</span>
            {d.ev?.[k] !== undefined && d.ev?.[k] !== null && <span className="num text-ink-muted"> · {d.ev[k]!.toFixed(2)} bb</span>}
          </li>
        ))}
      </ul>
      {d.grade && d.grade.lossBb > 0.005 && <p>{t('review.loss', { loss: d.grade.lossBb.toFixed(2) })}</p>}
      {d.sizeNote && <p className="text-xs text-ink-muted">{d.sizeNote}</p>}
    </div>
  );
}

export function Replay({ hand, decisions }: { hand: Hand; decisions: Decision[] }) {
  const by = new Map(decisions.map((d) => [d.index, d]));
  const streets = ['preflop', 'flop', 'turn', 'river'] as const;
  const boardAt = { preflop: [], flop: hand.board.slice(0, 3), turn: hand.board.slice(0, 4), river: hand.board.slice(0, 5) };
  const pos = (n: string) => hand.seats.find((s) => s.name === n)?.position ?? '';
  return (
    <div className="space-y-4" data-testid="replay">
      <p className="text-sm">
        {t('review.handHeader', { site: hand.site, id: hand.id, position: pos(hand.hero ?? ''), result: result(hand, hand.hero ?? '').toFixed(1) })} <Cards cards={hand.heroCards.join('')} />
      </p>
      {streets.map((st) => {
        const acts = hand.actions.map((a, i) => ({ a, i })).filter(({ a }) => a.street === st && a.kind !== 'post');
        if (!acts.length) return null;
        return (
          <section key={st} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              {t(`review.street.${st}` as MessageKey)} {boardAt[st].length > 0 && <Cards cards={boardAt[st].join('')} />}
            </h3>
            <ol className="space-y-2">
              {acts.map(({ a, i }) => (
                <li key={i} className={a.player === hand.hero ? 'rounded-control bg-surface-2 p-2' : 'text-sm'}>
                  <span className="text-sm">
                    <span className="font-medium">{a.player}</span> <span className="text-ink-muted">({pos(a.player)})</span> {t(`review.kind.${a.kind}` as MessageKey)}
                    {a.kind === 'raise' && a.to ? ` ${a.to.toFixed(1)} bb` : a.amount > 0 ? ` ${a.amount.toFixed(1)} bb` : ''}
                    {a.allIn ? ` ${t('review.allIn')}` : ''}
                  </span>
                  {by.has(i) && (
                    <div className="mt-1">
                      <DecisionCard d={by.get(i)!} />
                    </div>
                  )}
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}

export function HandReview() {
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const [selected, setSelected] = useState(0);
  const [docs, setDocs] = useState<Map<string, ChartFile>>(new Map());
  const ids = { text: useId(), file: useId() };
  useEffect(() => {
    if (!parsed?.hands.length || docs.size) return;
    Promise.all(FILES.map((f) => loadJson<ChartFile>(`data/charts/${f}`).then((d) => [f, d] as const)))
      .then((all) => setDocs(new Map(all)))
      .catch(() => undefined);
  }, [parsed, docs.size]);
  const reviews = useMemo(() => (parsed && docs.size ? parsed.hands.map((h) => reviewHand(h, docs)) : []), [parsed, docs]);
  const read = (s: string) => {
    setParsed(parseFile(s));
    setSelected(0);
  };
  const counts = reviews.flat().reduce((c, d) => ({ ...c, [d.status]: (c[d.status] ?? 0) + 1 }), {} as Record<string, number>);
  const losses = reviews
    .flatMap((ds, h) => ds.filter((d) => d.grade && d.grade.lossBb > 0.005).map((d) => ({ d, h })))
    .sort((a, b) => b.d.grade!.lossBb - a.d.grade!.lossBb)
    .slice(0, 5);
  return (
    <div className="space-y-5" data-testid="hand-review">
      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">{t('review.title')}</h2>
        <p className="max-w-prose text-sm text-ink-muted">{t('review.intro')}</p>
        <label htmlFor={ids.text} className="block text-sm font-medium">
          {t('review.paste')}
        </label>
        <textarea id={ids.text} className="field h-32 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} />
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!text.trim()} onClick={() => read(text)}>
            {t('review.read')}
          </button>
          <label htmlFor={ids.file} className="btn-secondary cursor-pointer">
            {t('review.file')}
          </label>
          <input
            id={ids.file}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) read(await f.text());
            }}
          />
          <button
            type="button"
            className="btn-quiet"
            onClick={() => {
              setText(`${STARS}\n\n${GG}`);
              read(`${STARS}\n\n${GG}`);
            }}
          >
            {t('review.example')}
          </button>
        </div>
      </section>
      {parsed && parsed.hands.length === 0 && <EmptyState icon="stats" title={t('review.noneRead')}>{t('review.noneReadText')}</EmptyState>}
      {parsed && parsed.hands.length > 0 && (
        <>
          <section className="card space-y-2 text-sm" data-testid="hand-review-summary">
            <p className="font-medium">{t('review.handSummary', { hands: parsed.hands.length, graded: counts.graded ?? 0, practice: counts.practice ?? 0, none: counts.none ?? 0 })}</p>
            {parsed.errors.length > 0 && <p className="text-amber-700 dark:text-amber-400">{t('review.errors', { n: parsed.errors.length, reasons: [...new Set(parsed.errors.map((e) => e.reason))].join('; ') })}</p>}
            {losses.length > 0 && (
              <div>
                <p className="font-medium">{t('review.biggest')}</p>
                <ul>
                  {losses.map(({ d, h }) => (
                    <li key={`${h}-${d.index}`}>
                      <button type="button" className="underline" onClick={() => setSelected(h)}>
                        {t('review.lossItem', { id: parsed.hands[h]!.id, chart: d.ref?.chart ?? '', loss: d.grade!.lossBb.toFixed(2) })}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
          <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
            <ul className="card max-h-[32rem] space-y-1 overflow-auto text-sm" aria-label={t('review.list')}>
              {parsed.hands.map((h, i) => (
                <li key={`${h.id}-${i}`}>
                  <button type="button" className={`w-full rounded-control px-2 py-1 text-left ${i === selected ? 'bg-accent-soft font-medium' : ''}`} aria-current={i === selected} onClick={() => setSelected(i)}>
                    #{h.id} · {h.seats.find((s) => s.name === h.hero)?.position} · {h.heroCards.join('')} · <span className="num">{result(h, h.hero ?? '').toFixed(1)} bb</span>
                  </button>
                </li>
              ))}
            </ul>
            <section className="card">{reviews[selected] ? <Replay hand={parsed.hands[selected]!} decisions={reviews[selected]!} /> : <p>…</p>}</section>
          </div>
        </>
      )}
    </div>
  );
}
