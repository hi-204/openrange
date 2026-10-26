// Catches a crash in a page and shows a plain explanation with "Copy diagnostics" instead of a
// blank screen (D-082). Other pages keep working: the boundary resets when you navigate.

import { Component, type ReactNode } from 'react';
import { t } from '../lib/i18n';
import { ErrorState } from '../lib/ui/components';

type Props = { children: ReactNode; resetKey: string };
type State = { error: unknown; key: string };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, key: this.props.resetKey };

  static getDerivedStateFromError(error: unknown) {
    return { error };
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
