import { useId, useState } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { CancelledError, solverClient } from '../../lib/wasm/client';
import type { PushFoldResult } from '../../lib/wasm/protocol';
import { ClassGrid } from '../charts/ClassGrid';
import { actionColors } from '../solver/colors';

type Form = { stacks: string; pusher: string; caller: string; ante: string; payouts: string };

// Example inputs: a 3-handed bubble (3 players, 2 paid). Edit freely.
const EXAMPLE: Form = { stacks: '12, 20, 8', pusher: '2', caller: '3', ante: '0', payouts: '65, 35' };

const nums = (s: string) =>
  s
    .split(/[,\s]+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map(Number);

function Field({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input id={id} className="field" value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} autoComplete="off" />
      {hint && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>}
    </div>
  );
}

export function PushFoldPage() {
  const [form, setForm] = useState<Form>(EXAMPLE);
  const [result, setResult] = useState<PushFoldResult | null>(null);
  const [status, setStatus] = useState<'idle' | 'running' | { error: string }>('idle');
  const [cell, setCell] = useState<number | null>(null);
  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function solve() {
    setStatus('running');
    setResult(null);
    try {
      const stacks = nums(form.stacks);
      const r = await solverClient().call('pushFold', {
        spot: {
          stacks,
          // Seats are entered 1-based in the form.
          pusher: Number(form.pusher) - 1,
          caller: Number(form.caller) - 1,
          ante: Number(form.ante) || 0,
          payouts: nums(form.payouts),
        },
      });
      setResult(r);
      setStatus('idle');
    } catch (e) {
      setStatus(e instanceof CancelledError ? 'idle' : { error: (e as Error).message });
    }
  }

  const unit = result?.units === 'prize' ? t('pushfold.unitPrize') : 'bb';
  const sides = result ? ([['pusher', t('pushfold.pusherChart')], ['caller', t('pushfold.callerChart')]] as const) : [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('pushfold.heading')}</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('pushfold.intro')}</p>
      </div>
      <form
        className="card grid gap-4 sm:grid-cols-3"
        onSubmit={(e) => {
          e.preventDefault();
          void solve();
        }}
      >
        <Field label={t('pushfold.stacks')} value={form.stacks} onChange={set('stacks')} hint={t('pushfold.stacksHint')} />
        <Field label={t('pushfold.pusher')} value={form.pusher} onChange={set('pusher')} />
        <Field label={t('pushfold.caller')} value={form.caller} onChange={set('caller')} />
        <Field label={t('pushfold.ante')} value={form.ante} onChange={set('ante')} />
        <Field label={t('pushfold.payouts')} value={form.payouts} onChange={set('payouts')} hint={t('pushfold.payoutsHint')} />
        <div className="flex items-end">
          <button type="submit" className="btn-primary" disabled={status === 'running'}>
            {status === 'running' ? t('pushfold.running') : t('pushfold.solve')}
          </button>
        </div>
      </form>
      <div aria-live="polite" data-testid="pushfold-result">
        {typeof status === 'object' && <p className="text-amber-700 dark:text-amber-400">{t('pushfold.error', { message: status.error })}</p>}
        {result && (
          <section className="space-y-4">
            <p className="text-sm">
              <span className="mr-2 inline-block rounded-full border border-sky-700 px-2 py-0.5 text-xs text-sky-800 dark:border-sky-400 dark:text-sky-300">
                {t('pushfold.badge', { iterations: result.iterations })}
              </span>
              {t('pushfold.exploitability', { ex: result.exploitability.toExponential(1), unit })}
            </p>
            <div className="grid gap-6 lg:grid-cols-2">
              {sides.map(([side, title]) => {
                const s = result[side];
                const colors = actionColors(s.actions, [false, true]);
                const share = s.strategy.reduce((acc, f, i) => acc + f[1]! * (result.classes[i]!.length === 2 ? 6 : result.classes[i]![2] === 's' ? 4 : 12), 0) / 1326;
                return (
                  <div key={side} className="space-y-2">
                    <h3 className="text-sm font-semibold">
                      {title} <span className="font-mono font-normal">{pct(share, 1)}</span>
                    </h3>
                    <ClassGrid classes={result.classes} strategy={s.strategy} actions={s.actions} colors={colors} selected={cell} onSelect={setCell} label={title} />
                    {cell !== null && (
                      <p className="text-sm font-mono" data-testid={`pushfold-${side}-detail`}>
                        {result.classes[cell]}: {s.actions.map((a, k) => `${a} ${pct(s.strategy[cell]![k]!, 0)} (EV ${s.ev[cell]?.[k] === null ? '—' : s.ev[cell]![k]!.toFixed(3)} ${unit})`).join(' · ')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">{t('pushfold.note')}</p>
          </section>
        )}
      </div>
    </div>
  );
}
