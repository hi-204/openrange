import { describe, expect, it } from 'vitest';
import { t } from './index';

describe('t()', () => {
  it('fills placeholders', () => {
    expect(t('status.ready', { version: '1.2.3' })).toBe(
      'Solver core v1.2.3 is running in a background worker.',
    );
  });

  it('leaves unknown placeholders visible instead of hiding them', () => {
    expect(t('status.ready')).toContain('{version}');
  });
});
