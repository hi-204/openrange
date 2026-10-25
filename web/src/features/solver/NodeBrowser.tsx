import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { cellName, cellOf } from '../../lib/poker/hands';
import type { SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { useState } from 'react';
import { actionColors } from './colors';
import { ExplainHand } from './ExplainHand';
import { LockPanel } from './LockPanel';
import { nodeCsv } from './workbench';
import { RunoutTable } from './WorkbenchParts';
import { StrategyGrid } from './StrategyGrid';

export type Step = { index: number; label: string };

type Props = {
  info: SolverInfo;
  node: SolverNode;
  path: Step[];
  setPath: (p: Step[]) => void;
  cell: number | null;
  setCell: (c: number | null) => void;
  /** Solve accuracy and starting reach, for "Explain this hand". */
  exploitabilityPct?: number;
  rootReach?: number[][];
  /** Node-locking (workbench only). */
  locking?: { busy: boolean; onLock: (strategy: number[], label: string) => void; onUnlock: () => void };
  /** Fetch another node (for the runout explorer). */
  explore?: (path: number[]) => Promise<SolverNode>;
};

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export function NodeBrowser({ info, node, path, setPath, cell, setCell, exploitabilityPct, rootReach, locking, explore }: Props) {
  const [explain, setExplain] = useState<number | null>(null);
  const [view, setView] = useState<'strategy' | 'opponent'>('strategy');
  const go = (step: Step) => {
    setCell(null);
    setExplain(null);
    setPath([...path, step]);
  };
  const crumbs = (
    <nav aria-label={t('solver.path')} className="flex flex-wrap items-center gap-1 text-sm">
      <button type="button" className="underline" onClick={() => setPath([])}>
        {t('solver.root')}
      </button>
      {path.map((p, i) => (
        <span key={i}>
          {' › '}
          <button type="button" className="underline" onClick={() => setPath(path.slice(0, i + 1))}>
            {p.label}
          </button>
        </span>
      ))}
    </nav>
  );

  if (node.kind === 'chance') {
    return (
      <section className="card space-y-3" data-testid="node-browser">
        {crumbs}
        <p className="text-sm">{t('solver.chanceHeader', { street: node.street.toLowerCase(), board: node.board.join(' ') })}</p>
        <ul className="flex flex-wrap gap-1" aria-label={t('solver.cards')}>
          {node.cards.map((c, k) => (
            <li key={c}>
              <button
                type="button"
                className="btn-secondary px-2 py-1 font-mono"
                title={node.mirrors[k]!.length ? t('solver.alsoStandsFor', { cards: node.mirrors[k]!.join(' ') }) : undefined}
                onClick={() => go({ index: k, label: c })}
              >
                {c}
                {node.mirrors[k]!.length > 0 && <span className="text-xs text-ink-muted"> +{node.mirrors[k]!.length}</span>}
              </button>
            </li>
          ))}
        </ul>
        {node.mirrors.some((m) => m.length > 0) && <p className="text-xs text-ink-muted">{t('solver.isoNote')}</p>}
        {explore && (
          <details>
            <summary className="cursor-pointer text-sm font-medium">{t('runouts.summary')}</summary>
            <div className="mt-2">
              <RunoutTable info={info} node={node} path={path.map((p) => p.index)} explore={explore} onPick={(k) => go({ index: k, label: node.cards[k]! })} />
            </div>
          </details>
        )}
      </section>
    );
  }

  if (node.kind !== 'action') {
    return (
      <section className="card space-y-2" data-testid="node-browser">
        {crumbs}
        <p>{node.kind === 'fold' ? t('solver.foldEnd', { who: node.folder === 0 ? 'OOP' : 'IP' }) : t('solver.showdownEnd')}</p>
      </section>
    );
  }

  const hands = info.hands[node.player];
  const n = hands.length;
  const reach = node.reach[node.player];
  const colors = actionColors(node.actions, node.aggressive);
  const totalReach = reach.reduce((s, w) => s + w, 0);
  const overall = node.actions.map((_, a) => hands.reduce((s, _h, i) => s + reach[i]! * node.strategy[a * n + i]!, 0) / totalReach);
  const combos = cell === null ? [] : hands.map((h, i) => ({ h, i })).filter(({ h, i }) => cellOf(h).index === cell && reach[i]! > 0);
  const who = node.player === 0 ? 'OOP' : 'IP';

  return (
    <section className="card space-y-4" data-testid="node-browser">
      {crumbs}
      <p className="text-sm">
        {t('solver.nodeHeader', {
          who: node.player === 0 ? t('solver.oop') : t('solver.ip'),
          pot: node.pot.toFixed(2),
          board: node.board.join(' '),
        })}
        {node.locked && (
          <span className="ml-2 rounded-sm bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent" data-testid="locked-badge">
            {t('lock.badge')}
          </span>
        )}
      </p>
      <ul className="flex flex-wrap gap-2" aria-label={t('solver.actions')}>
        {node.actions.map((label, a) => (
          <li key={a}>
            <button type="button" className="btn-secondary flex items-center gap-2" onClick={() => go({ index: a, label: `${who} ${label}` })}>
              <span aria-hidden className="inline-block h-3 w-3 rounded-sm" style={{ background: colors[a] }} />
              {label} <span className="font-mono">{pct(overall[a]!, 1)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('solver.view')}>
        <button type="button" className="btn-quiet !min-h-9 text-sm" aria-pressed={view === 'strategy'} onClick={() => setView('strategy')}>
          {t('solver.viewStrategy', { who })}
        </button>
        <button type="button" className="btn-quiet !min-h-9 text-sm" aria-pressed={view === 'opponent'} onClick={() => setView('opponent')} data-testid="view-opponent">
          {t('solver.viewOpponent', { who: who === 'OOP' ? 'IP' : 'OOP' })}
        </button>
        <button type="button" className="btn-quiet !min-h-9 text-sm" onClick={() => download(`openrange-node-${path.map((p) => p.index).join('-') || 'root'}.csv`, nodeCsv(node, hands))} data-testid="csv">
          {t('solver.csv')}
        </button>
      </div>
      {view === 'opponent' && (
        <div className="max-w-md space-y-1" data-testid="opponent-range">
          <p className="text-sm">{t('solver.opponentRange', { who: who === 'OOP' ? 'IP' : 'OOP', combos: node.reach[1 - node.player]!.reduce((s, w) => s + w, 0).toFixed(1) })}</p>
          <StrategyGrid hands={info.hands[1 - node.player]!} reach={node.reach[1 - node.player]!} strategy={info.hands[1 - node.player]!.map(() => 1)} actions={[t('widget.grid.in')]} colors={['#56B4E9']} selected={null} onSelect={() => undefined} />
        </div>
      )}
      {locking && <LockPanel key={`${path.map((p) => p.index).join('.')}|${node.player}|${node.actions.join(',')}|${node.locked ? 1 : 0}`} node={node} hands={n} busy={locking.busy} onLock={locking.onLock} onUnlock={locking.onUnlock} />}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <StrategyGrid hands={hands} reach={reach} strategy={node.strategy} actions={node.actions} colors={colors} selected={cell} onSelect={setCell} />
        <div className="text-sm">
          {cell === null ? (
            <p className="text-ink-muted">{t('solver.pickCell')}</p>
          ) : combos.length === 0 ? (
            <p>{t('solver.notInRange', { hand: cellName(cell) })}</p>
          ) : (
            <table className="w-full text-left">
              <caption className="mb-1 text-left font-medium">{t('solver.combosOf', { hand: cellName(cell) })}</caption>
              <thead>
                <tr>
                  <th className="py-1">{t('solver.combo')}</th>
                  {exploitabilityPct !== undefined && <th className="py-1"><span className="sr-only">{t('solver.explain')}</span></th>}
                  <th className="py-1">{t('solver.weight')}</th>
                  {node.actions.map((a, k) => (
                    <th key={k} className="py-1">
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {combos.map(({ h, i }) => (
                  <tr key={h} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-1 font-mono">{h}</td>
                    {exploitabilityPct !== undefined && (
                      <td className="py-1">
                        <button type="button" className="btn-quiet !min-h-9 !px-2 text-xs" aria-pressed={explain === i} onClick={() => setExplain(explain === i ? null : i)} data-testid="explain-button">
                          {t('solver.explain')}
                        </button>
                      </td>
                    )}
                    <td className="py-1 font-mono">{pct(reach[i]!, 0)}</td>
                    {node.actions.map((_, a) => {
                      const ev = node.evBb[a * n + i];
                      return (
                        <td key={a} className="py-1 font-mono">
                          {pct(node.strategy[a * n + i]!, 0)}
                          <span className="block text-xs text-ink-muted">{ev === null || ev === undefined ? '—' : `${ev.toFixed(2)} bb`}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {explain !== null && exploitabilityPct !== undefined && cell !== null && combos.some((c) => c.i === explain) && (
            <div className="mt-4">
              <ExplainHand info={info} node={node} hand={explain} exploitabilityPct={exploitabilityPct} rootReach={rootReach} />
            </div>
          )}
          <p className="mt-3 text-xs text-ink-muted">{t('solver.evNote')}</p>
        </div>
      </div>
    </section>
  );
}
