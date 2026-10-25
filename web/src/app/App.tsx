import { useEffect, useState } from 'react';
import { SolverPage } from '../features/solver/SolverPage';
import { ChartsPage } from '../features/charts/ChartsPage';
import { GlossaryPage } from '../features/lessons/GlossaryPage';
import { LearnPage } from '../features/lessons/LearnPage';
import { EquityPage } from '../features/tools/EquityPage';
import { PushFoldPage } from '../features/tools/PushFoldPage';
import { TrainerPage } from '../features/trainer/TrainerPage';
import { t, type MessageKey } from '../lib/i18n';
import { HomePage } from './HomePage';
import { parseRoute, type Route } from './route';

// Tiny hash router: no dependency needed for a handful of pages, and hash URLs work from
// any static host and offline. A route is its first path segment; pages get the rest and the
// query (e.g. #/learn/2.3, #/trainer/math?drill=potodds).
const ROUTES: { path: string; label: MessageKey; page: (p: { route: Route }) => React.JSX.Element; hidden?: boolean }[] = [
  { path: '', label: 'nav.home', page: HomePage },
  { path: 'learn', label: 'nav.learn', page: LearnPage },
  { path: 'trainer', label: 'nav.trainer', page: TrainerPage },
  { path: 'equity', label: 'nav.equity', page: EquityPage },
  { path: 'charts', label: 'nav.charts', page: ChartsPage },
  { path: 'pushfold', label: 'nav.pushfold', page: PushFoldPage },
  { path: 'solver', label: 'nav.solver', page: SolverPage },
  { path: 'glossary', label: 'nav.glossary', page: GlossaryPage, hidden: true },
];

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const onHash = () => {
      setRoute(parseRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const current = ROUTES.find((r) => r.path === route.page) ?? ROUTES[0]!;
  const Page = current.page;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 px-6 py-4 dark:border-slate-800">
        <div className="mx-auto flex max-w-4xl flex-wrap items-baseline justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">{t('app.title')}</h1>
            <p className="text-sm text-slate-600 dark:text-slate-400">{t('app.tagline')}</p>
          </div>
          <nav aria-label={t('nav.label')} className="flex flex-wrap gap-1">
            {ROUTES.filter((r) => !r.hidden).map((r) => (
              <a
                key={r.path}
                href={`#/${r.path}`}
                aria-current={r === current ? 'page' : undefined}
                className="rounded-md px-3 py-1.5 text-sm hover:bg-slate-200 aria-[current=page]:bg-slate-900 aria-[current=page]:text-white dark:hover:bg-slate-800 dark:aria-[current=page]:bg-slate-100 dark:aria-[current=page]:text-slate-900"
              >
                {t(r.label)}
              </a>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Page key={current.path} route={route} />
      </main>
    </div>
  );
}
