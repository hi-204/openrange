// The poker table (docs/DESIGN.md §5), used by drills, lessons, play, replay and the workbench.
// 2–9 seats on an ellipse (tall rounded shape on phones), hero at the bottom centre.

import { useEffect } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { play } from '../../lib/ui/sound';
import { useSettings } from '../../lib/settings/useSettings';
import { useMediaQuery } from '../../lib/ui/components';
import { CardRow } from './Card';
import { ChipStack, formatAmount } from './Chips';

export type SeatStatus = 'active' | 'folded' | 'allin' | 'empty';

export type Seat = {
  name: string;
  position: string;
  stack: number;
  status: SeatStatus;
  hero?: boolean;
  /** Face-up cards (hero, or anyone at showdown). */
  cards?: string[] | null;
  /** Face-down hole cards for opponents still in the hand (default: active players). */
  hidden?: boolean;
  bet?: number;
  toAct?: boolean;
};

type Props = {
  seats: Seat[];
  pot: number;
  sidePots?: number[];
  board: string[];
  /** Spot summary chip shown above the table, e.g. "6-max · 100 bb · BTN vs BB". */
  summary?: string;
  history?: string[];
  variant?: 'static' | 'interactive';
  /** Seat index with the dealer button (default: the BTN seat, or the SB heads-up). */
  button?: number;
};

const STREET_OF = (n: number) => (n === 0 ? null : n === 3 ? 'flop' : n === 4 ? 'turn' : 'river');

