import { t } from '../../lib/i18n';
import { GLOSSARY } from './content';

export function GlossaryPage() {
  const terms = [...GLOSSARY.entries()].sort(([a], [b]) => a.localeCompare(b));
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{t('nav.glossary')}</h2>
      <dl className="space-y-3" data-testid="glossary">
        {terms.map(([term, def]) => (
          <div key={term} id={`term-${term.replace(/\s+/g, '-')}`}>
            <dt className="font-semibold capitalize">{term}</dt>
            <dd className="text-sm text-slate-700 dark:text-slate-300">{def}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
