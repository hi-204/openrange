import { useId, useState } from 'react';
import { t, type MessageKey } from '../i18n';
import type { Provenance, Source } from './types';

const LABEL: Record<Source, MessageKey> = {
  solver_exact: 'provenance.exact',
  solver_approx: 'provenance.approx',
  authored: 'provenance.authored',
};

const STYLE: Record<Source, string> = {
  solver_exact: 'border-sky-700 text-sky-800 dark:border-sky-400 dark:text-sky-300',
  solver_approx: 'border-amber-700 text-amber-800 dark:border-amber-400 dark:text-amber-300',
  authored: 'border-slate-500 text-slate-700 dark:border-slate-400 dark:text-slate-300',
};

/** Where a chart's numbers come from, with the full provenance one click away. */
export function ProvenanceBadge({ p }: { p: Provenance }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="inline-block">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className={`rounded-full border px-2 py-0.5 text-xs ${STYLE[p.source]}`}
        data-testid="provenance-badge"
      >
        {t(LABEL[p.source])} ⓘ
      </button>
      {open && (
        <div id={id} className="mt-2 max-w-prose rounded-md border border-slate-200 bg-white p-3 text-xs dark:border-slate-700 dark:bg-slate-900">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt className="font-medium">{t('provenance.generator')}</dt>
            <dd className="font-mono">{p.generator}</dd>
            <dt className="font-medium">{t('provenance.generated')}</dt>
            <dd>{p.generatedAt}</dd>
            <dt className="font-medium">{t('provenance.commit')}</dt>
            <dd className="font-mono">
              {p.gitCommit}
              {p.gitDirty ? ` ${t('provenance.dirty')}` : ''}
            </dd>
            {p.solver && (
              <>
                <dt className="font-medium">{t('provenance.solver')}</dt>
                <dd className="font-mono">{JSON.stringify(p.solver)}</dd>
              </>
            )}
            {p.model && (
              <>
                <dt className="font-medium">{t('provenance.model')}</dt>
                <dd className="font-mono break-all">{JSON.stringify(p.model)}</dd>
              </>
            )}
          </dl>
          <p className="mt-2">{p.notes}</p>
        </div>
      )}
    </span>
  );
}
