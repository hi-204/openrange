import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { cellName, cellOf } from '../../lib/poker/hands';
import type { SolverInfo, SolverNode } from '../../lib/wasm/protocol';
import { actionColors } from './colors';
import { StrategyGrid } from './StrategyGrid';

export type Step = { index: number; label: string };

type Props = {
  info: SolverInfo;
  node: SolverNode;
  path: Step[];
  setPath: (p: Step[]) => void;
  cell: number | null;
  setCell: (c: number | null) => void;
};

export function NodeBrowser({ info, node, path, setPath, cell, setCell }: Props) {
  const go = (step: Step) => {
    setCell(null);
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
                {node.mirrors[k]!.length > 0 && <span className="text-xs text-slate-500"> +{node.mirrors[k]!.length}</span>}
              </button>
            </li>
          ))}
        </ul>
        {node.mirrors.some((m) => m.length > 0) && <p className="text-xs text-slate-600 dark:text-slate-400">{t('solver.isoNote')}</p>}
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
      <div className="grid gap-4 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <StrategyGrid hands={hands} reach={reach} strategy={node.strategy} actions={node.actions} colors={colors} selected={cell} onSelect={setCell} />
        <div className="text-sm">
          {cell === null ? (
            <p className="text-slate-600 dark:text-slate-400">{t('solver.pickCell')}</p>
          ) : combos.length === 0 ? (
            <p>{t('solver.notInRange', { hand: cellName(cell) })}</p>
          ) : (
            <table className="w-full text-left">
              <caption className="mb-1 text-left font-medium">{t('solver.combosOf', { hand: cellName(cell) })}</caption>
              <thead>
                <tr>
                  <th className="py-1">{t('solver.combo')}</th>
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
                    <td className="py-1 font-mono">{pct(reach[i]!, 0)}</td>
                    {node.actions.map((_, a) => {
                      const ev = node.evBb[a * n + i];
                      return (
                        <td key={a} className="py-1 font-mono">
                          {pct(node.strategy[a * n + i]!, 0)}
                          <span className="block text-xs text-slate-500">{ev === null || ev === undefined ? '—' : `${ev.toFixed(2)} bb`}</span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">{t('solver.evNote')}</p>
        </div>
      </div>
    </section>
  );
}
