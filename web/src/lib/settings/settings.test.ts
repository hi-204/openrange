import { describe, expect, it } from 'vitest';
import { exportAll, importAll, MemoryStore } from '../../features/trainer/store';
import { applyPreset, DEFAULTS, fromOnboarding, normalize, resolveDisplay } from './settings';
import { useSettings } from './useSettings';

describe('settings', () => {
  it('fills missing fields from the defaults (older saves keep working)', () => {
    const s = normalize({ mode: 'expert', display: { theme: 'dark' } });
    expect(s.mode).toBe('expert');
    expect(s.display.theme).toBe('dark');
    expect(s.display.deck).toBe(DEFAULTS.display.deck);
    expect(s.solver).toEqual(DEFAULTS.solver);
    expect(normalize(null)).toEqual(DEFAULTS);
  });

  it('onboarding sets the mode from experience', () => {
    expect(fromOnboarding(DEFAULTS, 'new', 'cash')).toMatchObject({ mode: 'guided', onboarded: true, interest: 'cash', coaching: { detail: 'simple' } });
    expect(fromOnboarding(DEFAULTS, 'basics', 'both').mode).toBe('guided');
    expect(fromOnboarding(DEFAULTS, 'experienced', 'tournament')).toMatchObject({ mode: 'expert', coaching: { detail: 'detailed', showMath: true } });
  });

  it('presets change presentation only', () => {
    const a = applyPreset(DEFAULTS, 'advanced');
    expect(a.mode).toBe('expert');
    // Grading-related and game settings are untouched.
    expect(a.game).toEqual(DEFAULTS.game);
    expect(a.solver).toEqual(DEFAULTS.solver);
  });

  it('resolves the theme and motion from the OS when asked to', () => {
    expect(resolveDisplay(DEFAULTS.display, true, false)).toEqual({ theme: 'dark', motion: 'normal' });
    expect(resolveDisplay(DEFAULTS.display, false, true)).toEqual({ theme: 'light', motion: 'off' });
    expect(resolveDisplay({ ...DEFAULTS.display, reduceMotion: 'off', animation: 'fast' }, false, true).motion).toBe('fast');
    expect(resolveDisplay({ ...DEFAULTS.display, theme: 'light' }, true, false).theme).toBe('light');
  });

  it('persists through the store and the backup export', async () => {
    const store = new MemoryStore();
    await useSettings.getState().load(store);
    await useSettings.getState().update((s) => ({ ...s, mode: 'expert', display: { ...s.display, felt: 'navy' } }), store);
    // A fresh load reads what was saved.
    await useSettings.getState().load(store);
    expect(useSettings.getState().settings.mode).toBe('expert');
    expect(useSettings.getState().settings.display.felt).toBe('navy');
    const copy = new MemoryStore();
    await importAll(copy, JSON.parse(JSON.stringify(await exportAll(store))));
    expect(normalize(await copy.appSettings()).display.felt).toBe('navy');
  });
});
