// Hand of the day on Home (D-094): one exact push/fold decision a day, answered once.

import { useEffect, useState } from 'react';
import { href } from '../../app/route';
import { t, type MessageKey } from '../../lib/i18n';
import { loadJson, type ChartFile } from '../../lib/provenance/types';
import { Badge } from '../../lib/ui/components';
import { CardRow } from '../table/Card';
import { dailyHand, dayKey, gradeDaily, type DailyHand } from './daily';

const KEY = 'openrange.daily';

export function DailyCard() {
  const [hand, setHand] = useState<DailyHand | null>(null);
  const [chosen, setChosen] = useState<number | null>(null);
  useEffect(() => {
    const day = dayKey(Date.now());
    loadJson<ChartFile>('data/charts/pushfold-hu.json')
      .then((doc) => {
        setHand(dailyHand(doc, day));
        try {
          const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { day: string; chosen: number } | null;
          if (saved?.day === day) setChosen(saved.chosen);
        } catch {
          // A broken saved value just means today's hand is unanswered.
        }
      })
      .catch(() => setHand(null));
  }, []);
  if (!hand) return null;
  const answer = (i: number) => {
    setChosen(i);
    localStorage.setItem(KEY, JSON.stringify({ day: hand.day, chosen: i }));
  };
  const g = chosen !== null ? gradeDaily(hand, chosen) : null;
  return (
    <section className="card space-y-3" data-testid="daily-hand">
      <h2 className="eyebrow">{t('daily.title')}</h2>
      <div className="flex flex-wrap items-center gap-4">
        <CardRow cards={[hand.combo.slice(0, 2), hand.combo.slice(2)]} size="sm" />
        <p className="text-sm font-medium">{hand.title}</p>
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label={t('daily.your')}>
        {hand.actions.map((a, i) => (
          <button key={a} type="button" className={chosen === i ? 'btn-primary' : 'btn-secondary'} disabled={chosen !== null} onClick={() => answer(i)}>
            {a}
          </button>
        ))}
      </div>
      {g && (
        <div className="space-y-1 text-sm" aria-live="polite" data-testid="daily-result">
          <p className="flex items-center gap-2">
            <Badge tone={g.category === 'best' ? 'good' : g.category === 'acceptable' ? 'accent' : 'warn'}>{t(`trainer.category.${g.category}` as MessageKey)}</Badge>
            {t('daily.evs', { list: hand.actions.map((a, i) => `${a} ${(hand.ev[i] ?? 0).toFixed(2)} bb`).join(', ') })}
          </p>
          <p className="text-xs text-ink-muted">{t('daily.note')}</p>
          <a className="link" href={href('train', ['preflop'], { files: 'pushfold-hu.json', chart: hand.chart })}>
            {t('daily.more')}
          </a>
        </div>
      )}
    </section>
  );
}
