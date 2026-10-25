// Drill flow helpers (docs/DESIGN.md §5): progressive hints, quick mode, timer, session summary.

import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../../lib/i18n';
import { Icon } from '../../lib/ui/Icon';
import { fmtLoss } from './explain/render';
import type { Category, Unit } from './grading';
import { recordAnswer } from './session';
import type { FamilyState, INTENSITY_SCALE } from './srs';
import { trainerStore, type AnswerRecord } from './store';

/** Hints revealed one at a time before answering. Using them is recorded, never penalised. */
export function Hints({ hints, used, onUse }: { hints: string[]; used: number; onUse: () => void }) {
  if (!hints.length) return null;
  return (
    <div className="space-y-2" data-testid="hints">
      {hints.slice(0, used).map((h, i) => (
        <p key={i} className="flex gap-2 rounded-control bg-accent-soft px-3 py-2 text-sm">
          <Icon name="bulb" size={18} className="text-accent" />
          {h}
        </p>
      ))}
      {used < hints.length && (
        <button type="button" className="btn-quiet" onClick={onUse} data-testid="hint-button">
          <Icon name="bulb" size={18} />
          {used === 0 ? t('flow.hint') : t('flow.nextHint')}
        </button>
      )}
    </div>
  );
}

/**
 * The spaced-repetition state, and a save that never blocks the next answer. Saves run one at a
 * time in order (each builds on the state the previous one returned); the first load is the
 * head of the queue, so no save can start from an empty state.
 */
export function useFamilies(onError: (e: Error) => void) {
  const [families, setFamilies] = useState<Map<string, FamilyState>>(new Map());
  const latest = useRef(families);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const report = useRef(onError);
  useEffect(() => {
    report.current = onError;
  });
  useEffect(() => {
    queue.current = queue.current
      .then(() => trainerStore().families())
      .then((f) => {
        latest.current = f;
        setFamilies(f);
      })
      .catch((e: Error) => report.current(e));
  }, []);
  const save = useCallback((rec: AnswerRecord, intensity: keyof typeof INTENSITY_SCALE) => {
    queue.current = queue.current
      .then(async () => {
        const updated = await recordAnswer(trainerStore(), rec, latest.current, intensity);
        latest.current = updated;
        setFamilies(updated);
      })
      .catch((e: Error) => report.current(e));
  }, []);
  return [families, save] as const;
}

/** Quick mode: move on by itself after a short pause, unless the user does something. */
export function useQuickAdvance(enabled: boolean, ready: boolean, next: () => void, delayMs = 2500) {
  const [pending, setPending] = useState(false);
  const nextRef = useRef(next);
  nextRef.current = next;
  useEffect(() => {
    if (!enabled || !ready) {
      setPending(false);
      return;
    }
    setPending(true);
    const cancel = () => {
      clearTimeout(timer);
      setPending(false);
    };
    const timer = setTimeout(() => {
      setPending(false);
      nextRef.current();
    }, delayMs);
    window.addEventListener('pointerdown', cancel, { once: true });
    window.addEventListener('scroll', cancel, { once: true, passive: true });
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', cancel);
      window.removeEventListener('scroll', cancel);
    };
  }, [enabled, ready, delayMs]);
  return pending;
}

/** Optional per-decision timer; calls onExpire once. */
export function useCountdown(seconds: number, active: boolean, onExpire: () => void): number | null {
  const [left, setLeft] = useState<number | null>(null);
  const cb = useRef(onExpire);
  cb.current = onExpire;
  useEffect(() => {
    if (!seconds || !active) {
      setLeft(null);
      return;
    }
    const end = Date.now() + seconds * 1000;
    setLeft(seconds);
    const h = setInterval(() => {
      const s = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        clearInterval(h);
        cb.current();
      }
    }, 250);
    return () => clearInterval(h);
  }, [seconds, active]);
  return left;
}

export function TimerBadge({ left }: { left: number | null }) {
  if (left === null) return null;
  return (
    <span className="num inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-xs" role="timer" aria-live="off" data-testid="timer">
      <Icon name="timer" size={14} />
      {left}s
    </span>
  );
}

export type SessionAnswer = { family: string; label: string; hand: string; category: Category | null; loss: number | null; unit: Unit; hints: number };

/** End-of-session summary with a one-click "drill my weak spots". */
export function SessionSummary({ answers, onDrillWeak, onClose }: { answers: SessionAnswer[]; onDrillWeak: (families: string[]) => void; onClose: () => void }) {
  const graded = answers.filter((a) => a.category);
  const good = graded.filter((a) => a.category === 'best' || a.category === 'acceptable').length;
  const worst = [...graded].sort((a, b) => (b.loss ?? 0) - (a.loss ?? 0)).filter((a) => a.category !== 'best' && a.category !== 'acceptable').slice(0, 3);
  const weak = [...new Set(worst.map((a) => a.family))];
  const units = [...new Set(graded.map((a) => a.unit))];
  return (
    <section className="card space-y-4" data-testid="session-summary">
      <h3 className="text-lg font-semibold">{t('flow.summary.title')}</h3>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="eyebrow">{t('flow.summary.answered')}</dt>
          <dd className="num text-2xl font-semibold">{answers.length}</dd>
        </div>
        <div>
          <dt className="eyebrow">{t('flow.summary.good')}</dt>
          <dd className="num text-2xl font-semibold">{graded.length ? `${Math.round((good / graded.length) * 100)}%` : '–'}</dd>
        </div>
        {units.map((u) => {
          const mine = graded.filter((a) => a.unit === u);
          const avg = mine.reduce((s, a) => s + (a.loss ?? 0), 0) / mine.length;
          return (
            <div key={u}>
              <dt className="eyebrow">{t('flow.summary.avgLoss')}</dt>
              <dd className="num text-2xl font-semibold">{fmtLoss(avg, u)}</dd>
            </div>
          );
        })}
        <div>
          <dt className="eyebrow">{t('flow.summary.hints')}</dt>
          <dd className="num text-2xl font-semibold">{answers.reduce((s, a) => s + a.hints, 0)}</dd>
        </div>
      </dl>
      {worst.length > 0 ? (
        <div className="space-y-1 text-sm">
          <p className="font-medium">{t('flow.summary.biggest')}</p>
          <ul className="list-disc pl-5">
            {worst.map((a, i) => (
              <li key={i}>
                {a.label}: {a.hand} ({fmtLoss(a.loss ?? 0, a.unit)})
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">{t('flow.summary.clean')}</p>
      )}
      <p className="text-xs text-ink-muted">{t('flow.summary.note')}</p>
      <div className="flex flex-wrap gap-2">
        {weak.length > 0 && (
          <button type="button" className="btn-primary" onClick={() => onDrillWeak(weak)} data-testid="drill-weak">
            {t('flow.summary.drillWeak')}
          </button>
        )}
        <button type="button" className="btn-secondary" onClick={onClose}>
          {t('flow.summary.keepGoing')}
        </button>
      </div>
    </section>
  );
}
