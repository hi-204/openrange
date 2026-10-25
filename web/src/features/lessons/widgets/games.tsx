// Level 5–6 widgets (D-074): the toy river game solved by the engine next to its theory, ICM
// prize equity with bubble factors, and bankroll variance.

import { useEffect, useId, useRef, useState } from 'react';
import { pct } from '../../../lib/format';
import { t } from '../../../lib/i18n';
import { CancelledError, SolverClient, solverClient } from '../../../lib/wasm/client';
import type { SolverInfo, SolverNode } from '../../../lib/wasm/protocol';
import { bubble, maxDrawdown, simulate, toyBestResponse, toySpot, toyTheory, varianceStats } from './gamesMath';
import { Slider } from './math';

type Config = Record<string, unknown>;
const n = (c: Config, k: string, d: number) => (typeof c[k] === 'number' ? (c[k] as number) : d);
const POT = 10;

type ToyRead = { iterations: number; pctPot: number; evBettor: number; bluffShare: number; airBets: number; valueBets: number; call: number };

/** Read the toy game's frequencies from a solved tree (value = the nines, air = Q-J). */
async function readToy(c: SolverClient, info: SolverInfo, iterations: number, pctPot: number, evBettor: number): Promise<ToyRead> {
  const root = (await c.call('solverNode', { path: [] })) as SolverNode & { kind: 'action' };
  const facing = (await c.call('solverNode', { path: [1] })) as SolverNode & { kind: 'action' };
  const H0 = info.hands[0].length;
  let v = 0;
  let vb = 0;
  let a = 0;
  let ab = 0;
  info.hands[0].forEach((h, i) => {
    const r = root.reach[0]![i]!;
    const bet = root.strategy[H0 + i]!;
    if (h[0] === '9') {
      v += r;
      vb += r * bet;
    } else {
      a += r;
      ab += r * bet;
    }
  });
  const H1 = info.hands[1].length;
  let call = 0;
  let total = 0;
  info.hands[1].forEach((_, i) => {
    const r = facing.reach[1]![i]!;
    total += r;
    call += r * facing.strategy[H1 + i]!;
  });
  return { iterations, pctPot, evBettor, valueBets: vb / v, airBets: a ? ab / a : 0, bluffShare: ab / (vb + ab), call: total ? call / total : 0 };
}

const CHECKPOINTS = [10, 30, 100, 300, 1000, 3000];

