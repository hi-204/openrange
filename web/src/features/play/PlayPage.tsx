import type { Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { SubNav } from '../../lib/ui/SubNav';
import { HandReview } from '../review/HandReview';
import { PlayTable } from './PlayTable';

const TABS = ['table', 'review'] as const;

export function PlayPage({ route }: { route: Route }) {
  const tab = (TABS as readonly string[]).includes(route.rest[0] ?? '') ? route.rest[0]! : 'table';
  return (
    <div className="space-y-6">
      <SubNav
        page="play"
        label={t('play.tabs')}
        current={tab}
        items={[
          { id: 'table', label: t('play.tab.table') },
          { id: 'review', label: t('play.tab.review') },
        ]}
      />
      {tab === 'table' && <PlayTable />}
      {tab === 'review' && <HandReview />}
    </div>
  );
}
