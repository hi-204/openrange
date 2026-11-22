// "Practice my weak spots" (D-089): one tap builds a session from your leaks, or from recent
// mistakes while there isn't enough data to show leaks.

import { useEffect, useState } from 'react';
import { href } from '../../app/route';
import { t, type MessageKey } from '../../lib/i18n';
import { trainerStore } from '../trainer/store';
import { weakPlan, type WeakPlan } from './weak';

export function WeakSession() {
  const [plan, setPlan] = useState<WeakPlan | null>(null);
  useEffect(() => {
    const s = trainerStore();
    Promise.all([s.answers(), s.families()])
      .then(([answers, families]) => setPlan(weakPlan(answers, families)))
      .catch(() => setPlan(null));
  }, []);
  if (!plan) return null;
  return (
    <section className="card space-y-2" data-testid="weak-session">
      <h2 className="eyebrow">{t('weak.title')}</h2>
      {plan.source === 'none' ? (
        <p className="text-sm text-ink-muted">{t('weak.none')}</p>
      ) : (
        <>
          <p className="text-sm">{plan.source === 'leaks' ? t('weak.fromLeaks', { list: plan.leaks.map((l) => `${t(`review.dim.${l.dimension}` as MessageKey)} ${l.value}`).join(', ') }) : t('weak.fromRecent')}</p>
          <div className="flex flex-wrap gap-2">
            {plan.families.length > 0 && (
              <a className="btn-primary" href={href('train', ['preflop'], { files: plan.files.join(','), families: plan.families.join(',') })} data-testid="weak-start">
                {t('weak.preflop', { n: plan.families.length })}
              </a>
            )}
            {plan.postflopSpots.map((spot) => (
              <a key={spot} className="btn-secondary" href={href('train', ['postflop'], { spot })}>
                {t('weak.postflop', { spot: t(`trainer.post.spot.${spot}` as MessageKey) })}
              </a>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