/** The polarized river game: the engine's solution next to the formulas. */
export function ToyGame({ config }: { config: Config }) {
  const [betPct, setBetPct] = useState(n(config, 'bet', 75));
  const [air, setAir] = useState(n(config, 'air', 1));
  const [lock, setLock] = useState(Math.round(n(config, 'call', 0.4) * 100));
  const showConvergence = config.convergence === true;
  const showLock = config.lock === true;
  const client = useRef<SolverClient | null>(null);
  const [state, setState] = useState<{ kind: 'idle' } | { kind: 'running' } | { kind: 'ready'; final: ToyRead; steps: ToyRead[] } | { kind: 'error'; message: string }>({ kind: 'idle' });
  useEffect(() => () => client.current?.cancel(), []);
  // A new game invalidates the old solve.
  useEffect(() => setState({ kind: 'idle' }), [betPct, air]);
  const bet = (POT * betPct) / 100;
  const theory = toyTheory(POT, bet, air);

  const solve = async () => {
    client.current?.cancel();
    const c = new SolverClient();
    client.current = c;
    setState({ kind: 'running' });
    try {
      const spot = toySpot(POT, betPct, air);
      const steps: ToyRead[] = [];
      const info = await c.call('solverStart', { spot, budgetBytes: 2e8, allowAbstraction: false });
      // Convergence view: stop at fixed iteration counts on the way, then finish the solve.
      if (showConvergence)
        for (const k of CHECKPOINTS) {
          const r = await c.call('solverRun', { maxIterations: k, targetPct: 0 });
          steps.push(await readToy(c, info, r.iterations, r.pctPot, r.evBb[0]));
        }
      const r = await c.call('solverRun', { maxIterations: 5000, targetPct: 0.005 });
      setState({ kind: 'ready', final: await readToy(c, info, r.iterations, r.pctPot, r.evBb[0]), steps });
    } catch (e) {
      if (!(e instanceof CancelledError)) setState({ kind: 'error', message: (e as Error).message });
    }
  };

  const row = (label: string, solved: number | null, want: number, fmt: (x: number) => string) => (
    <tr className="border-t border-slate-100 dark:border-slate-800">
      <th scope="row" className="py-1 pr-3 text-left font-normal">
        {label}
      </th>
      <td className="num py-1 pr-3">{solved === null ? '–' : fmt(solved)}</td>
      <td className="num py-1">{fmt(want)}</td>
    </tr>
  );
  const bb = (x: number) => `${x.toFixed(2)} bb`;
  const final = state.kind === 'ready' ? state.final : null;
  const br = toyBestResponse(POT, bet, air, lock / 100);
  return (
    <div className="space-y-3">
      <p className="text-sm">{t('widget.toy.setup', { pot: POT })}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label={t('widget.toy.bet')} value={betPct} min={25} max={200} step={25} onChange={setBetPct} unit="%" />
        <Slider label={t('widget.toy.air')} value={air} min={0} max={3} step={0.25} onChange={setAir} unit="×" />
      </div>
      {state.kind !== 'running' && (
        <button type="button" className="btn-primary" onClick={() => void solve()}>
          {t('widget.solver.solve')}
        </button>
      )}
      {state.kind === 'running' && <p role="status">{t('widget.toy.solving')}</p>}
      {state.kind === 'error' && <p className="text-amber-700 dark:text-amber-400">{state.message}</p>}
      {final && (
        <p className="text-sm" data-testid="toy-status">
          {t('widget.toy.solved', { x: final.pctPot.toFixed(3), it: final.iterations })}
        </p>
      )}
      <table className="w-full text-sm" data-testid="toy-result">
        <thead>
          <tr>
            <th className="py-1 text-left font-medium">{t('widget.toy.quantity')}</th>
            <th className="py-1 text-left font-medium">{t('widget.toy.engine')}</th>
            <th className="py-1 text-left font-medium">{t('widget.toy.theory')}</th>
          </tr>
        </thead>
        <tbody>
          {row(t('widget.toy.bluffShare'), final?.bluffShare ?? null, theory.bluffShare, (x) => pct(x, 1))}
          {row(t('widget.toy.airBets'), final?.airBets ?? null, theory.airBets, (x) => pct(x, 1))}
          {row(t('widget.toy.valueBets'), final?.valueBets ?? null, theory.valueBets, (x) => pct(x, 1))}
          {row(t('widget.toy.call'), final?.call ?? null, theory.call, (x) => pct(x, 1))}
          {row(t('widget.toy.ev'), final?.evBettor ?? null, theory.evBettor, bb)}
        </tbody>
      </table>
      <p className="text-xs text-ink-muted">{t('widget.toy.formulas')}</p>
      {showConvergence && state.kind === 'ready' && (
        <table className="w-full text-sm" data-testid="toy-convergence">
          <thead>
            <tr>
              <th className="py-1 text-left font-medium">{t('widget.toy.iterations')}</th>
              <th className="py-1 text-left font-medium">{t('widget.toy.exploitability')}</th>
              <th className="py-1 text-left font-medium">{t('widget.toy.call')}</th>
              <th className="py-1 text-left font-medium">{t('widget.toy.bluffShare')}</th>
            </tr>
          </thead>
          <tbody>
            {state.steps.map((s) => (
              <tr key={s.iterations} className="border-t border-slate-100 dark:border-slate-800">
                <td className="num py-1">{s.iterations}</td>
                <td className="num py-1">{s.pctPot.toFixed(3)}%</td>
                <td className="num py-1">{pct(s.call, 1)}</td>
                <td className="num py-1">{pct(s.bluffShare, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {showLock && (
        <div className="space-y-2 rounded-control bg-surface-2 p-3" data-testid="toy-lock">
          <Slider label={t('widget.toy.lock')} value={lock} min={0} max={100} step={1} onChange={setLock} unit="%" />
          <p className="text-sm font-medium">{t(br.bluff === 'all' ? 'widget.toy.brAll' : br.bluff === 'none' ? 'widget.toy.brNone' : 'widget.toy.brAny')}</p>
          <p className="text-sm">{t('widget.toy.brEv', { br: bb(br.evBettor), eq: bb(theory.evBettor), gain: bb(br.evBettor - theory.evBettor) })}</p>
          <p className="text-xs text-ink-muted">{t('widget.toy.brNote')}</p>
        </div>
      )}
    </div>
  );
}

const list = (text: string) =>
  text
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);

function ListInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
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

/** ICM prize equity for a table, and the bubble factor for one call. */
export function IcmWidget({ config }: { config: Config }) {
  const arr = (k: string, d: number[]) => (Array.isArray(config[k]) ? (config[k] as number[]) : d);
  const [stacks, setStacks] = useState(arr('stacks', [5000, 3000, 1500, 500]).join(', '));
  const [payouts, setPayouts] = useState(arr('payouts', [50, 30, 20]).join(', '));
  const [hero, setHero] = useState(n(config, 'hero', 1));
  const [villain, setVillain] = useState(n(config, 'villain', 0));
  const [res, setRes] = useState<{ equity: number[]; bubble: Awaited<ReturnType<typeof bubble>> | null } | { error: string } | null>(null);
  useEffect(() => {
    let live = true;
    const s = list(stacks);
    const p = list(payouts);
    const c = solverClient();
    const icm = async (x: number[]) => {
      const r = await c.call('icm', { stacks: x, payouts: p });
      if (!r.ok) throw new Error(r.error);
      return r.equity;
    };
    (async () => {
      if (s.some((x) => !Number.isFinite(x)) || p.some((x) => !Number.isFinite(x))) throw new Error(t('widget.icm.numbers'));
      const equity = await icm(s);
      const ok = hero !== villain && hero < s.length && villain < s.length && s[hero]! > 0 && s[villain]! > 0;
      return { equity, bubble: ok ? await bubble(s, hero, villain, icm) : null };
    })()
      .then((r) => live && setRes(r))
      .catch((e: Error) => live && setRes({ error: e.message }));
    return () => {
      live = false;
    };
  }, [stacks, payouts, hero, villain]);
  const s = list(stacks);
  const chips = s.reduce((a, b) => a + b, 0);
  const prizes = list(payouts).reduce((a, b) => a + b, 0);
  const ids = { hero: useId(), villain: useId() };
  const players = s.map((_, i) => t('widget.icm.player', { n: i + 1 }));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <ListInput label={t('widget.icm.stacks')} value={stacks} onChange={setStacks} />
        <ListInput label={t('widget.icm.payouts')} value={payouts} onChange={setPayouts} />
      </div>
      {res && 'error' in res && <p className="text-sm text-amber-700 dark:text-amber-400">{res.error}</p>}
      {res && 'equity' in res && (
        <>
          <table className="w-full text-sm" data-testid="icm-result">
            <thead>
              <tr>
                <th className="py-1 text-left font-medium">{t('widget.icm.who')}</th>
                <th className="py-1 text-left font-medium">{t('widget.icm.chipShare')}</th>
                <th className="py-1 text-left font-medium">{t('widget.icm.prizeShare')}</th>
                <th className="py-1 text-left font-medium">{t('widget.icm.equity')}</th>
              </tr>
            </thead>
            <tbody>
              {res.equity.map((e, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  <th scope="row" className="py-1 text-left font-normal">
                    {players[i]} <span className="num text-ink-muted">({s[i]})</span>
                  </th>
                  <td className="num py-1">{pct(s[i]! / chips, 1)}</td>
                  <td className="num py-1">{pct(e / prizes, 1)}</td>
                  <td className="num py-1">{e.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={ids.hero} className="mb-1 block text-sm font-medium">
                {t('widget.icm.caller')}
              </label>
              <select id={ids.hero} className="field" value={hero} onChange={(e) => setHero(Number(e.target.value))}>
                {players.map((p, i) => (
                  <option key={i} value={i}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor={ids.villain} className="mb-1 block text-sm font-medium">
                {t('widget.icm.shover')}
              </label>
              <select id={ids.villain} className="field" value={villain} onChange={(e) => setVillain(Number(e.target.value))}>
                {players.map((p, i) => (
                  <option key={i} value={i}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {res.bubble && (
            <p className="text-sm" data-testid="icm-bubble">
              {t('widget.icm.bubble', { caller: players[hero]!, factor: res.bubble.factor.toFixed(2), needed: pct(res.bubble.needed, 1), win: res.bubble.win.toFixed(2), lose: res.bubble.lose.toFixed(2), now: res.bubble.now.toFixed(2) })}
            </p>
          )}
          <p className="text-xs text-ink-muted">{t('widget.icm.note')}</p>
        </>
      )}
    </div>
  );
}

const HANDS = [10_000, 30_000, 100_000, 300_000, 1_000_000];

/** Results over a sample of hands: the expected range, the chance of being behind, risk of ruin, and simulated paths. */
export function VarianceWidget({ config }: { config: Config }) {
  const [winrate, setWinrate] = useState(n(config, 'winrate', 5));
  const [sd, setSd] = useState(n(config, 'sd', 100));
  const [handsIdx, setHandsIdx] = useState(Math.max(0, HANDS.indexOf(n(config, 'hands', 100_000))));
  const [bankroll, setBankroll] = useState(n(config, 'bankroll', 2000));
  const hands = HANDS[handsIdx]!;
  const v = varianceStats({ winrate, sd, hands, bankroll });
  const paths = simulate({ winrate, sd, hands }, 20, 100, 20251025);
  const lo = Math.min(...paths.flat(), 0);
  const hi = Math.max(...paths.flat(), 0);
  const W = 600;
  const H = 200;
  const x = (i: number, len: number) => (i / (len - 1)) * W;
  const y = (val: number) => H - ((val - lo) / (hi - lo || 1)) * H;
  const worst = Math.max(...paths.map(maxDrawdown));
  const behindAtEnd = paths.filter((p) => p.at(-1)! < 0).length;
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label={t('widget.variance.winrate')} value={winrate} min={-5} max={20} step={0.5} onChange={setWinrate} unit="bb/100" />
        <Slider label={t('widget.variance.sd')} value={sd} min={40} max={150} step={5} onChange={setSd} unit="bb/100" />
        <Slider label={t('widget.variance.hands')} value={handsIdx} min={0} max={HANDS.length - 1} step={1} onChange={setHandsIdx} unit={hands.toLocaleString('en-US')} />
        <Slider label={t('widget.variance.bankroll')} value={bankroll} min={500} max={10000} step={500} onChange={setBankroll} unit="bb" />
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="variance-result">
        <dt>{t('widget.variance.expected')}</dt>
        <dd className="num">{Math.round(v.mean).toLocaleString('en-US')} bb</dd>
        <dt>{t('widget.variance.range')}</dt>
        <dd className="num">
          {Math.round(v.low).toLocaleString('en-US')} … {Math.round(v.high).toLocaleString('en-US')} bb
        </dd>
        <dt>{t('widget.variance.behind')}</dt>
        <dd className="num">{pct(v.behind, 1)}</dd>
        <dt>{t('widget.variance.ruin', { bankroll })}</dt>
        <dd className="num">{v.ruin === null ? '–' : pct(v.ruin, 1)}</dd>
      </dl>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full" role="img" aria-label={t('widget.variance.chart', { n: paths.length, behind: behindAtEnd })}>
        <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.4} strokeDasharray="4 4" />
        {paths.map((p, k) => (
          <polyline key={k} fill="none" stroke="#56B4E9" strokeOpacity={0.6} strokeWidth={1.2} points={p.map((val, i) => `${x(i, p.length)},${y(val)}`).join(' ')} />
        ))}
        <line x1={0} x2={W} y1={y(0)} y2={y(v.mean)} stroke="#E69F00" strokeWidth={2} />
      </svg>
      <p className="text-sm">{t('widget.variance.sim', { n: paths.length, behind: behindAtEnd, worst: Math.round(worst).toLocaleString('en-US') })}</p>
      <p className="text-xs text-ink-muted">{t('widget.variance.note')}</p>
    </div>
  );
}
