// Playing sessions (D-090): cash games, sit-and-gos and a multi-table simulation against
// reference and personality bots, with coaching Off / Review after each hand / Live hints, a
// what-if branch from any of your decisions, all-in EV and a session report.

import { fileGraded } from '../trainer/preflop/deal';
import { useEffect, useMemo, useRef, useState } from 'react';
import { href } from '../../app/route';
import { pct } from '../../lib/format';
import { cellOf } from '../../lib/poker/hands';
import { t, type MessageKey } from '../../lib/i18n';
import { loadJson, type ChartFile } from '../../lib/provenance/types';
import { useSettings } from '../../lib/settings/useSettings';
import { Badge, SegmentedControl } from '../../lib/ui/components';
import { solverClient } from '../../lib/wasm/client';
import { DecisionCard, Replay } from '../review/HandReview';
import { CASH_FILES, HU_FILE, preflopSpot, reviewHand } from '../review/reviewHand';
import { PokerTable, type Seat as TableSeat } from '../table/PokerTable';
import { mulberry32 } from '../trainer/preflop/deal';
import { toHand } from './bots';
import { act, legal, needsShowdown, newHand, type GameState, type Move } from './engine';
import { HeroActions } from './HeroActions';
import { icmReference, type IcmReference } from './icm';
import { PERSONALITIES, personalityMove, type Personality } from './personality';
import { equityVsRandom, showdown } from './PlayTable';
import { applyHand, handSetup, isTournament, levelOf, MTT_PAYOUTS, SNG_PAYOUTS, startSession, type Format, type Session } from './session';
import { allInEvBb, allInSpot, sessionReport, type HandResult } from './summary';

const FILES = [...Object.values(CASH_FILES), HU_FILE];

/** "You call 2.5" / "Bot 2 raises to 7.5": the same phrases as quick play. */
function describe(s: GameState, before: GameState, move: Move): string {
  const p = before.seats[before.toAct!]!;
  const last = s.history.at(-1)!;
  const k = p.hero ? 'play.you' : 'play.log';
  if (move.kind === 'fold') return t(`${k}.fold` as MessageKey, { name: p.name });
  if (move.kind === 'check') return t(`${k}.check` as MessageKey, { name: p.name });
  if (move.kind === 'call') return t(`${k}.call` as MessageKey, { name: p.name, amount: last.amount.toFixed(1) });
  return t(`${k}.${last.kind === 'bet' ? 'bet' : 'raise'}` as MessageKey, { name: p.name, to: (last.to ?? 0).toFixed(1), allIn: s.seats[before.toAct!]!.allIn ? t('review.allIn') : '' });
}
type Coaching = 'off' | 'review' | 'live';
type Speed = 'slow' | 'normal' | 'fast';
const DELAY: Record<Speed, number> = { slow: 1000, normal: 450, fast: 120 };
type Kind = Format['kind'];
type BotMix = 'reference' | 'mixed' | Personality;

function mixFor(m: BotMix): Personality[] {
  if (m === 'mixed') return PERSONALITIES.filter((p) => p !== 'reference');
  return [m];
}

function formatFor(kind: Kind, players: number, stack: number, carry: boolean, rebuy: boolean): Format {
  if (kind === 'cash') return { kind, players, startBb: stack, stacks: carry ? 'carry' : 'reset', rebuy };
  if (kind === 'sng') return { kind, players: players >= 9 ? 9 : 6, startChips: 1500, handsPerLevel: 8, payouts: SNG_PAYOUTS[players >= 9 ? 9 : 6]! };
  return { kind, field: 27, tableSize: 9, startChips: 1500, handsPerLevel: 8, payouts: MTT_PAYOUTS };
}

