import type { Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { SubNav } from '../../lib/ui/SubNav';
import { MathDrill } from './math/MathDrill';
import { PostflopDrill } from './postflop/PostflopDrill';
import { PreflopDrill } from './preflop/PreflopDrill';

const TABS = ['preflop', 'postflop', 'math'] as const;

export function TrainerPage({ route }: { route: Route }) {
  const tab = (TABS as readonly string[]).includes(route.rest[0] ?? '') ? route.rest[0]! : 'preflop';
  return (
    <div className="space-y-6">
      <p className="max-w-prose text-sm text-ink-muted">{t('trainer.intro')}</p>
      <SubNav
        page="train"
        label={t('trainer.tabs')}
        current={tab}
        items={[
          { id: 'preflop', label: t('trainer.tab.preflop') },
          { id: 'postflop', label: t('trainer.tab.postflop') },
          { id: 'math', label: t('trainer.tab.math') },
        ]}
      />
      {tab === 'preflop' && <PreflopDrill files={route.query.get('files')?.split(',')} />}
      {tab === 'postflop' && <PostflopDrill spot={route.query.get('spot') ?? undefined} />}
      {tab === 'math' && <MathDrill drill={route.query.get('drill') ?? undefined} />}
    </div>
  );
}
