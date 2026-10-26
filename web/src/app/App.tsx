import { lazy, Suspense, useEffect, useState } from 'react';
import { Onboarding } from '../features/onboarding/Onboarding';
import { t, type MessageKey } from '../lib/i18n';
import { useSettings } from '../lib/settings/useSettings';
import { Icon, type IconName } from '../lib/ui/Icon';
import { SegmentedControl, Skeleton, Toaster } from '../lib/ui/components';
import { ErrorBoundary } from './ErrorBoundary';
import { HomePage } from './HomePage';
import { parseRoute, redirect, type Route } from './route';

// Pages load when first opened (the course pages carry KaTeX and markdown-it), so the first
// screen stays small.
const LearnPage = lazy(() => import('../features/lessons/LearnPage').then((m) => ({ default: m.LearnPage })));
const PlayPage = lazy(() => import('../features/play/PlayPage').then((m) => ({ default: m.PlayPage })));
const SettingsPage = lazy(() => import('../features/settings/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SolvePage = lazy(() => import('../features/solve/SolvePage').then((m) => ({ default: m.SolvePage })));
const StatsPage = lazy(() => import('../features/stats/StatsPage').then((m) => ({ default: m.StatsPage })));
const TrainerPage = lazy(() => import('../features/trainer/TrainerPage').then((m) => ({ default: m.TrainerPage })));
const GlossaryPage = lazy(() => import('../features/lessons/GlossaryPage').then((m) => ({ default: m.GlossaryPage })));

// Tiny hash router: no dependency needed, and hash URLs work from any static host and
// offline. A route is its first path segment; pages get the rest and the query.
type Page = { path: string; label: MessageKey; icon: IconName; page: React.ComponentType<{ route: Route }>; mobile: boolean; hidden?: boolean };
const PAGES: Page[] = [
  { path: '', label: 'nav.home', icon: 'home', page: HomePage, mobile: true },
  { path: 'learn', label: 'nav.learn', icon: 'learn', page: LearnPage, mobile: true },
  { path: 'train', label: 'nav.train', icon: 'train', page: TrainerPage, mobile: true },
  { path: 'play', label: 'nav.play', icon: 'play', page: PlayPage, mobile: false },
  { path: 'solve', label: 'nav.solve', icon: 'solve', page: SolvePage, mobile: true },
  { path: 'stats', label: 'nav.stats', icon: 'stats', page: StatsPage, mobile: true },
  { path: 'settings', label: 'nav.settings', icon: 'settings', page: SettingsPage, mobile: false },
  { path: 'glossary', label: 'nav.glossary', icon: 'learn', page: GlossaryPage, mobile: false, hidden: true },
];

function NavLink({ p, current, compact }: { p: Page; current: boolean; compact?: boolean }) {
  return (
    <a
      href={`#/${p.path}`}
      aria-current={current ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-control font-medium transition-colors ${compact ? 'min-h-14 flex-1 flex-col justify-center gap-0.5 px-1 text-[0.7rem]' : 'min-h-11 px-3 text-sm'} ${current ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-surface-2 hover:text-ink'}`}
      style={{ transitionDuration: 'calc(var(--dur-fast) * var(--motion))' }}
    >
      <Icon name={p.icon} size={compact ? 22 : 20} />
      {t(p.label)}
    </a>
  );
}

export function App() {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  const [moreOpen, setMoreOpen] = useState(false);
  const { settings, loaded, load, update } = useSettings();
  useEffect(() => {
    void load().catch(() => undefined);
  }, [load]);
  useEffect(() => {
    const onHash = () => {
      const r = parseRoute(window.location.hash);
      const to = redirect(r);
      if (to) {
        window.location.replace(to);
        return;
      }
      setRoute(r);
      setMoreOpen(false);
      window.scrollTo(0, 0);
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const current = PAGES.find((p) => p.path === route.page) ?? PAGES[0]!;
  const Page = current.page;
  const dark = document.documentElement.dataset.theme === 'dark';

  return (
    <div className="min-h-screen bg-canvas text-ink md:grid md:grid-cols-[15rem_1fr]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2">
        {t('nav.skip')}
      </a>
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-6 border-r border-line bg-surface px-3 py-5 md:flex">
        <div className="px-3">
          <p className="text-lg font-semibold tracking-tight">{t('app.title')}</p>
          <p className="text-xs text-ink-muted">{t('app.tagline')}</p>
        </div>
        <nav aria-label={t('nav.label')} className="flex flex-col gap-1">
          {PAGES.filter((p) => !p.hidden).map((p) => (
            <NavLink key={p.path} p={p} current={p === current} />
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-line bg-canvas/90 px-4 py-3 backdrop-blur md:px-8">
          <h1 className="truncate text-lg font-semibold">
            <span className="md:hidden">{t('app.title')} · </span>
            {t(current.label)}
          </h1>
          <div className="flex items-center gap-2">
            <SegmentedControl
              size="sm"
              label={t('mode.label')}
              value={settings.mode}
              options={[
                { value: 'guided', label: t('mode.guided') },
                { value: 'expert', label: t('mode.expert') },
              ]}
              onChange={(mode) => void update((s) => ({ ...s, mode }))}
            />
            <button
              type="button"
              className="btn-quiet !min-h-10 !px-2.5"
              aria-label={dark ? t('theme.toLight') : t('theme.toDark')}
              onClick={() => void update((s) => ({ ...s, display: { ...s.display, theme: dark ? 'light' : 'dark' } }))}
            >
              <Icon name={dark ? 'sun' : 'moon'} />
            </button>
          </div>
        </header>

        <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-6 pb-28 md:px-8 md:pb-10" data-mode={settings.mode}>
          <ErrorBoundary resetKey={current.path}>
            <Suspense fallback={<Skeleton className="h-96" />}>
              <Page key={current.path} route={route} />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Phone tab bar */}
      <nav aria-label={t('nav.label')} className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-surface px-1 pb-[env(safe-area-inset-bottom)] md:hidden">
        {PAGES.filter((p) => p.mobile).map((p) => (
          <NavLink key={p.path} p={p} current={p === current} compact />
        ))}
        <div className="relative flex flex-1">
          <button type="button" aria-expanded={moreOpen} onClick={() => setMoreOpen((o) => !o)} className="flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[0.7rem] font-medium text-ink-muted">
            <Icon name="more" size={22} />
            {t('nav.more')}
          </button>
          {moreOpen && (
            <div className="absolute right-1 bottom-16 w-48 rounded-control border border-line bg-surface p-1 shadow-3">
              {PAGES.filter((p) => !p.mobile).map((p) => (
                <NavLink key={p.path} p={p} current={p === current} />
              ))}
            </div>
          )}
        </div>
      </nav>

      {loaded && !settings.onboarded && <Onboarding />}
      <Toaster />
    </div>
  );
}