export function PokerTable({ seats, pot, sidePots = [], board, summary, history = [], variant = 'interactive', button }: Props) {
  const units = useSettings((s) => s.settings.display.units);
  const tall = useMediaQuery('(max-width: 639px)');
  const n = Math.max(2, Math.min(9, seats.length));
  const heroIndex = Math.max(0, seats.findIndex((s) => s.hero));
  // Seat geometry in % of the table box. Clockwise from the hero at the bottom.
  const rx = tall ? 40 : 44;
  const ry = tall ? 42 : 38;
  const place = (i: number, scale = 1) => {
    const a = Math.PI / 2 + ((i - heroIndex) * 2 * Math.PI) / n;
    return { left: 50 + rx * scale * Math.cos(a), top: 50 + ry * scale * Math.sin(a) };
  };
  const buttonSeat = button ?? seats.findIndex((s) => s.position === 'BTN' || (n === 2 && s.position === 'SB'));
  const street = STREET_OF(board.length);
  const heroCards = seats[heroIndex]?.cards?.join('') ?? '';
  useEffect(() => {
    if (variant === 'interactive' && heroCards) play('deal');
  }, [variant, heroCards, board.length]);

  return (
    <figure className="space-y-3" data-testid="poker-table" data-variant={variant}>
      {summary && (
        <figcaption className="flex justify-center">
          <span className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-muted shadow-1" data-testid="spot-chip">
            {summary}
          </span>
        </figcaption>
      )}
      {/* Bottom margin: the hero's seat hangs below the rail. */}
      <div className={`relative mx-auto mb-14 w-full ${tall ? 'aspect-[3/4] max-w-sm' : 'aspect-[16/9] max-w-3xl'}`}>
        {/* Rail and felt */}
        <div
          aria-hidden
          className="absolute inset-[6%] rounded-[50%] shadow-3"
          style={{
            background: 'linear-gradient(160deg, color-mix(in srgb, var(--rail) 75%, white), var(--rail))',
            padding: tall ? '4%' : '1.6%',
          }}
        >
          <div
            className="h-full w-full rounded-[50%]"
            style={{
              background:
                'radial-gradient(ellipse at 50% 40%, color-mix(in srgb, var(--felt) 80%, white 8%), var(--felt) 55%, var(--felt-edge)), repeating-radial-gradient(circle at 30% 30%, rgb(255 255 255 / 0.02) 0 1px, transparent 1px 3px)',
              backgroundBlendMode: 'normal, overlay',
              boxShadow: 'inset 0 0 40px rgb(0 0 0 / 0.35)',
            }}
          />
        </div>

        {/* Pot and board */}
        <div className="absolute inset-x-0 top-1/2 flex -translate-y-1/2 flex-col items-center gap-1.5">
          {(pot > 0 || sidePots.length > 0) && (
            <div className="flex items-center gap-2" data-testid="pot">
              <span className="num rounded-full bg-black/45 px-2.5 py-0.5 text-xs font-semibold text-white">
                {t('table.pot', { amount: formatAmount(pot, units) })}
              </span>
              {sidePots.map((p, i) => (
                <span key={i} className="num rounded-full bg-black/35 px-2 py-0.5 text-[0.7rem] text-white">
                  {t('table.sidePot', { n: i + 1, amount: formatAmount(p, units) })}
                </span>
              ))}
            </div>
          )}
          {board.length > 0 && (
            <div className="flex flex-col items-center gap-1" data-testid="board">
              <CardRow cards={board} size={tall ? 'sm' : 'md'} label={t('table.board', { cards: board.join(' ') })} />
              {street && <span className="text-[0.65rem] font-semibold tracking-wider text-white/75 uppercase">{t(`table.street.${street}` as MessageKey)}</span>}
            </div>
          )}
        </div>

        {/* Bets in front of the seats */}
        {seats.map((s, i) =>
          s.bet ? (
            <div key={`bet-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${place(i, i === heroIndex ? 0.46 : 0.6).left}%`, top: `${place(i, i === heroIndex ? 0.46 : 0.6).top}%` }}>
              <ChipStack amount={s.bet} />
            </div>
          ) : null,
        )}

        {/* Dealer button */}
        {buttonSeat >= 0 && (
          <div aria-label={t('table.button')} className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-slate-400 bg-white text-[0.65rem] font-bold text-slate-900 shadow-1" style={{ left: `${place(buttonSeat, 0.5).left + (buttonSeat === heroIndex ? 9 : 6)}%`, top: `${place(buttonSeat, 0.5).top}%` }}>
            D
          </div>
        )}

        {/* Seats */}
        {seats.map((s, i) => {
          const p = place(i);
          const inHand = s.status === 'active' || s.status === 'allin';
          const showCards = s.cards && s.cards.length > 0;
          return (
            <div
              key={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1"
              style={{ left: `${p.left}%`, top: `${p.top}%` }}
              data-testid={s.hero ? 'hero-seat' : 'seat'}
              aria-label={t('table.seatLabel', { name: s.name, position: s.position, stack: formatAmount(s.stack, units), status: t(`table.status.${s.status}` as MessageKey) })}
            >
              {showCards ? <CardRow cards={s.cards!} size={s.hero ? (tall ? 'sm' : 'md') : 'sm'} /> : inHand && s.hidden !== false && !s.hero ? <CardRow cards={[null, null]} faceDown size="xs" /> : null}
              {/* Folded seats: dashed outline and a word, not faded text (contrast stays AA). */}
              <div className={`min-w-[5.5rem] rounded-control border bg-surface px-2 py-1 text-center shadow-2 transition-shadow ${s.toAct ? 'border-accent ring-2 ring-accent' : s.status === 'folded' ? 'border-dashed border-line shadow-none' : s.hero ? 'border-accent/60' : 'border-line'}`} style={{ transitionDuration: 'calc(var(--dur) * var(--motion))' }}>
                <p className="flex items-center justify-center gap-1 text-[0.7rem] font-semibold">
                  <span className={s.hero ? 'text-accent' : 'text-ink'}>{s.name}</span>
                  {s.name !== s.position && <span className="text-ink-muted">· {s.position}</span>}
                </p>
                <p className="num text-xs text-ink-muted">{s.status === 'allin' ? t('table.allIn') : s.status === 'folded' ? t('table.folded') : formatAmount(s.stack, units)}</p>
                {s.toAct && <p className="text-[0.65rem] font-semibold text-accent">{t('table.toAct')}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {history.length > 0 && (
        <ol aria-label={t('table.history')} className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-xs text-ink-muted" data-testid="action-history">
          {history.map((h, i) => (
            <li key={i} className="flex items-center gap-2">
              {i > 0 && <span aria-hidden>·</span>}
              <span className={i === history.length - 1 ? 'font-medium text-ink' : ''}>{h}</span>
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}
