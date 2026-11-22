import type { Route } from '../../app/route';
import { t } from '../../lib/i18n';
import { SubNav } from '../../lib/ui/SubNav';
import { ChartsPage } from '../charts/ChartsPage';
import { SolverPage } from '../solver/SolverPage';
import { ComparePage } from '../tools/ComparePage';
import { EquityPage } from '../tools/EquityPage';
import { IcmPage } from '../tools/IcmPage';
import { PushFoldPage } from '../tools/PushFoldPage';
import { ReportsPage } from '../reports/ReportsPage';

const TOOLS = ['workbench', 'charts', 'compare', 'reports', 'equity', 'pushfold', 'icm'] as const;

export function SolvePage({ route }: { route: Route }) {
  const tool = (TOOLS as readonly string[]).includes(route.rest[0] ?? '') ? route.rest[0]! : 'workbench';
  return (
    <div className="space-y-6">
      <SubNav
        page="solve"
        label={t('nav.solve')}
        current={tool}
        items={[
          { id: 'workbench', label: t('solve.workbench') },
          { id: 'charts', label: t('nav.charts') },
          { id: 'compare', label: t('solve.compare') },
          { id: 'reports', label: t('solve.reports') },
          { id: 'equity', label: t('nav.equity') },
          { id: 'pushfold', label: t('nav.pushfold') },
          { id: 'icm', label: t('solve.icm') },
        ]}
      />
      {tool === 'workbench' && <SolverPage />}
      {tool === 'charts' && <ChartsPage />}
      {tool === 'reports' && <ReportsPage />}
      {tool === 'equity' && <EquityPage />}
      {tool === 'pushfold' && <PushFoldPage />}
      {tool === 'compare' && <ComparePage />}
      {tool === 'icm' && <IcmPage />}
    </div>
  );
}
