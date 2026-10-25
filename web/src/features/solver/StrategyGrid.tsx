import { cellCombos, cellName, cellOf } from '../../lib/poker/hands';
import { pct } from '../../lib/format';

export type GridProps = {
  hands: string[];
  /** Range weight of each hand at this node. */
  reach: number[];
  /** [action][hand] frequencies. */
  strategy: number[];
  actions: string[];
  colors: string[];
  selected: number | null;
  onSelect: (cell: number) => void;
};

type CellData = { weight: number; freq: number[] };

/** Range-weighted action frequencies per grid cell. */
export function aggregate(hands: string[], reach: number[], strategy: number[], nActions: number): CellData[] {
  const n = hands.length;
  const cells: CellData[] = Array.from({ length: 169 }, () => ({ weight: 0, freq: new Array(nActions).fill(0) }));
  hands.forEach((h, i) => {
    const w = reach[i]!;
    if (w <= 0) return;
    const c = cells[cellOf(h).index]!;
    c.weight += w;
    for (let a = 0; a < nActions; a++) c.freq[a] = c.freq[a]! + w * strategy[a * n + i]!;
  });
  for (const c of cells) if (c.weight > 0) c.freq = c.freq.map((x) => x / c.weight);
  return cells;
}

export function StrategyGrid({ hands, reach, strategy, actions, colors, selected, onSelect }: GridProps) {
  const cells = aggregate(hands, reach, strategy, actions.length);
  return (
    <div className="grid grid-cols-13 gap-px rounded border border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700" role="grid" aria-label="Strategy by starting hand">
      {Array.from({ length: 13 }, (_, row) => (
        // Rows for assistive tech; `contents` keeps the 13-column CSS grid.
        <div key={row} role="row" className="contents">
          {cells.slice(row * 13, row * 13 + 13).map((c, j) => {
        const i = row * 13 + j;
        const name = cellName(i);
        const share = Math.min(1, c.weight / cellCombos(i));
        const label =
          c.weight > 0
            ? `${name}: ${actions.map((a, k) => `${a} ${pct(c.freq[k]!, 0)}`).join(', ')}`
            : `${name}: not in range`;
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={label}
            aria-selected={selected === i}
            title={label}
            onClick={() => onSelect(i)}
            className={`relative aspect-square overflow-hidden bg-surface text-[0.6rem] leading-none sm:text-xs ${selected === i ? 'z-10 outline-[3px] outline-offset-[-1px] outline-accent' : ''}`}
          >
            {c.weight > 0 && (
              // Bar height shows how much of the hand is still in the range at this node.
              <span className="absolute inset-x-0 bottom-0 flex" style={{ height: `${Math.max(share, 0.08) * 100}%` }}>
                {c.freq.map((f, k) => (
                  <span key={k} style={{ width: `${f * 100}%`, background: colors[k] }} />
                ))}
              </span>
            )}
            <span className={`relative rounded-sm px-px font-mono font-semibold ${c.weight > 0 ? 'bg-white/90 text-[#1d1b18]' : 'text-ink-muted'}`}>{name}</span>
          </button>
        );
          })}
        </div>
      ))}
    </div>
  );
}
