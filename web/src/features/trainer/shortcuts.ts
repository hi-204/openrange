// Keyboard shortcuts for drills: F fold, C check/call, R the first bet/raise/all-in, 1–9 the
// button with that number; Enter or N for the next hand.

import { useEffect, useLayoutEffect, useRef } from 'react';

export function actionForKey(key: string, actions: string[]): number | null {
  const k = key.toLowerCase();
  if (/^[1-9]$/.test(k)) {
    const i = Number(k) - 1;
    return i < actions.length ? i : null;
  }
  const find = (re: RegExp) => {
    const i = actions.findIndex((a) => re.test(a));
    return i >= 0 ? i : null;
  };
  if (k === 'f') return find(/^fold/i);
  if (k === 'c') return find(/^(check|call)/i);
  if (k === 'r' || k === 'a') return find(/^(bet|raise|all-in)/i);
  return null;
}

/**
 * Listen for drill keys; ignored while typing in a form field. One listener for the component's
 * life reads the latest actions from a ref updated before paint, so a key pressed right after a
 * new hand appears is never handled by the previous hand's listener.
 */
export function useDrillKeys(actions: string[] | null, onAction: (i: number) => void, onNext: (() => void) | null) {
  const latest = useRef({ actions, onAction, onNext });
  useLayoutEffect(() => {
    latest.current = { actions, onAction, onNext };
  });
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'SELECT' || el.tagName === 'TEXTAREA')) return;
      const { actions, onAction, onNext } = latest.current;
      if (onNext && (e.key === 'Enter' || e.key.toLowerCase() === 'n')) {
        e.preventDefault();
        onNext();
        return;
      }
      if (!actions) return;
      const i = actionForKey(e.key, actions);
      if (i !== null) {
        e.preventDefault();
        onAction(i);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);
}
