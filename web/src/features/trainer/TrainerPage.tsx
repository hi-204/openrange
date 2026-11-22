import type { Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { SubNav } from '../../lib/ui/SubNav';
import { LibraryPage } from '../library/LibraryPage';
import { MathDrill } from './math/MathDrill';
import { PostflopDrill } from './postflop/PostflopDrill';
import { PreflopDrill } from './preflop/PreflopDrill';
import { RangeDrill } from './ranges/RangeDrill';
import { TournamentDrill } from './tournament/TournamentDrill';
import { HandReadingDrill } from './reading/HandReadingDrill';

const TABS = ['preflop', 'postflop', 'tournament', 'ranges', 'reading', 'math', 'library'] as const;

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
          { id: 'tournament', label: t('trainer.tab.tournament') },
          { id: 'ranges', label: t('trainer.tab.ranges') },
          { id: 'reading', label: t('trainer.tab.reading') },
          { id: 'math', label: t('trainer.tab.math') },
          { id: 'library', label: t('trainer.tab.library') },
        ]}
      />
      {tab === 'preflop' && <PreflopDrill files={route.query.get('files')?.split(',')} chart={route.query.get('chart') ?? undefined} families={route.query.get('families')?.split(',')} />}
      {tab === 'postflop' && <PostflopDrill spot={route.query.get('spot') ?? undefined} focus={route.query.get('focus') ?? undefined} />}
      {tab === 'tournament' && <TournamentDrill />}
      {tab === 'ranges' && <RangeDrill />}
      {tab === 'reading' && <HandReadingDrill />}
      {tab === 'math' && <MathDrill drill={route.query.get('drill') ?? undefined} />}
      {tab === 'library' && <LibraryPage />}
    </div>
  );
}
