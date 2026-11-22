// ICM calculator (D-091): the lesson widget as a tool, with the stacks and payouts you enter.

import { t } from '../../lib/i18n';
import { Widget } from '../lessons/widgets/Widget';

export function IcmPage() {
  return (
    <div className="space-y-4" data-testid="icm-page">
      <p className="max-w-prose text-sm text-ink-muted">{t('icm.intro')}</p>
      <Widget name="icm" config={{ stacks: [5000, 3000, 1500, 500], payouts: [50, 30, 20] }} />
      <p className="max-w-prose text-xs text-ink-muted">{t('icm.note')}</p>
    </div>
  );
}
