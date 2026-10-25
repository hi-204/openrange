import { useState } from 'react';
import { t } from '../../lib/i18n';
import { fromOnboarding, type AppSettings, type Experience } from '../../lib/settings/settings';
import { useSettings } from '../../lib/settings/useSettings';
import { Modal, SegmentedControl } from '../../lib/ui/components';
import { PlayingCard } from '../table/Card';

/** First run, under a minute, skippable: sets the mode and a few display defaults. */
export function Onboarding() {
  const update = useSettings((s) => s.update);
  const display = useSettings((s) => s.settings.display);
  const [experience, setExperience] = useState<Experience>('new');
  const [interest, setInterest] = useState<AppSettings['interest']>('both');
  const finish = (skip: boolean) =>
    void update((s) => (skip ? { ...s, onboarded: true } : fromOnboarding(s, experience, interest)));
  const setDisplay = (d: Partial<AppSettings['display']>) => void update((s) => ({ ...s, display: { ...s.display, ...d } }));

  return (
    <Modal open title={t('onboarding.title')} onClose={() => finish(true)} testId="onboarding">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">{t('onboarding.title')}</h2>
        <p className="text-sm text-ink-muted">{t('onboarding.intro')}</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('onboarding.experience')}</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {(['new', 'basics', 'experienced'] as const).map((e) => (
            <button
              key={e}
              type="button"
              aria-pressed={experience === e}
              onClick={() => setExperience(e)}
              className={`rounded-control border p-3 text-left text-sm transition-colors ${experience === e ? 'border-accent bg-accent-soft' : 'border-line hover:bg-surface-2'}`}
            >
              <span className="block font-semibold">{t(`onboarding.exp.${e}`)}</span>
              <span className="text-xs text-ink-muted">{t(`onboarding.exp.${e}.hint`)}</span>
            </button>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <p className="text-sm font-medium">{t('onboarding.interest')}</p>
        <SegmentedControl
          label={t('onboarding.interest')}
          value={interest}
          onChange={setInterest}
          options={[
            { value: 'cash', label: t('onboarding.cash') },
            { value: 'tournament', label: t('onboarding.tournaments') },
            { value: 'both', label: t('onboarding.both') },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.theme')}</p>
          <SegmentedControl
            label={t('settings.theme')}
            value={display.theme}
            onChange={(theme) => setDisplay({ theme })}
            options={[
              { value: 'system', label: t('settings.theme.system') },
              { value: 'dark', label: t('settings.theme.dark') },
              { value: 'light', label: t('settings.theme.light') },
            ]}
          />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.deck')}</p>
          <div className="flex items-center gap-3">
            <SegmentedControl
              label={t('settings.deck')}
              value={display.deck}
              onChange={(deck) => setDisplay({ deck })}
              options={[
                { value: 'four', label: t('settings.deck.four') },
                { value: 'two', label: t('settings.deck.two') },
              ]}
            />
            <span className="flex gap-1" aria-hidden>
              <PlayingCard card="Ah" size="xs" />
              <PlayingCard card="Kd" size="xs" />
              <PlayingCard card="Qc" size="xs" />
            </span>
          </div>
        </div>
      </div>
      <p className="text-xs text-ink-muted">{t('onboarding.modeNote')}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className="btn-quiet" onClick={() => finish(true)}>
          {t('onboarding.skip')}
        </button>
        <button type="button" className="btn-primary" onClick={() => finish(false)} data-testid="onboarding-done">
          {t('onboarding.start')}
        </button>
      </div>
    </Modal>
  );
}
