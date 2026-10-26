// "Copy diagnostics" (D-082): technical details for a bug report, with no personal data. It
// holds the app version, build, page, browser and the error, never answers, hands, notes,
// lesson progress or settings beyond the display mode.

import pkg from '../../package.json';

declare const __GIT_COMMIT__: string;

export type DiagnosticsInput = {
  error?: unknown;
  /** Defaults to the current page; the query string is dropped. */
  hash?: string;
  mode?: string;
};

/** Keep only file names and positions from a stack trace (no full URLs or paths). */
export function cleanStack(stack: string): string {
  return stack
    .split('\n')
    .slice(0, 12)
    .map((l) => l.replace(/\(?(?:https?|file):\/\/[^\s)]*\/([^/\s)]+)\)?/g, '$1').trim())
    .join('\n');
}

export function diagnostics({ error, hash, mode }: DiagnosticsInput = {}): string {
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  const page = (hash ?? (typeof location !== 'undefined' ? location.hash : '')).split('?')[0] || '#/';
  const err = error instanceof Error ? error : error === undefined ? undefined : new Error(String(error));
  const lines = [
    'OpenRange diagnostics',
    `version: ${pkg.version} (${typeof __GIT_COMMIT__ === 'string' ? __GIT_COMMIT__ : 'dev'})`,
    `time: ${new Date().toISOString()}`,
    `page: ${page}`,
    `mode: ${mode ?? 'unknown'}`,
    `browser: ${nav?.userAgent ?? 'unknown'}`,
    `language: ${nav?.language ?? 'unknown'}`,
    `screen: ${typeof window !== 'undefined' ? `${window.innerWidth}×${window.innerHeight} @${window.devicePixelRatio}x` : 'unknown'}`,
    `offline cache: ${nav?.serviceWorker?.controller ? 'active' : 'not active'}`,
  ];
  if (err) lines.push(`error: ${err.name}: ${err.message}`, 'stack:', cleanStack(err.stack ?? '(none)'));
  return lines.join('\n');
}
