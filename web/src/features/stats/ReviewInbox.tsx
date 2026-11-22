// Review inbox on Stats (D-094): the spot families the scheduler says are due, and one tap to review them.

import { useEffect, useState } from 'react';
import { href } from '../../app/route';
import { t } from '../../lib/i18n';
import type { FamilyState } from '../trainer/srs';
import { trainerStore } from '../trainer/store';

/** The chart file a preflop family's charts come from ("preflop|cash-6max|first-in-BTN|100"). */
export function fileOfFamily(family: string): string | null {
  const [kind, set, , band] = family.split('|');
  if (kind !== 'preflop' || !set) return null;
  return set === 'cash-6max' ? `cash-6max-${band}bb.json` : `${set}.json`;
}

export function ReviewInbox() {
  const [due, setDue] = useState<FamilyState[] | null>(null);
  useEffect(() => {
    trainerStore()
      .families()
      .then((m) => setDue([...m.values()].filter((f) => f.due <= Date.now()).sort((a, b) => a.due - b.due)))
      .catch(() => setDue([]));
  }, []);
  if (!due) return null;
  const pre = due.filter((f) => f.family.startsWith('preflop|'));
  const post = [...new Set(due.filter((f) => f.family.startsWith('postflop|')).map((f) => f.family.split('|')[1]!))];
  const files = [...new Set(pre.map((f) => fileOfFamily(f.family)).filter((x): x is string => !!x))];
  return (
    <section className="card space-y-2" data-testid="review-inbox">
      <h2 className="eyebrow">{t('inbox.title')}</h2>
      {due.length === 0 ? (
        <p className="text-sm text-ink-muted">{t('inbox.none')}</p>
      ) : (
        <>
          <p className="text-sm">{t('inbox.count', { n: due.length })}</p>
          <ul className="space-y-0.5 text-sm">
            {due.slice(0, 6).map((f) => (
              <li key={f.family} className="text-ink-muted">
                {f.family.split('|').slice(1).join(' · ')}
                {f.lapses > 0 ? ` · ${t('inbox.lapses', { n: f.lapses })}` : ''}
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            {pre.length > 0 && (
              <a className="btn-primary" href={href('train', ['preflop'], { files: files.join(','), families: pre.map((f) => f.family).join(',') })} data-testid="inbox-start">
                {t('inbox.preflop', { n: pre.length })}
              </a>
            )}
            {post.map((spot) => (
              <a key={spot} className="btn-secondary" href={href('train', ['postflop'], { spot })}>
                {t('inbox.postflop', { spot })}
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
