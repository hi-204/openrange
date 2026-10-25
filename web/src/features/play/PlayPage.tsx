import { href } from '../../app/route';
import { t } from '../../lib/i18n';
import { EmptyState } from '../../lib/ui/components';
import { PokerTable } from '../table/PokerTable';

export function PlayPage() {
  return (
    <div className="space-y-6">
      <EmptyState
        icon="play"
        title={t('play.soon.title')}
        action={
          <a className="btn-primary" href={href('train', ['postflop'])}>
            {t('play.soon.cta')}
          </a>
        }
      >
        {t('play.soon.text')}
      </EmptyState>
      <PokerTable
        variant="static"
        seats={[
          { name: 'UTG', position: 'UTG', stack: 100, status: 'folded' },
          { name: 'HJ', position: 'HJ', stack: 100, status: 'folded' },
          { name: 'CO', position: 'CO', stack: 97.5, status: 'active', bet: 2.5 },
          { name: t('table.you'), position: 'BTN', stack: 100, status: 'active', hero: true, cards: ['Ah', 'Kd'], toAct: true },
          { name: 'SB', position: 'SB', stack: 99.5, status: 'active', bet: 0.5 },
          { name: 'BB', position: 'BB', stack: 99, status: 'active', bet: 1 },
        ]}
        pot={0}
        board={[]}
        summary={t('play.sample')}
        history={['UTG folds', 'HJ folds', 'CO raises 2.5 bb']}
      />
    </div>
  );
}
