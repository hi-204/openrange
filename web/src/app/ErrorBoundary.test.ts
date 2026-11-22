// Reload once when a page's code file is missing after an update (D-096), never in a loop.
import { describe, expect, it } from 'vitest';
import { isChunkError, reloadOnceForChunkError } from './ErrorBoundary';

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('chunk errors after an update', () => {
  it('recognises the browsers\' messages for a missing module', () => {
    expect(isChunkError(new TypeError('Failed to fetch dynamically imported module: http://x/assets/A.js'))).toBe(true);
    expect(isChunkError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkError(new TypeError('error loading dynamically imported module'))).toBe(true);
    expect(isChunkError(new Error('boom'))).toBe(false);
    expect(isChunkError('Failed to fetch dynamically imported module')).toBe(false);
  });

  it('reloads once, then lets the error show if it happens again within a minute', () => {
    const store = memory();
    let reloads = 0;
    const err = new TypeError('Failed to fetch dynamically imported module: x');
    expect(reloadOnceForChunkError(err, 1_000, store, () => reloads++)).toBe(true);
    expect(reloadOnceForChunkError(err, 30_000, store, () => reloads++)).toBe(false);
    expect(reloadOnceForChunkError(err, 70_000, store, () => reloads++)).toBe(true);
    expect(reloads).toBe(2);
    expect(reloadOnceForChunkError(new Error('boom'), 200_000, store, () => reloads++)).toBe(false);
  });
});
