import { useId, useState } from 'react';
import { pct } from '../../../lib/format';
import { t } from '../../../lib/i18n';

type Config = Record<string, unknown>;
const n = (c: Config, k: string, d: number) => (typeof c[k] === 'number' ? (c[k] as number) : d);

export function Slider({ label, value, min, max, step, onChange, unit }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 flex justify-between text-sm font-medium">
        <span>{label}</span>
        <span className="font-mono">
          {value} {unit}
        </span>
      </label>
      <input id={id} type="range" className="w-full" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Price of a call: you call B to win the pot P plus the bet: B ÷ (P + 2B). */
export function PotOdds({ config }: { config: Config }) {
  const [pot, setPot] = useState(n(config, 'pot', 10));
  const [bet, setBet] = useState(n(config, 'bet', 5));
  const [eq, setEq] = useState(Math.round(n(config, 'equity', 0.3) * 100));
  const final = pot + 2 * bet;
  const required = bet / final;
  return (
    <div className="space-y-3">
      <Slider label={t('widget.pot')} value={pot} min={1} max={100} step={0.5} onChange={setPot} unit="bb" />
      <Slider label={t('widget.bet')} value={bet} min={0.5} max={200} step={0.5} onChange={setBet} unit="bb" />
      <Slider label={t('widget.yourEquity')} value={eq} min={0} max={100} step={1} onChange={setEq} unit="%" />
      <div className="space-y-1 text-sm" data-testid="potodds-result">
        <p>{t('widget.potodds.steps', { bet, pot, final: final.toFixed(1) })}</p>
        <p className="font-medium">{t('widget.potodds.required', { required: pct(required, 1) })}</p>
        <p>{eq / 100 >= required ? t('widget.potodds.enough', { eq: `${eq}%` }) : t('widget.potodds.short', { eq: `${eq}%` })}</p>
        <p className="text-xs text-ink-muted">{t('widget.potodds.caveat')}</p>
      </div>
    </div>
  );
}

type Outcome = { label: string; p: number; value: number };

/** EV = Σ pᵢ · vᵢ over the outcomes, with the working shown. */
export function EvCalculator({ config }: { config: Config }) {
  const init = (Array.isArray(config.outcomes) ? config.outcomes : []) as Outcome[];
  const [rows, setRows] = useState<Outcome[]>(init.length ? init : [{ label: 'win', p: 0.5, value: 10 }, { label: 'lose', p: 0.5, value: -5 }]);
  const total = rows.reduce((s, r) => s + r.p, 0);
  const ev = rows.reduce((s, r) => s + r.p * r.value, 0);
  const set = (i: number, k: 'p' | 'value', v: number) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="space-y-3">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="py-1">{t('widget.ev.outcome')}</th>
            <th className="py-1">{t('widget.ev.probability')}</th>
            <th className="py-1">{t('widget.ev.value')}</th>
            <th className="py-1">{t('widget.ev.product')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1">{r.label}</td>
              <td className="py-1">
                <input aria-label={t('widget.ev.probabilityOf', { label: r.label })} className="field w-24" type="number" step="0.01" min="0" max="1" value={r.p} onChange={(e) => set(i, 'p', Number(e.target.value))} />
              </td>
              <td className="py-1">
                <input aria-label={t('widget.ev.valueOf', { label: r.label })} className="field w-24" type="number" step="0.5" value={r.value} onChange={(e) => set(i, 'value', Number(e.target.value))} />
              </td>
              <td className="py-1 font-mono">{(r.p * r.value).toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="font-medium" data-testid="ev-result">
        {t('widget.ev.total', { ev: ev.toFixed(2) })}
      </p>
      {Math.abs(total - 1) > 1e-9 && <p className="text-sm text-amber-700 dark:text-amber-400">{t('widget.ev.sum', { total: total.toFixed(2) })}</p>}
    </div>
  );
}

/** Stack-to-pot ratio: effective stack behind ÷ pot. */
export function SprCalculator({ config }: { config: Config }) {
  const [stack, setStack] = useState(n(config, 'stack', 90));
  const [pot, setPot] = useState(n(config, 'pot', 10));
  return (
    <div className="space-y-3">
      <Slider label={t('widget.stackBehind')} value={stack} min={1} max={300} step={1} onChange={setStack} unit="bb" />
      <Slider label={t('widget.pot')} value={pot} min={1} max={150} step={0.5} onChange={setPot} unit="bb" />
      <p className="font-medium" data-testid="spr-result">
        {t('widget.spr.result', { spr: (stack / pot).toFixed(1), stack, pot })}
      </p>
      <p className="text-sm">{t('widget.spr.potBets', { n: Math.max(0, Math.log(1 + (2 * stack) / pot) / Math.log(3)).toFixed(1) })}</p>
    </div>
  );
}

/** For a bet B into P: the caller's price, the defender's MDF and the bettor's river bluff share. */
export function SizingExplorer({ config }: { config: Config }) {
  const [pot, setPot] = useState(n(config, 'pot', 10));
  const [bet, setBet] = useState(n(config, 'bet', 7.5));
  const price = bet / (pot + 2 * bet);
  const mdf = pot / (pot + bet);
  return (
    <div className="space-y-3">
      <Slider label={t('widget.pot')} value={pot} min={1} max={100} step={0.5} onChange={setPot} unit="bb" />
      <Slider label={t('widget.bet')} value={bet} min={0.5} max={200} step={0.5} onChange={setBet} unit="bb" />
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm" data-testid="sizing-result">
        <dt>{t('widget.sizing.fraction')}</dt>
        <dd className="font-mono">{pct(bet / pot, 0)}</dd>
        <dt>{t('widget.sizing.price')}</dt>
        <dd className="font-mono">{pct(price, 1)}</dd>
        <dt>{t('widget.sizing.mdf')}</dt>
        <dd className="font-mono">{pct(mdf, 1)}</dd>
        <dt>{t('widget.sizing.alpha')}</dt>
        <dd className="font-mono">{pct(1 - mdf, 1)}</dd>
        <dt>{t('widget.sizing.bluffs')}</dt>
        <dd className="font-mono">{pct(price, 1)}</dd>
      </dl>
      <p className="text-xs text-ink-muted">{t('widget.sizing.caveat')}</p>
    </div>
  );
}
