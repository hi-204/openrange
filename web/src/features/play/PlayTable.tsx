// Play mode (D-079): heads-up or up to 6-max against bots, optional coaching after each of your
// preflop decisions, and a replay of every finished hand with the same references as the
// hand review.

import { useEffect, useMemo, useRef, useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { loadJson, type ChartFile } from '../../lib/provenance/types';
import { useSettings } from '../../lib/settings/useSettings';
import { solverClient } from '../../lib/wasm/client';
import { Replay, DecisionCard, result } from '../review/HandReview';
import { CASH_FILES, HU_FILE, reviewHand } from '../review/reviewHand';
import { PokerTable, type Seat as TableSeat } from '../table/PokerTable';
import { mulberry32 } from '../trainer/preflop/deal';
import { chartMove, ruleMove, toHand, type BotMove } from './bots';
import { act, legal, needsShowdown, newHand, settle, type GameState, type Move } from './engine';

const ANY = '22+, A2s+, K2s+, Q2s+, J2s+, T2s+, 92s+, 82s+, 72s+, 62s+, 52s+, 42s+, 32s, A2o+, K2o+, Q2o+, J2o+, T2o+, 92o+, 82o+, 72o+, 62o+, 52o+, 42o+, 32o';
const FILES = [...Object.values(CASH_FILES), HU_FILE];

/** Equity against random hands, sampled in the worker (for the rule-based bot). */
async function equityVsRandom(cards: string, board: string, opponents: number): Promise<number> {
  const r = await solverClient().call('equity', { request: { ranges: [cards, ...new Array(Math.min(opponents, 5)).fill(ANY)], board, dead: '', mode: 'montecarlo', samples: 3000, seed: 7 } });
  return r.ok ? r.players[0]!.equity : 0.5;
}

async function showdown(s: GameState): Promise<GameState> {
  const c = solverClient();
  const live = s.seats.filter((p) => !p.folded);
  const values = new Map<string, number>();
  for (const p of live) {
    const cards = p.cards.join('') + s.board.join('');
    const v = await c.call('evaluateHand', { cards });
    if (!v.ok) throw new Error(v.error);
    values.set(cards, v.strength);
  }
  return settle(s, (cards) => values.get(cards) ?? 0);
}

export function PlayTable() {
  const game = useSettings((st) => st.settings.game);
  const liveCoach = useSettings((st) => st.settings.coaching.liveCoach);
  const reduce = useSettings((st) => st.settings.display.reduceMotion);
  const players = Math.max(2, Math.min(6, game.tableSize));
  const [coach, setCoach] = useState(liveCoach);
  const [docs, setDocs] = useState<Map<string, ChartFile> | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [handNo, setHandNo] = useState(0);
  const [log, setLog] = useState<{ name: string; text: string; source?: 'chart' | 'rule' }[]>([]);
  const [raiseTo, setRaiseTo] = useState('');
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const busy = useRef(false);

  useEffect(() => {
    Promise.all(FILES.map((f) => loadJson<ChartFile>(`data/charts/${f}`).then((d) => [f, d] as const)))
      .then((all) => setDocs(new Map(all)))
      .catch(() => setDocs(new Map()));
  }, []);

  const names = useMemo(() => Array.from({ length: players }, (_, i) => (i === 0 ? t('table.you') : t('play.bot', { n: i }))), [players]);
  const deal = () => {
    const button = handNo % players;
    const s = newHand({ names, stacks: new Array(players).fill(game.stack), hero: 0, button, seed: Math.floor(rnd() * 2 ** 31), ante: game.ante, rake: game.rake.on ? { percent: game.rake.percent, capBb: game.rake.capBb } : null });
    setHandNo((h) => h + 1);
    setLog([]);
    setState(s);
  };

  const describe = (s: GameState, before: GameState, move: Move) => {
    const p = before.seats[before.toAct!]!;
    const last = s.history.at(-1)!;
    // "You call" for the hero, "Bot 2 calls" for the others.
    const k = p.hero ? 'play.you' : 'play.log';
    if (move.kind === 'fold') return t(`${k}.fold` as MessageKey, { name: p.name });
    if (move.kind === 'check') return t(`${k}.check` as MessageKey, { name: p.name });
    if (move.kind === 'call') return t(`${k}.call` as MessageKey, { name: p.name, amount: last.amount.toFixed(1) });
    return t(`${k}.${last.kind === 'bet' ? 'bet' : 'raise'}` as MessageKey, { name: p.name, to: (last.to ?? 0).toFixed(1), allIn: s.seats[before.toAct!]!.allIn ? t('review.allIn') : '' });
  };

  // Bots act after a short pause; showdowns are settled with the evaluator.
  useEffect(() => {
    if (!state || !docs || busy.current) return;
    if (needsShowdown(state)) {
      busy.current = true;
      showdown(state)
        .then(setState)
        .finally(() => (busy.current = false));
      return;
    }
    if (state.done || state.toAct === null || state.seats[state.toAct]!.hero) return;
    busy.current = true;
    const delay = reduce === 'on' ? 0 : 450;
    const h = setTimeout(async () => {
      try {
        const m: BotMove = chartMove(state, docs, rnd) ?? (await ruleMove(state, equityVsRandom, rnd));
        const next = act(state, m.move);
        setLog((l) => [...l, { name: state.seats[state.toAct!]!.name, text: describe(next, state, m.move), source: m.source }]);
        setState(next);
      } finally {
        busy.current = false;
      }
    }, delay);
    return () => {
      clearTimeout(h);
      busy.current = false;
    };
  }, [state, docs, rnd, reduce]); // eslint-disable-line react-hooks/exhaustive-deps

  const heroMove = (move: Move) => {
    if (!state) return;
    const next = act(state, move);
    setLog((l) => [...l, { name: t('table.you'), text: describe(next, state, move) }]);
    setRaiseTo('');
    setState(next);
  };

  if (!docs) return <p role="status">{t('play.loading')}</p>;
  const hero = state?.seats.find((p) => p.hero);
  const heroTurn = !!state && state.toAct !== null && state.seats[state.toAct]!.hero && !state.done;
  const l = state && heroTurn ? legal(state) : null;
  const pot = state ? state.contributed.reduce((a, b) => a + b, 0) : 0;
  const decisions = state && docs.size ? reviewHand(toHand(state), docs) : [];
  const lastDecision = decisions.at(-1);
  const sizes = state && l?.minTo !== null && l?.minTo !== undefined ? (state.street === 'preflop' ? [l.minTo, state.currentBet * 3, state.currentBet * 2 + pot] : [0.33, 0.5, 0.75, 1].map((f) => state.currentBet + f * (pot + (l.call ?? 0)))) : [];
  const seats: TableSeat[] = state
    ? state.seats.map((p, i) => ({ name: p.name, position: p.position, stack: p.stack, status: p.folded ? 'folded' : p.allIn ? 'allin' : 'active', hero: p.hero, cards: p.hero || state.shown[i] ? p.cards : null, bet: state.bets[i]! || undefined, toAct: state.toAct === i }))
    : names.map((n, i) => ({ name: n, position: '', stack: game.stack, status: 'active', hero: i === 0 }));

  return (
    <div className="space-y-4" data-testid="play">
      <section className="card flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="max-w-prose text-ink-muted">{t('play.intro', { players, stack: game.stack })}</p>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={coach} onChange={(e) => setCoach(e.target.checked)} data-testid="coach-toggle" />
          {t('play.coach')}
        </label>
      </section>
      <PokerTable seats={seats} pot={state ? pot - state.bets.reduce((a, b) => a + b, 0) : 0} board={state?.board ?? []} summary={t('play.summary', { players, stack: game.stack, hand: handNo })} history={log.map((x) => `${x.text}${x.source ? ` · ${t(x.source === 'chart' ? 'play.src.chart' : 'play.src.rule')}` : ''}`)} button={state?.button} />
      {!state || state.done ? (
        <div className="space-y-3">
          {state?.done && hero && (
            <p className="font-medium" data-testid="play-result">
              {t('play.result', { result: result(toHand(state), hero.name).toFixed(1) })}
            </p>
          )}
          <button type="button" className="btn-primary" onClick={deal} data-testid="deal">
            {state ? t('play.next') : t('play.deal')}
          </button>
          {state?.done && (
            <details className="card" data-testid="play-replay">
              <summary className="cursor-pointer font-medium">{t('play.replay')}</summary>
              <div className="mt-3">
                <Replay hand={toHand(state, String(handNo))} decisions={decisions} />
              </div>
            </details>
          )}
        </div>
      ) : heroTurn && l ? (
        <section className="card space-y-3" data-testid="play-actions">
          <p className="text-sm font-medium">{t('play.yourMove', { cards: hero!.cards.join(' ') })}</p>
          <div className="flex flex-wrap gap-2">
            {l.fold && (
              <button type="button" className="btn-secondary" onClick={() => heroMove({ kind: 'fold' })}>
                {t('play.fold')}
              </button>
            )}
            {l.check && (
              <button type="button" className="btn-secondary" onClick={() => heroMove({ kind: 'check' })}>
                {t('play.check')}
              </button>
            )}
            {l.call !== null && (
              <button type="button" className="btn-secondary" onClick={() => heroMove({ kind: 'call' })}>
                {t('play.call', { amount: l.call.toFixed(1) })}
              </button>
            )}
            {l.minTo !== null &&
              [...new Set(sizes.map((x) => Math.min(l.maxTo!, Math.max(l.minTo!, Math.round(x * 2) / 2))))].map((to) => (
                <button key={to} type="button" className="btn-secondary" onClick={() => heroMove({ kind: 'raise', to })}>
                  {t(state.currentBet === 0 ? 'play.betTo' : 'play.raiseTo', { to: to.toFixed(1) })}
                </button>
              ))}
            {l.maxTo !== null && (
              <button type="button" className="btn-secondary" onClick={() => heroMove({ kind: 'raise', to: l.maxTo! })}>
                {t('play.allIn', { to: l.maxTo.toFixed(1) })}
              </button>
            )}
          </div>
          {l.minTo !== null && (
            <form
              className="flex flex-wrap items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const to = Number(raiseTo);
                if (Number.isFinite(to)) heroMove({ kind: 'raise', to });
              }}
            >
              <label className="text-sm">
                <span className="mb-1 block font-medium">{t('play.customTo', { min: l.minTo.toFixed(1), max: l.maxTo!.toFixed(1) })}</span>
                <input className="field w-28" type="number" step="0.5" min={l.minTo} max={l.maxTo!} value={raiseTo} onChange={(e) => setRaiseTo(e.target.value)} />
              </label>
              <button type="submit" className="btn-quiet" disabled={!raiseTo}>
                {t('play.custom')}
              </button>
            </form>
          )}
        </section>
      ) : (
        <p className="text-sm text-ink-muted" role="status">
          {t('play.waiting')}
        </p>
      )}
      {coach && lastDecision && state && !state.done && lastDecision.index === state.history.map((a) => a.player).lastIndexOf(t('table.you')) && (
        <section className="card" data-testid="play-coach">
          <p className="mb-1 text-sm font-medium">{t('play.coachTitle')}</p>
          <DecisionCard d={lastDecision} />
        </section>
      )}
      <p className="text-xs text-ink-muted">{t('play.botsNote')}</p>
    </div>
  );
}
