// Node-locking controls for one decision node (D-076): pick a villain tendency, preview the
// frequencies it gives, then lock and re-solve.

import { useId, useState } from 'react';
import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import type { SolverNode } from '../../lib/wasm/protocol';
import { applyPreset, overall, presetsFor, type Preset } from './locks';

type ActionNode = SolverNode & { kind: 'action' };
const AMOUNT: Preset[] = ['foldMore', 'callMore', 'betMore', 'checkMore'];

export function LockPanel({ node, hands, busy, onLock, onUnlock }: { node: ActionNode; hands: number; busy: boolean; onLock: (strategy: number[], label: string) => void; onUnlock: () => void }) {
  const presets = presetsFor(node);
  const [preset, setPreset] = useState<Preset>(presets[1] ?? 'asSolved');
  const [amount, setAmount] = useState(30);
  const [action, setAction] = useState(0);
  const ids = { preset: useId(), amount: useId(), action: useId() };
  const strategy = applyPreset(node, hands, preset, amount / 100, action);
  const reach = node.reach[node.player]!;
  const before = overall(node.strategy, reach, node.actions.length);
  const after = overall(strategy, reach, node.actions.length);
  const label = t(`lock.preset.${preset}` as MessageKey, { amount, action: node.actions[action] ?? '' });
  return (
    <details className="rounded-control border border-slate-200 p-3 dark:border-slate-700" data-testid="lock-panel">
      <summary className="cursor-pointer text-sm font-medium">{node.locked ? t('lock.lockedSummary') : t('lock.summary')}</summary>
      <div className="mt-3 space-y-3 text-sm">
        <p className="text-ink-muted">{t('lock.intro')}</p>
        {node.locked && (
          <button type="button" className="btn-secondary" disabled={busy} onClick={onUnlock}>
            {t('lock.unlock')}
          </button>
        )}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label htmlFor={ids.preset} className="mb-1 block font-medium">
              {t('lock.tendency')}
            </label>
            <select id={ids.preset} className="field" value={preset} onChange={(e) => setPreset(e.target.value as Preset)}>
              {presets.map((p) => (
                <option key={p} value={p}>
                  {t(`lock.option.${p}` as MessageKey)}
                </option>
              ))}
            </select>
          </div>
          {AMOUNT.includes(preset) && (
            <div>
              <label htmlFor={ids.amount} className="mb-1 flex justify-between font-medium">
                <span>{t('lock.amount')}</span>
                <span className="num">{amount}%</span>
              </label>
              <input id={ids.amount} type="range" min={5} max={100} step={5} value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full" />
            </div>
          )}
          {preset === 'pure' && (
            <div>
              <label htmlFor={ids.action} className="mb-1 block font-medium">
                {t('lock.action')}
              </label>
              <select id={ids.action} className="field" value={action} onChange={(e) => setAction(Number(e.target.value))}>
                {node.actions.map((a, k) => (
                  <option key={k} value={k}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <table className="w-full text-left" data-testid="lock-preview">
          <thead>
            <tr>
              <th className="py-1 font-medium">{t('lock.frequency')}</th>
              {node.actions.map((a) => (
                <th key={a} className="py-1 font-medium">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className="py-1 font-normal">
                {t('lock.solved')}
              </th>
              {before.map((f, k) => (
                <td key={k} className="num py-1">
                  {pct(f, 1)}
                </td>
              ))}
            </tr>
            <tr className="border-t border-slate-100 dark:border-slate-800">
              <th scope="row" className="py-1 font-normal">
                {t('lock.lockedRow')}
              </th>
              {after.map((f, k) => (
                <td key={k} className="num py-1">
                  {pct(f, 1)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => onLock(strategy, label)} data-testid="lock-apply">
          {t('lock.apply')}
        </button>
      </div>
    </details>
  );
}
