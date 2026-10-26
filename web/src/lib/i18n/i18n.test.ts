import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('fills placeholders', () => {
    expect(t('status.ready', { app: '1.0.0', version: '1.2.3' })).toBe(
      'OpenRange 1.0.0. The solver core (v1.2.3) is running in a background worker.',
    );
  });

  it('leaves unknown placeholders visible instead of hiding them', () => {
    expect(t('status.ready')).toContain('{version}');
  });
});

describe('en.json', () => {
  it('has no duplicate keys (JSON.parse would silently keep only the last one)', async () => {
    const { readFileSync } = await import('node:fs');
    const { fileURLToPath } = await import('node:url');
    const text = readFileSync(fileURLToPath(new URL('./en.json', import.meta.url)), 'utf8');
    const keys = [...text.matchAll(/^\s*"([^"]+)":/gm)].map((m) => m[1]!);
    const dup = keys.filter((k, i) => keys.indexOf(k) !== i);
    expect(dup).toEqual([]);
  });
});
