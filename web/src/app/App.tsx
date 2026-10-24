import { useEffect, useState } from 'react';
import { SolverPage } from '../features/solver/SolverPage';
import { EquityPage } from '../features/tools/EquityPage';
import { t, type MessageKey } from '../lib/i18n';
import { HomePage } from './HomePage';

// Tiny hash router: no dependency needed for a handful of pages, and hash URLs work from
// any static host and offline.
const ROUTES: { path: string; label: MessageKey; page: () => React.JSX.Element }[] = [
  { path: '', label: 'nav.home', page: HomePage },
  { path: 'equity', label: 'nav.equity', page: EquityPage },
  { path: 'solver', label: 'nav.solver', page: SolverPage },
];

function currentPath(): string {
  return window.location.hash.replace(/^#\/?/, '');
}

export function App() {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const onHash = () => setPath(currentPath());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const route = ROUTES.find((r) => r.path === path) ?? ROUTES[0]!;
  const Page = route.page;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('app.tagline')}</p>
          </div>
          <nav aria-label={t('nav.label')} className="flex gap-1">
            {ROUTES.map((r) => (
              <a
                key={r.path}
                href={`#/${r.path}`}
                aria-current={r === route ? 'page' : undefined}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-200 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white dark:hover:bg-slate-800 dark:aria-[current=page]:bg-slate-100 dark:aria-[current=page]:text-slate-900"
              >
                {t(r.label)}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Page />
      </main>
    </div>
  );
}
