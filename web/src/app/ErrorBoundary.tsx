// Catches a crash in a page and shows a plain explanation with "Copy diagnostics" instead of a
// blank screen (D-082). Other pages keep working: the boundary resets when you navigate. A page
// whose code file is missing after an update reloads once instead (D-096).

import { Component, type ReactNode } from 'react';
import { t } from '../lib/i18n';
import { ErrorState } from '../lib/ui/components';

type Props = { children: ReactNode; resetKey: string };

/** A page's code file failed to load: after an update the old build's files are gone (D-096). */
export const isChunkError = (e: unknown) =>
  e instanceof Error && /dynamically imported module|Importing a module script failed|Failed to fetch dynamically/i.test(e.message);

const RELOADED = 'openrange-chunk-reload';

/** Reload once to pick up the current build; a second failure within a minute shows the error. */
export function reloadOnceForChunkError(e: unknown, now = Date.now(), store: Pick<Storage, 'getItem' | 'setItem'> = sessionStorage, reload = () => location.reload()): boolean {
  if (!isChunkError(e)) return false;
  const last = store.getItem(RELOADED);
  if (last !== null && now - Number(last) < 60_000) return false;
  store.setItem(RELOADED, String(now));
  reload();
  return true;
}
type State = { error: unknown; key: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    reloadOnceForChunkError(error);
  }

  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    // Navigating to another page clears the error.
    return props.resetKey !== state.key ? { error: null, key: props.resetKey } : null;
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <ErrorState
        title={t('crash.title')}
        message={t('crash.message')}
        error={this.state.error}
        next={
          <button type="button" className="btn-secondary" onClick={() => location.reload()}>
            {t('flow.reload')}
          </button>
        }
      />
    );
  }
}
