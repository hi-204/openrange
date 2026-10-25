// Workbench pieces: the runout explorer at chance nodes and the range painter.

import { useEffect, useState } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { cellName } from '../../lib/poker/hands';
import { solverClient } from '../../lib/wasm/client';
import type { SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { ClassGrid } from '../charts/ClassGrid';
import { COMBO_STRINGS } from '../lessons/widgets/cards';
import { classWeights, nodeFrequencies, rangeText } from './workbench';

type Row = { card: string; mirrors: number; player: number | null; actions: string[]; freq: number[] };

/** For each card a chance node can deal: the next decision's overall frequencies. */
export function RunoutTable({ info, node, path, explore, onPick }: { info: SolverInfo; node: SolverNode & { kind: 'chance' }; path: number[]; explore: (path: number[]) => Promise<SolverNode>; onPick: (k: number) => void }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  useEffect(() => {
    let live = true;
    (async () => {
      const out: Row[] = [];
      for (let k = 0; k < node.cards.length; k++) {
        const child = await explore([...path, k]);
        if (!live) return;
        if (child.kind === 'action') out.push({ card: node.cards[k]!, mirrors: node.mirrors[k]!.length, player: child.player, actions: child.actions, freq: nodeFrequencies(child, info.hands[child.player]) });
        else out.push({ card: node.cards[k]!, mirrors: node.mirrors[k]!.length, player: null, actions: [], freq: [] });
      }
      if (live) setRows(out);
    })().catch(() => live && setRows([]));
    return () => {
      live = false;
    };
  }, [node, path, explore, info]);
  if (!rows) return <p className="text-sm" role="status">{t('runouts.loading')}</p>;
  const actions = rows.find((r) => r.actions.length)?.actions ?? [];
  const who = rows.find((r) => r.player !== null)?.player;
  return (
    <div className="space-y-2" data-testid="runouts">
      <p className="text-sm">{t('runouts.intro', { who: who === 0 ? 'OOP' : 'IP' })}</p>
      <div className="max-h-96 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface">
            <tr>
              <th className="py-1 font-medium">{t('runouts.card')}</th>
              {actions.map((a) => (
                <th key={a} className="py-1 font-medium">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, k) => (
              <tr key={r.card} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-1">
                  <button type="button" className="font-mono underline" onClick={() => onPick(k)}>
                    {r.card}
                  </button>
                  {r.mirrors > 0 && <span className="text-xs text-ink-muted"> +{r.mirrors}</span>}
                </td>
                {actions.map((a, i) => (
                  <td key={a} className="num py-1">
                    {r.freq[i] === undefined ? '–' : pct(r.freq[i]!, 0)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Paint a range on the grid: click cells to add or remove whole hands; the text updates. */
export function RangePainter({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const [weights, setWeights] = useState<number[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    solverClient()
      .call('parseRange', { text: value })
      .then((r) => {
        if (!live) return;
        if (r.ok) {
          setWeights(classWeights(r.weights, COMBO_STRINGS));
          setError(null);
        } else setError(r.error);
      })
      .catch((e: Error) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [value]);
  if (error) return <p className="text-sm text-amber-700 dark:text-amber-400">{error}</p>;
  if (!weights) return <p className="text-sm">…</p>;
  const names = Array.from({ length: 169 }, (_, i) => cellName(i));
  return (
    <div className="max-w-md space-y-1" data-testid="range-painter">
      <p className="text-xs text-ink-muted">{t('painter.how')}</p>
      <ClassGrid
        classes={names}
        strategy={weights.map((w) => [1 - w, w])}
        actions={[t('widget.grid.out'), t('widget.grid.in')]}
        colors={['transparent', '#E69F00']}
        selected={null}
        onSelect={(i) => onChange(rangeText(weights.map((w, j) => (j === i ? (w >= 0.5 ? 0 : 1) : w))))}
        label={label}
      />
    </div>
  );
}
