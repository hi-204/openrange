import { pct } from '../../lib/format';
import { t, type MessageKey } from '../../lib/i18n';
import type { Category } from './grading';
import type { Claim } from './explain/claims';
import { lessonFor, renderClaim } from './explain/render';

// Okabe–Ito colours plus a symbol and the word, so the category never depends on colour alone.
const CATEGORY_STYLE: Record<Category | 'practice' | 'notGraded', { symbol: string; className: string }> = {
  best: { symbol: '✓✓', className: 'border-[#0072B2] text-[#005a8c] dark:text-[#56B4E9]' },
  acceptable: { symbol: '✓', className: 'border-[#009E73] text-[#00694d] dark:text-[#3fd0a4]' },
  inaccuracy: { symbol: '?!', className: 'border-[#E69F00] text-[#8a5f00] dark:text-[#F0E442]' },
  mistake: { symbol: '?', className: 'border-[#D55E00] text-[#a34700] dark:text-[#ff8f4a]' },
  blunder: { symbol: '??', className: 'border-[#CC79A7] text-[#8f3a6b] dark:text-[#e7a3c8]' },
  practice: { symbol: '·', className: 'border-slate-500 text-slate-700 dark:text-slate-300' },
  notGraded: { symbol: '–', className: 'border-slate-500 text-slate-700 dark:text-slate-300' },
};

export type ActionRow = { action: string; frequency: number; ev: number | null; evText: string; stdError: number | null };

type Props = {
  category: Category | null;
  claims: Claim[];
  hand: string;
  rows: ActionRow[];
  chosen: number;
  notes: string[];
  reference: React.ReactNode;
  /** Lesson to suggest when no claim points to a more specific one. */
  lesson: MessageKey;
  ungraded?: 'practice' | 'notGraded';
  nextLabel?: string;
  onNext: () => void;
};

/** `ungraded` says why there is no category: a practice chart or a decision off the solution's path. */
export function CategoryBadge({ category, ungraded = 'practice' }: { category: Category | null; ungraded?: 'practice' | 'notGraded' }) {
  const key = category ?? ungraded;
  const s = CATEGORY_STYLE[key];
  return (
    <span className={`inline-flex items-center gap-2 rounded-md border-2 px-3 py-1 text-lg font-semibold ${s.className}`} data-testid="grade" data-category={key}>
      <span aria-hidden>{s.symbol}</span>
      {t(`trainer.category.${key}` as MessageKey)}
    </span>
  );
}

/** Result of one answer: grade, explanation, the hand's full solution and the reference. */
export function AnswerPanel({ category, claims, hand, rows, chosen, notes, reference, lesson, ungraded, nextLabel, onNext }: Props) {
  const sentences = claims.flatMap(renderClaim);
  return (
    <section className="card space-y-4" aria-live="polite" aria-labelledby="answer-heading" data-testid="answer">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="answer-heading" className="sr-only">
          {t('trainer.answer.heading')}
        </h3>
        <CategoryBadge category={category} ungraded={ungraded} />
        <button type="button" className="btn-primary" onClick={onNext} autoFocus>
          {nextLabel ?? t('trainer.next')}
        </button>
      </div>
      <div className="space-y-1 text-sm leading-relaxed" data-testid="explanation">
        {sentences.map((s, i) => (
          <p key={i}>{s}</p>
        ))}
      </div>
      <table className="w-full max-w-md text-left text-sm">
        <caption className="mb-1 text-left font-medium">{t('trainer.answer.strategy', { hand })}</caption>
        <thead>
          <tr>
            <th className="py-1">{t('trainer.answer.action')}</th>
            <th className="py-1">{t('trainer.answer.frequency')}</th>
            <th className="py-1">{t('trainer.answer.ev')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.action} className={`border-t border-slate-100 dark:border-slate-800 ${i === chosen ? 'font-semibold' : ''}`}>
              <td className="py-1">
                {r.action}
                {i === chosen && <span className="ml-1 text-xs font-normal text-slate-500">({t('trainer.answer.you')})</span>}
              </td>
              <td className="py-1 font-mono">{pct(r.frequency, 0)}</td>
              <td className="py-1 font-mono">
                {r.evText}
                {r.stdError !== null && r.stdError > 0 && <span className="text-xs text-slate-500"> ± {r.stdError.toFixed(2)}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
        {notes.map((n, i) => (
          <p key={i}>{n}</p>
        ))}
        <p>{t('trainer.lesson', { title: t(lessonFor(claims, lesson)) })}</p>
        <div>{reference}</div>
        <p>{t('trainer.nextHint')}</p>
      </div>
    </section>
  );
}
