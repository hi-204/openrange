import { useState } from 'react';
import { t, type MessageKey } from '../../lib/i18n';
import { PreflopDrill } from './preflop/PreflopDrill';

const TABS = ['preflop', 'postflop', 'review'] as const;
type Tab = (typeof TABS)[number];

export function TrainerPage() {
  const [tab, setTab] = useState<Tab>('preflop');
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">{t('trainer.heading')}</h2>
        <p className="mt-1 max-w-prose text-sm text-slate-600 dark:text-slate-400">{t('trainer.intro')}</p>
      </div>
      <div role="tablist" aria-label={t('trainer.tabs')} className="flex gap-1">
        {TABS.map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            id={`tab-${k}`}
            aria-selected={tab === k}
            aria-controls={`panel-${k}`}
            onClick={() => setTab(k)}
            className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-200 aria-selected:bg-slate-900 aria-selected:text-white dark:hover:bg-slate-800 dark:aria-selected:bg-slate-100 dark:aria-selected:text-slate-900"
          >
            {t(`trainer.tab.${k}` as MessageKey)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'preflop' && <PreflopDrill />}
      </div>
    </div>
  );
}
