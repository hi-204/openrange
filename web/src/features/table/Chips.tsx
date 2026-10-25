// Chip stacks (our own SVG): an amount in bb broken into denominations, drawn as a short stack.

import { useSettings } from '../../lib/settings/useSettings';

/** Denominations in bb, largest first, with face and edge colours. */
const DENOMS: { v: number; face: string; edge: string }[] = [
  { v: 100, face: '#1f1d1b', edge: '#d8d2c6' },
  { v: 25, face: '#2b7a3d', edge: '#e9f3eb' },
  { v: 5, face: '#b23c2a', edge: '#f7e3df' },
  { v: 1, face: '#2462b8', edge: '#e3ecf8' },
  { v: 0.5, face: '#e9e4da', edge: '#7a746a' },
];

export function chipBreakdown(amount: number, maxChips = 8): { v: number; face: string; edge: string }[] {
  const out: (typeof DENOMS)[number][] = [];
  let rest = Math.round(amount * 2) / 2;
  for (const d of DENOMS) {
    while (rest >= d.v - 1e-9 && out.length < maxChips) {
      out.push(d);
      rest -= d.v;
    }
  }
  return out;
}

/** 1 bb shown as this many chips when the display uses chips. */
export const CHIPS_PER_BB = 100;

export function formatAmount(bb: number, units: 'bb' | 'chips'): string {
  if (units === 'chips') return Math.round(bb * CHIPS_PER_BB).toLocaleString('en-US');
  return `${Number.isInteger(bb) ? bb : bb.toFixed(1)} bb`;
}

export function ChipStack({ amount, showLabel = true }: { amount: number; showLabel?: boolean }) {
  const units = useSettings((s) => s.settings.display.units);
  const chips = chipBreakdown(amount);
  const h = 8 + chips.length * 4;
  return (
    <span className="chip-slide inline-flex flex-col items-center gap-0.5" aria-label={formatAmount(amount, units)}>
      <svg width="26" height={h} viewBox={`0 0 26 ${h}`} aria-hidden>
        {chips.map((c, i) => {
          const y = h - 8 - i * 4;
          return (
            <g key={i}>
              <ellipse cx="13" cy={y + 3} rx="11" ry="4" fill={c.face} stroke="rgb(0 0 0 / 0.35)" strokeWidth="0.75" />
              <ellipse cx="13" cy={y + 2} rx="11" ry="4" fill={c.face} />
              <ellipse cx="13" cy={y + 2} rx="7" ry="2.4" fill="none" stroke={c.edge} strokeWidth="1" strokeDasharray="2 2" />
            </g>
          );
        })}
      </svg>
      {showLabel && <span className="num rounded bg-black/45 px-1 text-[0.7rem] font-semibold text-white">{formatAmount(amount, units)}</span>}
    </span>
  );
}
