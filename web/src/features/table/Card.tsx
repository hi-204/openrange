// Playing cards as SVG (our own design): two- or four-colour deck, three backs, any size.

import { useSettings } from '../../lib/settings/useSettings';
import { cardName } from '../../lib/poker/Cards';

const SUIT_GLYPH: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const FOUR: Record<string, string> = { s: '#1d1b18', h: '#c0392b', d: '#2462b8', c: '#2b7a3d' };
const TWO: Record<string, string> = { s: '#1d1b18', h: '#c0392b', d: '#c0392b', c: '#1d1b18' };

const SIZES = { xs: 28, sm: 38, md: 52, lg: 68 } as const;
export type CardSize = keyof typeof SIZES;

function Back({ style, w, h }: { style: 'classic' | 'lattice' | 'plain'; w: number; h: number }) {
  const id = `back-${style}`;
  return (
    <>
      <defs>
        <pattern id={`${id}-p`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform={style === 'classic' ? 'rotate(45)' : undefined}>
          {style === 'classic' && <rect width="3" height="6" fill="rgb(255 255 255 / 0.18)" />}
          {style === 'lattice' && <path d="M0 0L6 6M6 0L0 6" stroke="rgb(255 255 255 / 0.22)" strokeWidth="1" />}
        </pattern>
      </defs>
      <rect x="1" y="1" width={w - 2} height={h - 2} rx={w * 0.1} fill={style === 'plain' ? '#3d3a6b' : '#5a2735'} />
      {style !== 'plain' && <rect x="4" y="4" width={w - 8} height={h - 8} rx={w * 0.07} fill={`url(#${id}-p)`} stroke="rgb(255 255 255 / 0.35)" strokeWidth="1" />}
      {style === 'plain' && <rect x="5" y="5" width={w - 10} height={h - 10} rx={w * 0.06} fill="none" stroke="rgb(255 255 255 / 0.3)" />}
    </>
  );
}

/** One card. `card` is like "Ah"; null/undefined with `faceDown` draws the back. */
export function PlayingCard({ card, faceDown = false, size = 'md', className = '' }: { card?: string | null; faceDown?: boolean; size?: CardSize; className?: string }) {
  const { deck, cardBack } = useSettings((s) => s.settings.display);
  const w = SIZES[size];
  const h = Math.round(w * 1.4);
  const down = faceDown || !card;
  const rank = card ? (card[0] === 'T' ? '10' : card[0]!.toUpperCase()) : '';
  const suit = card ? card[1]!.toLowerCase() : '';
  const color = (deck === 'four' ? FOUR : TWO)[suit] ?? '#1d1b18';
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      role="img"
      aria-label={down ? 'face-down card' : cardName(card!)}
      className={`card-deal drop-shadow-sm ${className}`}
    >
      {down ? (
        <Back style={cardBack} w={w} h={h} />
      ) : (
        <>
          <rect x="0.5" y="0.5" width={w - 1} height={h - 1} rx={w * 0.1} fill="#fbfaf7" stroke="#cfc8bb" />
          <text x={w * 0.12} y={h * 0.27} fontSize={w * 0.34} fontWeight="700" fill={color} fontFamily="Inter Variable, system-ui, sans-serif">
            {rank}
          </text>
          <text x={w * 0.12} y={h * 0.48} fontSize={w * 0.28} fill={color}>
            {SUIT_GLYPH[suit]}
          </text>
          <text x={w * 0.62} y={h * 0.86} fontSize={w * 0.52} fill={color} textAnchor="middle">
            {SUIT_GLYPH[suit]}
          </text>
        </>
      )}
    </svg>
  );
}

export function CardRow({ cards, size = 'md', faceDown = false, label }: { cards: (string | null)[]; size?: CardSize; faceDown?: boolean; label?: string }) {
  return (
    <span className="inline-flex gap-1" aria-label={label}>
      {cards.map((c, i) => (
        <PlayingCard key={`${c ?? 'x'}-${i}`} card={c} faceDown={faceDown} size={size} />
      ))}
    </span>
  );
}
