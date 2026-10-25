import { pct } from '../../lib/format';
import { cellCombos } from '../../lib/poker/hands';

/** Reach below this: the hand (almost) never gets to this decision; its strategy is noise. */
export const UNREACHED = 0.005;

type Props = {
  classes: string[];
  /** Per class: probability of each action. */
  strategy: number[][];
  actions: string[];
  colors: string[];
  reach?: number[];
  selected: number | null;
  onSelect: (cell: number) => void;
  label: string;
};

/** 13×13 chart: each cell split by action frequency; unreached hands greyed out. */
export function ClassGrid({ classes, strategy, actions, colors, reach, selected, onSelect, label }: Props) {
  return (
    <div className="grid grid-cols-13 gap-px rounded border border-slate-300 bg-slate-300 dark:border-slate-700 dark:bg-slate-700" role="grid" aria-label={label}>
      {classes.map((name, i) => {
        const unreached = reach !== undefined && reach[i]! < UNREACHED;
        const freq = strategy[i]!;
        const text = unreached ? `${name}: not reached` : `${name}: ${actions.map((a, k) => `${a} ${pct(freq[k]!, 0)}`).join(', ')}`;
        return (
          <button
            key={i}
            type="button"
            role="gridcell"
            aria-label={text}
            aria-selected={selected === i}
            title={text}
            onClick={() => onSelect(i)}
            className={`relative aspect-square overflow-hidden text-[0.6rem] leading-none sm:text-xs ${unreached ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600' : 'bg-white dark:bg-slate-900'} ${selected === i ? 'outline-2 outline-offset-[-2px] outline-slate-900 dark:outline-white' : ''}`}
            data-combos={cellCombos(i)}
          >
            {!unreached && (
              <span className="absolute inset-0 flex">
                {freq.map((f, k) => (
                  <span key={k} style={{ width: `${f * 100}%`, background: colors[k] }} />
                ))}
              </span>
            )}
            <span className="relative font-mono font-semibold [text-shadow:0_0_2px_white] dark:[text-shadow:0_0_2px_black]">{name}</span>
          </button>
        );
      })}
    </div>
  );
}
