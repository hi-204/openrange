import type { Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { PageGuide } from '../../lib/ui/PageGuide';
import { SubNav } from '../../lib/ui/SubNav';
import { JournalPage } from '../journal/JournalPage';
import { HandReview } from '../review/HandReview';
import { PostflopDrill } from '../trainer/postflop/PostflopDrill';
import { PlaySession } from './PlaySession';
import { PlayTable } from './PlayTable';

const TABS = ['table', 'session', 'practice', 'review', 'journal'] as const;

export function PlayPage({ route }: { route: Route }) {
  const tab = (TABS as readonly string[]).includes(route.rest[0] ?? '') ? route.rest[0]! : 'table';
  return (
    <div className="space-y-6">
      <PageGuide prefix="guide.play" steps={5} />
      <SubNav
        page="play"
        label={t('play.tabs')}
        current={tab}
        items={[
          { id: 'table', label: t('play.tab.table') },
          { id: 'session', label: t('play.tab.session') },
          { id: 'practice', label: t('play.tab.practice') },
          { id: 'review', label: t('play.tab.review') },
          { id: 'journal', label: t('play.tab.journal') },
        ]}
      />
      {tab === 'table' && <PlayTable />}
      {tab === 'session' && <PlaySession />}
      {tab === 'practice' && (
        <div className="space-y-3">
          <p className="max-w-prose text-sm text-ink-muted">{t('practice.intro')}</p>
          <PostflopDrill practice spot={route.query.get('spot') ?? undefined} focus={route.query.get('focus') ?? undefined} />
        </div>
      )}
      {tab === 'review' && <HandReview />}
      {tab === 'journal' && <JournalPage />}
    </div>
  );
}
