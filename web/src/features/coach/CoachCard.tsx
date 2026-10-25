import type { ReactNode } from 'react';
import { pct } from '../../lib/format';
import { t } from '../../lib/i18n';
import { useSettings } from '../../lib/settings/useSettings';
import { Icon } from '../../lib/ui/Icon';
import { lesson } from '../lessons/content';
import type { CoachCard as Card, Tone } from './coach';

const TONE: Record<Tone, { symbol: string; color: string; label: string }> = {
  best: { symbol: '✓✓', color: 'var(--grade-best)', label: 'coach.tone.best' },
  fine: { symbol: '✓', color: 'var(--grade-acceptable)', label: 'coach.tone.fine' },
  small: { symbol: '?!', color: 'var(--grade-inaccuracy)', label: 'coach.tone.small' },
  mistake: { symbol: '?', color: 'var(--grade-mistake)', label: 'coach.tone.mistake' },
  blunder: { symbol: '??', color: 'var(--grade-blunder)', label: 'coach.tone.blunder' },
  ungraded: { symbol: '–', color: 'var(--ink-faint)', label: 'coach.tone.ungraded' },
};

export type MathRow = { action: string; frequency: number; evText: string; stdError: number | null; chosen: boolean; best: boolean };

type Props = {
  card: Card;
  /** EV table rows for "Show the math". */
  rows?: MathRow[];
  /** Full checked explanation sentences (D-053) for "Show the math". */
  details?: string[];
  /** Extra math content, e.g. the 13×13 grid with the hand highlighted. */
  extra?: ReactNode;
  footer?: ReactNode;
  nextLabel?: string;
  onNext?: () => void;
  testId?: string;
};

/** The coaching card shown after every decision (docs/DESIGN.md §6). */
export function CoachCard({ card, rows, details, extra, footer, nextLabel, onNext, testId = 'answer' }: Props) {
  const showMath = useSettings((s) => s.settings.coaching.showMath);
  const tone = TONE[card.tone];
  const href = lesson(card.learnMore.href.replace('#/learn/', '')) ? card.learnMore.href : '#/glossary';
  return (
    <section className="card space-y-4 border-l-4" style={{ borderLeftColor: tone.color }} aria-live="polite" aria-labelledby={`${testId}-verdict`} data-testid={testId}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide uppercase" style={{ color: tone.color }} data-testid="grade" data-category={card.category ?? 'ungraded'} data-tone={card.tone}>
            <span aria-hidden className="text-base">
              {tone.symbol}
            </span>
            {t(tone.label as 'coach.tone.best')}
          </p>
          <h3 id={`${testId}-verdict`} className="text-lg font-semibold" data-testid="coach-verdict">
            {card.verdict}
          </h3>
        </div>
        {onNext && (
          <button type="button" className="btn-primary" onClick={onNext} autoFocus>
            {nextLabel ?? t('trainer.next')}
            <Icon name="arrowRight" size={18} />
          </button>
        )}
      </div>
      {card.why.length > 0 && (
        <div className="space-y-1.5 text-sm leading-relaxed" data-testid="coach-why">
          {card.why.map((s, i) => (
            <p key={i}>{s}</p>
          ))}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-control bg-accent-soft p-3 text-sm" data-testid="coach-idea">
          <p className="eyebrow mb-1 flex items-center gap-1 !text-accent">
            <Icon name="bulb" size={16} /> {t('coach.keyIdea')}
          </p>
          {card.keyIdea}
        </div>
        <div className="rounded-control bg-surface-2 p-3 text-sm" data-testid="coach-look">
          <p className="eyebrow mb-1">{t('coach.lookFor')}</p>
          {card.lookFor}
        </div>
      </div>
      <p className="text-sm">
        <a className="text-accent underline underline-offset-2" href={href}>
          {t('coach.learnMore', { topic: card.learnMore.topic })}
        </a>
      </p>
      {(rows || details || extra) && (
        <details className="group rounded-control border border-line" open={showMath} data-testid="coach-math">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-medium">
            {t('coach.showMath')}
            <Icon name="chevronDown" size={18} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-line p-4">
            {rows && (
              <table className="w-full max-w-md text-left text-sm">
                <thead>
                  <tr>
                    <th className="py-1">{t('trainer.answer.action')}</th>
                    <th className="py-1">{t('trainer.answer.frequency')}</th>
                    <th className="py-1">{t('trainer.answer.ev')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.action} className={`border-t border-line ${r.chosen ? 'font-semibold' : ''}`}>
                      <td className="py-1">
                        {r.action}
                        {r.chosen && <span className="ml-1 text-xs font-normal text-ink-muted">({t('trainer.answer.you')})</span>}
                        {r.best && <span className="ml-1 text-xs font-normal text-good">({t('coach.bestTag')})</span>}
                      </td>
                      <td className="num py-1">{pct(r.frequency, 0)}</td>
                      <td className="num py-1">
                        {r.evText}
                        {r.stdError !== null && r.stdError > 0 && <span className="text-xs text-ink-muted"> ± {r.stdError.toFixed(2)}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {details && (
              <div className="space-y-1 text-sm text-ink-muted" data-testid="explanation">
                {details.map((s, i) => (
                  <p key={i}>{s}</p>
                ))}
              </div>
            )}
            {extra}
          </div>
        </details>
      )}
      {footer && <div className="space-y-1 border-t border-line pt-3 text-xs text-ink-muted">{footer}</div>}
    </section>
  );
}
