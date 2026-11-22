// "How to use this page" (D-092): a short, collapsed guide at the top of a page.

import { t, type MessageKey } from '../i18n';
import { Accordion } from './components';

export function PageGuide({ prefix, steps }: { prefix: string; steps: number }) {
  return (
    <Accordion title={t('guide.title')} testId="page-guide">
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        {Array.from({ length: steps }, (_, i) => (
          <li key={i}>{t(`${prefix}.${i + 1}` as MessageKey)}</li>
        ))}
      </ol>
    </Accordion>
  );
}
