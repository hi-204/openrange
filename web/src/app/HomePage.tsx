import { useEffect, useState } from 'react';
import { t } from '../lib/i18n';
import { solverClient } from '../lib/wasm/client';
import type { HelloResult } from '../lib/wasm/protocol';

type Status =
  | { kind: 'loading' }
  | { kind: 'ready'; info: HelloResult }
  | { kind: 'error'; message: string };

export function HomePage() {
  const [status, setStatus] = useState<Status>({ kind: 'loading' });

  useEffect(() => {
    let live = true;
    solverClient()
      .call('hello', {})
      .then((info) => live && setStatus({ kind: 'ready', info }))
      .catch((e: Error) => live && setStatus({ kind: 'error', message: e.message }));
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section aria-labelledby="status-heading" className="card">
        <h2 id="status-heading" className="mb-2 text-lg font-medium">
          {t('status.heading')}
        </h2>
        <div role="status" aria-live="polite" data-testid="solver-status">
          {status.kind === 'loading' && <p>{t('status.loading')}</p>}
          {status.kind === 'ready' && (
            <>
              <p>{t('status.ready', { version: status.info.version })}</p>
              <p className="mt-1 font-mono" data-testid="combo-count">
                {t('status.combos', { count: status.info.combos })}
              </p>
            </>
          )}
          {status.kind === 'error' && (
            <p className="text-amber-700 dark:text-amber-400">{t('status.error', { message: status.message })}</p>
          )}
        </div>
      </section>

      <section aria-labelledby="about-heading" className="space-y-2 text-sm leading-relaxed">
        <h2 id="about-heading" className="text-lg font-medium">
          {t('about.heading')}
        </h2>
        <p>{t('about.studyOnly')}</p>
        <p>{t('about.offline')}</p>
        <p className="text-slate-600 dark:text-slate-400">{t('about.milestone')}</p>
      </section>
    </div>
  );
}
