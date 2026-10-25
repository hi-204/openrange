import { useEffect, useId, useState } from 'react';
import { pct } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { Cards } from '../../../lib/poker/Cards';
import { solverClient } from '../../../lib/wasm/client';
import type { HandValue } from '../../../lib/wasm/protocol';
import { combosOf, splitCards, validCards } from './cards';

type Config = Record<string, unknown>;
const text = (c: Config, k: string, d: string) => (typeof c[k] === 'string' ? (c[k] as string) : d);

function useEvaluate(cards: string): HandValue | null {
  const [v, setV] = useState<HandValue | null>(null);
  useEffect(() => {
    let live = true;
    const list = splitCards(cards);
    if (list.length < 5 || list.length > 7 || !validCards(list)) {
      setV({ ok: false, error: t('widget.cardsHint') });
      return;
    }
    solverClient()
      .call('evaluateHand', { cards: list.join('') })
      .then((r) => live && setV(r))
      .catch((e: Error) => live && setV({ ok: false, error: e.message }));
    return () => {
      live = false;
    };
  }, [cards]);
  return v;
}

function CardsInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} />
    </div>
  );
}

function HandResult({ v }: { v: HandValue | null }) {
  if (!v) return <p className="text-sm">…</p>;
  if (!v.ok) return <p className="text-sm text-amber-700 dark:text-amber-400">{v.error}</p>;
  return (
    <p className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold capitalize">{v.category}</span>
      <span className="text-slate-500">{t('widget.bestFive')}</span>
      <Cards cards={v.best} />
    </p>
  );
}

/** Compare two hands of 5–7 cards: category, best five and who wins. */
export function HandRanker({ config }: { config: Config }) {
  const init = Array.isArray(config.hands) ? (config.hands as string[]) : ['As Ks Qs Js Ts', '9h 9d 9c 4s 4h'];
  const [a, setA] = useState(init[0] ?? '');
  const [b, setB] = useState(init[1] ?? '');
  const va = useEvaluate(a);
  const vb = useEvaluate(b);
  const both = va?.ok && vb?.ok ? [va, vb] : null;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <CardsInput label={t('widget.handA')} value={a} onChange={setA} />
          <HandResult v={va} />
        </div>
        <div className="space-y-2">
          <CardsInput label={t('widget.handB')} value={b} onChange={setB} />
          <HandResult v={vb} />
        </div>
      </div>
      {both && (
        <p className="font-medium" data-testid="ranker-result">
          {both[0]!.ok && both[1]!.ok && (both[0]!.strength > both[1]!.strength ? t('widget.aWins') : both[0]!.strength < both[1]!.strength ? t('widget.bWins') : t('widget.tie'))}
        </p>
      )}
      <p className="text-xs text-slate-600 dark:text-slate-400">{t('widget.cardsHint')}</p>
    </div>
  );
}

/** Your two cards plus the board: the best five and what they make. */
export function BoardExplorer({ config }: { config: Config }) {
  const [hand, setHand] = useState(text(config, 'hand', 'Ah Kh'));
  const [board, setBoard] = useState(text(config, 'board', 'Qh Jh 2c 7d 9s'));
  const v = useEvaluate(`${hand} ${board}`);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <CardsInput label={t('widget.yourCards')} value={hand} onChange={setHand} />
        <CardsInput label={t('widget.boardCards')} value={board} onChange={setBoard} />
      </div>
      <HandResult v={v} />
    </div>
  );
}

type OutsResult = { outs: string[]; ties: string[]; behindNow: boolean; equity: number | null; next: number } | { error: string };

/** Cards that put the hero ahead on the next card, the rule of 2 and 4, and the exact equity. */
export function OutsCalculator({ config }: { config: Config }) {
  const [hero, setHero] = useState(text(config, 'hero', 'Ah Kh'));
  const [villain, setVillain] = useState(text(config, 'villain', 'Qs Qd'));
  const [board, setBoard] = useState(text(config, 'board', 'Qh 7h 2c'));
  const [r, setR] = useState<OutsResult | null>(null);
  useEffect(() => {
    let live = true;
    const [h, v, b] = [splitCards(hero), splitCards(villain), splitCards(board)];
    if (h.length !== 2 || v.length !== 2 || (b.length !== 3 && b.length !== 4) || !validCards([...h, ...v, ...b])) {
      setR({ error: t('widget.outsHint') });
      return;
    }
    (async () => {
      const c = solverClient();
      const o = await c.call('countOuts', { hero: h.join(''), villain: v.join(''), board: b.join('') });
      if (!o.ok) throw new Error(o.error);
      const eq = await c.call('equity', { request: { ranges: [h.join(''), v.join('')], board: b.join(''), dead: '', mode: 'exact' } });
      const next = o.ahead.length + o.tied.length + o.behind.length;
      if (live) setR({ outs: o.ahead, ties: o.tied, behindNow: o.behindNow, equity: eq.ok ? eq.players[0]!.equity : null, next });
    })().catch((e: Error) => live && setR({ error: e.message }));
    return () => {
      live = false;
    };
  }, [hero, villain, board]);
  const cardsToCome = splitCards(board).length === 3 ? 2 : 1;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <CardsInput label={t('widget.yourCards')} value={hero} onChange={setHero} />
        <CardsInput label={t('widget.theirCards')} value={villain} onChange={setVillain} />
        <CardsInput label={t('widget.boardFlopTurn')} value={board} onChange={setBoard} />
      </div>
      {!r ? (
        <p>…</p>
      ) : 'error' in r ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{r.error}</p>
      ) : (
        <div className="space-y-2 text-sm" data-testid="outs-result">
          <p>{r.behindNow ? t('widget.outs.behind') : t('widget.outs.ahead')}</p>
          <p>
            {t('widget.outs.count', { n: r.outs.length, of: r.next })} <Cards cards={r.outs} />
          </p>
          {r.ties.length > 0 && (
            <p>
              {t('widget.outs.ties', { n: r.ties.length })} <Cards cards={r.ties} />
            </p>
          )}
          <p>{t('widget.outs.nextCard', { p: pct(r.outs.length / r.next, 1) })}</p>
          <p>
            {t(cardsToCome === 2 ? 'widget.outs.rule4' : 'widget.outs.rule2', { n: r.outs.length, est: `${r.outs.length * (cardsToCome === 2 ? 4 : 2)}%` })}{' '}
            {r.equity !== null && t('widget.outs.exact', { eq: pct(r.equity, 1) })}
          </p>
        </div>
      )}
    </div>
  );
}

/** Combos of a hand, and how many are left once some cards are known. */
export function ComboCounter({ config }: { config: Config }) {
  const [hand, setHand] = useState(text(config, 'hand', 'AK'));
  const [dead, setDead] = useState(text(config, 'dead', ''));
  let combos: string[] = [];
  let error: string | null = null;
  try {
    combos = combosOf(hand);
  } catch (e) {
    error = (e as Error).message;
  }
  const known = splitCards(dead);
  const left = combos.filter((c) => !known.some((k) => c.includes(k)));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <CardsInput label={t('widget.combos.hand')} value={hand} onChange={setHand} />
        <CardsInput label={t('widget.combos.known')} value={dead} onChange={setDead} />
      </div>
      {error ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>
      ) : (
        <div className="space-y-2 text-sm" data-testid="combos-result">
          <p className="font-medium">{t('widget.combos.count', { left: left.length, total: combos.length, hand })}</p>
          <ul className="flex flex-wrap gap-1">
            {combos.map((c) => (
              <li key={c} className={left.includes(c) ? '' : 'opacity-30 line-through'}>
                <Cards cards={c} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