/** Progressive live hints: price and SPR, then equity, then (only when asked) the reference. */
function LiveHints({ state, docs, session, stacks, ante }: { state: GameState; docs: Map<string, ChartFile>; session: Session; stacks: number[]; ante: number }) {
  const [level, setLevel] = useState(0);
  const [eq, setEq] = useState<number | null>(null);
  const [ref, setRef] = useState<string[] | null>(null);
  useEffect(() => {
    setLevel(0);
    setEq(null);
    setRef(null);
  }, [state.history.length]);
  const l = legal(state);
  const hero = state.seats[state.toAct!]!;
  const pot = state.contributed.reduce((a, b) => a + b, 0);
  const behind = Math.min(hero.stack, Math.max(...state.seats.filter((p) => !p.folded && !p.hero).map((p) => p.stack)));
  const more = async () => {
    const next = level + 1;
    setLevel(next);
    if (next === 2) {
      const opp = state.seats.filter((p) => !p.folded && !p.hero).length;
      setEq(await equityVsRandom(hero.cards.join(''), state.board.join(''), opp));
    }
    if (next === 3) {
      const lines: string[] = [];
      if (isTournament(session.format)) {
        const r: IcmReference = await icmReference(state, session, stacks, ante, (spot) => solverClient().call('pushFold', { spot }));
        lines.push('reason' in r ? t('session.hint.noIcm', { reason: r.reason }) : t('session.hint.icm', { a0: r.actions[0], e0: pct(r.ev[0] / r.pool, 2), a1: r.actions[1], e1: pct(r.ev[1] / r.pool, 2), best: r.actions[r.best] }));
      }
      if (state.street === 'preflop') {
        const spot = preflopSpot(toHand(state), state.history.length, hero.name);
        if ('reason' in spot) lines.push(t('session.hint.noChart', { reason: spot.reason }));
        else {
          const doc = docs.get(spot.file);
          const chart = doc?.charts.find((c) => c.id === spot.chart);
          const k = doc ? doc.classes.indexOf(doc.classes[cellOf(hero.cards.join('')).index]!) : -1;
          if (chart && k >= 0) lines.push(t(spot.graded || fileGraded(doc!) ? 'session.hint.chart' : 'session.hint.chartPractice', { mix: chart.actions.map((a, i) => `${a} ${pct(chart.strategy[k]![i]!, 0)}`).join(', ') }));
        }
      } else if (!lines.length) lines.push(t('session.hint.noPostflop'));
      setRef(lines);
    }
  };
  return (
    <section className="card space-y-2 text-sm" data-testid="live-hints">
      {level >= 1 && (
        <p>
          {l.call !== null ? t('session.hint.price', { call: l.call.toFixed(1), required: pct(l.call / (pot + l.call), 1) }) : t('session.hint.noBet')} {t('session.hint.spr', { spr: (behind / Math.max(pot, 0.01)).toFixed(1), position: hero.position })}
        </p>
      )}
      {level >= 2 && <p>{eq === null ? '…' : t('session.hint.equity', { eq: pct(eq, 0) })}</p>}
      {level >= 3 && ref && ref.map((x) => <p key={x}>{x}</p>)}
      {level < 3 && (
        <button type="button" className="btn-quiet" onClick={() => void more()} data-testid="hint-more">
          {level === 0 ? t('session.hint.first') : level === 1 ? t('session.hint.second') : t('session.hint.reveal')}
        </button>
      )}
    </section>
  );
}

export function PlaySession() {
  const reduce = useSettings((st) => st.settings.display.reduceMotion);
  const defaultStack = useSettings((st) => st.settings.game.stack);
  const [kind, setKind] = useState<Kind>('cash');
  const [players, setPlayers] = useState(6);
  const [stack, setStack] = useState(defaultStack);
  const [carry, setCarry] = useState(true);
  const [rebuy, setRebuy] = useState(true);
  const [mix, setMix] = useState<BotMix>('mixed');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [coaching, setCoaching] = useState<Coaching>('review');
  const [docs, setDocs] = useState<Map<string, ChartFile>>(new Map());
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<GameState | null>(null);
  const [setup, setSetup] = useState<ReturnType<typeof handSetup> | null>(null);
  const [results, setResults] = useState<HandResult[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [snaps, setSnaps] = useState<GameState[]>([]);
  const [sandbox, setSandbox] = useState<{ from: number } | null>(null);
  const [showReport, setShowReport] = useState(false);
  const rnd = useMemo(() => mulberry32(Date.now() & 0x7fffffff), []);
  const busy = useRef(false);

  useEffect(() => {
    Promise.all(FILES.map((f) => loadJson<ChartFile>(`data/charts/${f}`).then((d) => [f, d] as const)))
      .then((all) => setDocs(new Map(all)))
      .catch(() => setDocs(new Map()));
  }, []);

  const start = () => {
    const f = formatFor(kind, players, stack, carry, rebuy);
    const seats = f.kind === 'mtt' ? f.tableSize : f.players;
    const names = Array.from({ length: seats }, (_, i) => (i === 0 ? t('table.you') : t('play.bot', { n: i })));
    setSession(startSession(f, names, mixFor(mix)));
    setResults([]);
    setState(null);
    setShowReport(false);
  };

  const deal = (s: Session) => {
    const su = handSetup(s);
    setSetup(su);
    setLog([]);
    setSnaps([]);
    setSandbox(null);
    setState(newHand({ names: su.names, stacks: su.stacks, hero: su.hero, button: su.button, seed: Math.floor(rnd() * 2 ** 31), ante: su.ante }));
  };

  const finishHand = async (end: GameState) => {
    if (!session || !setup || sandbox) return;
    const spot = allInSpot(end);
    let allIn = null;
    if (spot) {
      const r = await solverClient().call('equity', { request: { ranges: [end.seats[setup.hero]!.cards.join(''), spot.villain], board: spot.board.join(''), dead: '', mode: 'exact' } });
      if (r.ok) allIn = { ...spot, equity: r.players[0]!.equity, evBb: allInEvBb(r.players[0]!.equity, spot.pot, spot.contributed) };
    }
    const decisions = docs.size ? reviewHand(toHand(end), docs) : [];
    const hero = end.seats[setup.hero]!;
    setResults((rs) => [...rs, { hand: session.hand + 1, netBb: end.collected[setup.hero]! - end.contributed[setup.hero]!, allIn, decisions, position: hero.position }]);
    setSession(applyHand(session, end, setup, rnd));
  };

  // Bots act after a pause; showdowns are settled with the evaluator; finished hands update the session.
  useEffect(() => {
    if (!state || !setup || busy.current) return;
    if (needsShowdown(state)) {
      busy.current = true;
      showdown(state)
        .then(setState)
        .finally(() => (busy.current = false));
      return;
    }
    if (state.done) return;
    if (state.toAct === null || state.seats[state.toAct]!.hero) return;
    busy.current = true;
    const h = setTimeout(
      async () => {
        try {
          const who = state.toAct!;
          const m = await personalityMove(setup.bots[who] ?? 'reference', state, docs, equityVsRandom, rnd);
          const next = act(state, m.move);
          setLog((l) => [...l, `${describe(next, state, m.move)}${m.deviation ? ` · ${m.deviation}` : ''}`]);
          setState(next);
        } finally {
          busy.current = false;
        }
      },
      reduce === 'on' ? 0 : DELAY[speed],
    );
    return () => {
      clearTimeout(h);
      busy.current = false;
    };
  }, [state, setup, docs, rnd, reduce, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Record the hand once it's over (not for what-if branches).
  const recorded = useRef<GameState | null>(null);
  useEffect(() => {
    if (state?.done && !sandbox && recorded.current !== state) {
      recorded.current = state;
      void finishHand(state);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const heroMove = (m: Move) => {
    if (!state) return;
    if (!sandbox) setSnaps((xs) => [...xs, state]);
    const next = act(state, m);
    setLog((l) => [...l, describe(next, state, m)]);
    setState(next);
  };

  if (!session)
    return (
      <section className="card space-y-4" data-testid="session-setup">
        <p className="max-w-prose text-sm text-ink-muted">{t('session.intro')}</p>
        <div className="space-y-1">
          <p className="text-sm font-medium">{t('session.format')}</p>
          <SegmentedControl label={t('session.format')} value={kind} onChange={setKind} options={(['cash', 'sng', 'mtt'] as const).map((k) => ({ value: k, label: t(`session.kind.${k}` as MessageKey) }))} />
        </div>
        {kind !== 'mtt' && (
          <label className="block text-sm">
            <span className="mb-1 block font-medium">{t('session.players')}</span>
            <select className="field w-32" value={players} onChange={(e) => setPlayers(Number(e.target.value))}>
              {(kind === 'cash' ? [2, 3, 4, 5, 6, 7, 8, 9] : [6, 9]).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
        {kind === 'cash' && (
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-sm">
              <span className="mb-1 block font-medium">{t('session.stack')}</span>
              <input className="field num w-28" type="number" min={10} max={300} value={stack} onChange={(e) => setStack(Number(e.target.value))} />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={carry} onChange={(e) => setCarry(e.target.checked)} />
              {t('session.carry')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={rebuy} onChange={(e) => setRebuy(e.target.checked)} />
              {t('session.rebuy')}
            </label>
          </div>
        )}
        {kind !== 'cash' && <p className="text-sm text-ink-muted">{t(`session.kindNote.${kind}` as MessageKey)}</p>}
        <label className="block text-sm">
          <span className="mb-1 block font-medium">{t('session.bots')}</span>
          <select className="field" value={mix} onChange={(e) => setMix(e.target.value as BotMix)} data-testid="bot-mix">
            <option value="mixed">{t('session.bots.mixed')}</option>
            {PERSONALITIES.map((p) => (
              <option key={p} value={p}>
                {t(`bot.${p}` as MessageKey)}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap gap-6">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('session.coaching')}</p>
            <SegmentedControl label={t('session.coaching')} value={coaching} onChange={setCoaching} size="sm" options={(['off', 'review', 'live'] as const).map((c) => ({ value: c, label: t(`session.coaching.${c}` as MessageKey) }))} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t('session.speed')}</p>
            <SegmentedControl label={t('session.speed')} value={speed} onChange={setSpeed} size="sm" options={(['slow', 'normal', 'fast'] as const).map((s) => ({ value: s, label: t(`session.speed.${s}` as MessageKey) }))} />
          </div>
        </div>
        <button type="button" className="btn-primary" onClick={start} data-testid="session-start">
          {t('session.start')}
        </button>
      </section>
    );

  const lvl = levelOf(session);
  const heroSeat = state && setup ? state.seats[setup.hero] : null;
  const heroTurn = !!state && state.toAct !== null && state.seats[state.toAct]!.hero && !state.done;
  const pot = state ? state.contributed.reduce((a, b) => a + b, 0) : 0;
  const decisions = state && docs.size ? reviewHand(toHand(state), docs) : [];
  const lastDecision = decisions.at(-1);
  const report = sessionReport(results);
  const seats: TableSeat[] = state && setup
    ? state.seats.map((p, i) => ({
        name: setup.bots[i] ? `${p.name} · ${t(`bot.short.${setup.bots[i]}` as MessageKey)}` : p.name,
        position: p.position,
        stack: p.stack,
        status: p.folded ? 'folded' : p.allIn ? 'allin' : 'active',
        hero: p.hero,
        cards: p.hero || state.shown[i] ? p.cards : null,
        bet: state.bets[i]! || undefined,
        toAct: state.toAct === i,
      }))
    : [];
  const bots = [...new Set(session.table.filter((p) => p.bot && !p.out).map((p) => p.bot!))];
  const last = results.at(-1);

  return (
    <div className="space-y-4" data-testid="session">
      <section className="card flex flex-wrap items-center gap-3 text-sm" data-testid="session-info">
        <Badge tone="accent">{t(`session.kind.${session.format.kind}` as MessageKey)}</Badge>
        {isTournament(session.format) ? (
          <span>{t('session.level', { sb: lvl.sb, bb: lvl.bb, ante: lvl.ante, left: session.remaining, chips: Math.round(session.table[0]!.chips) })}</span>
        ) : (
          <span>{t('session.cashInfo', { hands: session.hand, net: report.netBb.toFixed(1) })}</span>
        )}
        {sandbox && <Badge tone="warn">{t('session.whatIfBadge')}</Badge>}
        <button type="button" className="btn-quiet ml-auto" onClick={() => setShowReport((x) => !x)} data-testid="session-report-toggle">
          {t('session.reportToggle')}
        </button>
        <button type="button" className="btn-quiet" onClick={() => setSession(null)}>
          {t('session.end')}
        </button>
      </section>
      {state && <PokerTable seats={seats} pot={pot - state.bets.reduce((a, b) => a + b, 0)} board={state.board} summary={t('session.tableSummary', { hand: session.hand + 1 })} history={log} button={state.button} />}
      {session.finished ? (
        <section className="card space-y-2" data-testid="session-finished">
          <p className="font-medium">
            {isTournament(session.format) ? t('session.finishedTourney', { place: session.table[0]!.place ?? 0, prize: pct((session.heroPrize ?? 0) / 100, 0) }) : t('session.finishedCash')}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => setSession(null)}>
              {t('session.again')}
            </button>
            <a className="btn-secondary" href={href('play', ['journal'])}>
              {t('session.reflect')}
            </a>
          </div>
        </section>
      ) : !state || (state.done && !sandbox) ? (
        <div className="space-y-3">
          {last && (
            <p className="font-medium" data-testid="session-hand-result">
              {t('session.handResult', { net: last.netBb.toFixed(1) })}
              {last.allIn ? ` ${t('session.allInEv', { ev: last.allIn.evBb.toFixed(1), eq: pct(last.allIn.equity, 0) })}` : ''}
            </p>
          )}
          <button type="button" className="btn-primary" onClick={() => deal(session)} data-testid="session-deal">
            {state ? t('play.next') : t('play.deal')}
          </button>
          {state?.done && coaching !== 'off' && (
            <details className="card" open={coaching === 'review'} data-testid="session-review">
              <summary className="cursor-pointer font-medium">{t('session.review')}</summary>
              <div className="mt-3 space-y-3">
                <Replay hand={toHand(state, String(session.hand))} decisions={decisions} />
                {snaps.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">{t('session.whatIf')}</p>
                    <div className="flex flex-wrap gap-2">
                      {snaps.map((snap, i) => (
                        <button
                          key={i}
                          type="button"
                          className="btn-secondary"
                          onClick={() => {
                            setSandbox({ from: i });
                            setLog((l) => [...l, t('session.whatIfStart')]);
                            setState(snap);
                          }}
                          data-testid="what-if"
                        >
                          {t('session.whatIfAt', { street: snap.street, n: i + 1 })}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </details>
          )}
        </div>
      ) : state.done && sandbox ? (
        <section className="card space-y-2" data-testid="what-if-result">
          <p className="font-medium">{t('session.whatIfResult', { net: (state.collected[setup!.hero]! - state.contributed[setup!.hero]!).toFixed(1) })}</p>
          <button type="button" className="btn-primary" onClick={() => deal(session)}>
            {t('session.whatIfBack')}
          </button>
        </section>
      ) : heroTurn && setup ? (
        <>
          <HeroActions state={state} onMove={heroMove} />
          {coaching === 'live' && !sandbox && <LiveHints state={state} docs={docs} session={session} stacks={setup.stacks} ante={setup.ante} />}
        </>
      ) : (
        <p className="text-sm text-ink-muted" role="status">
          {t('play.waiting')}
        </p>
      )}
      {coaching === 'live' && lastDecision && state && !state.done && heroSeat && lastDecision.index === state.history.map((a) => a.player).lastIndexOf(heroSeat.name) && (
        <section className="card" data-testid="play-coach">
          <p className="mb-1 text-sm font-medium">{t('play.coachTitle')}</p>
          <DecisionCard d={lastDecision} />
        </section>
      )}
      <details className="card text-sm" data-testid="session-bots">
        <summary className="cursor-pointer font-medium">{t('session.whoTitle')}</summary>
        <ul className="mt-2 space-y-2">
          {bots.map((b) => (
            <li key={b}>
              <span className="font-medium">{t(`bot.${b}` as MessageKey)}</span>: {t(`bot.leak.${b}` as MessageKey)} <span className="text-ink-muted">{t(`bot.exploit.${b}` as MessageKey)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-ink-muted">{t('session.botsNote')}</p>
      </details>
      {showReport && (
        <section className="card space-y-2 text-sm" data-testid="session-report">
          <h3 className="text-base font-semibold">{t('session.reportTitle')}</h3>
          <p>{t('session.reportHands', { n: report.hands, net: report.netBb.toFixed(1), adj: report.allInAdjustedBb.toFixed(1), allIns: report.allIns })}</p>
          <p>{t('session.reportGraded', { n: report.graded })}</p>
          {Object.keys(report.lossByPosition).length > 0 && (
            <p>{t('session.reportByPosition', { list: Object.entries(report.lossByPosition).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ') })}</p>
          )}
          {Object.keys(report.lossByStreet).length > 0 && <p>{t('session.reportByStreet', { list: Object.entries(report.lossByStreet).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(', ') })}</p>}
          {report.mistakes.length > 0 && (
            <ul className="list-disc pl-5">
              {report.mistakes.map((m) => (
                <li key={`${m.hand}-${m.decision.index}`}>{t('session.reportMistake', { hand: m.hand, chart: m.decision.ref?.chart ?? '', loss: m.decision.grade!.lossBb.toFixed(2) })}</li>
              ))}
            </ul>
          )}
          <p className="text-ink-muted">{report.leaks.length ? t('session.reportLeaks', { list: report.leaks.map((l) => `${l.dimension} ${l.value}`).join(', ') }) : t('session.reportNoLeaks')}</p>
          {report.drills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {report.drills.map((d) => (
                <a key={d.chart} className="btn-secondary" href={href('train', ['preflop'], { files: d.file, chart: d.chart })}>
                  {t('session.reportDrill', { chart: d.chart })}
                </a>
              ))}
            </div>
          )}
          <p className="text-xs text-ink-muted">{t('session.reportNote')}</p>
        </section>
      )}
    </div>
  );
}
