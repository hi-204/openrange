// App settings (docs/DESIGN.md §7): types, defaults, presets and how display settings are
// applied to the page. Persisted with the trainer data (Dexie, key "app") and in the backup.

export type Mode = 'guided' | 'expert';
export type Experience = 'new' | 'basics' | 'experienced';

export type AppSettings = {
  onboarded: boolean;
  experience: Experience;
  interest: 'cash' | 'tournament' | 'both';
  mode: Mode;
  display: {
    theme: 'system' | 'dark' | 'light';
    palette: 'studio' | 'okabe-ito';
    felt: 'green' | 'navy' | 'burgundy' | 'charcoal';
    deck: 'four' | 'two';
    cardBack: 'classic' | 'lattice' | 'plain';
    units: 'bb' | 'chips';
    animation: 'off' | 'fast' | 'normal';
    reduceMotion: 'system' | 'on' | 'off';
    textSize: 90 | 100 | 112 | 125;
    density: 'comfortable' | 'compact';
    sound: boolean;
  };
  training: {
    hints: boolean;
    timerSeconds: 0 | 10 | 20 | 30;
    /** Quick mode: move on by itself a moment after the feedback. */
    autoAdvance: boolean;
    srs: 'light' | 'normal' | 'intense';
  };
  coaching: { detail: 'simple' | 'standard' | 'detailed'; showMath: boolean; liveCoach: boolean };
  game: { tableSize: number; stack: number; gameType: 'cash' | 'tournament'; rake: { on: boolean; percent: number; capBb: number }; ante: number };
  solver: { algorithm: 'dcfr' | 'cfr+'; maxIterations: number; targetPct: number; memoryMb: number; simplify: boolean };
};

export const DEFAULTS: AppSettings = {
  onboarded: false,
  experience: 'new',
  interest: 'both',
  mode: 'guided',
  display: { theme: 'system', palette: 'studio', felt: 'green', deck: 'four', cardBack: 'classic', units: 'bb', animation: 'normal', reduceMotion: 'system', textSize: 100, density: 'comfortable', sound: false },
  training: { hints: true, timerSeconds: 0, autoAdvance: false, srs: 'normal' },
  coaching: { detail: 'standard', showMath: false, liveCoach: true },
  game: { tableSize: 6, stack: 100, gameType: 'cash', rake: { on: false, percent: 5, capBb: 3 }, ante: 0 },
  solver: { algorithm: 'dcfr', maxIterations: 1000, targetPct: 0.3, memoryMb: 1000, simplify: true },
};

export type Preset = 'beginner' | 'standard' | 'advanced';

/** Presets change how much is shown and how much help is offered, never what is graded. */
export function applyPreset(s: AppSettings, p: Preset): AppSettings {
  const base = { ...s, display: { ...s.display }, training: { ...s.training }, coaching: { ...s.coaching } };
  if (p === 'beginner') return { ...base, mode: 'guided', training: { ...base.training, hints: true, autoAdvance: false }, coaching: { ...base.coaching, detail: 'simple', showMath: false } };
  if (p === 'standard') return { ...base, mode: 'guided', training: { ...base.training, hints: true, autoAdvance: false }, coaching: { ...base.coaching, detail: 'standard', showMath: false } };
  return { ...base, mode: 'expert', display: { ...base.display, density: 'compact' }, training: { ...base.training, hints: false, autoAdvance: true }, coaching: { ...base.coaching, detail: 'detailed', showMath: true } };
}

/** Defaults set by the first-run choices. */
export function fromOnboarding(s: AppSettings, experience: Experience, interest: AppSettings['interest']): AppSettings {
  const preset: Preset = experience === 'new' ? 'beginner' : experience === 'basics' ? 'standard' : 'advanced';
  return { ...applyPreset(s, preset), experience, interest, onboarded: true };
}

/** Fill in anything missing (older saves) from the defaults, section by section. */
export function normalize(raw: unknown): AppSettings {
  const r = (raw ?? {}) as Partial<AppSettings>;
  return {
    ...DEFAULTS,
    ...r,
    display: { ...DEFAULTS.display, ...(r.display ?? {}) },
    training: { ...DEFAULTS.training, ...(r.training ?? {}) },
    coaching: { ...DEFAULTS.coaching, ...(r.coaching ?? {}) },
    game: { ...DEFAULTS.game, ...(r.game ?? {}), rake: { ...DEFAULTS.game.rake, ...(r.game?.rake ?? {}) } },
    solver: { ...DEFAULTS.solver, ...(r.solver ?? {}) },
  };
}

export type Resolved = { theme: 'dark' | 'light'; motion: 'off' | 'fast' | 'normal' };

export function resolveDisplay(d: AppSettings['display'], prefersDark: boolean, prefersReducedMotion: boolean): Resolved {
  const theme = d.theme === 'system' ? (prefersDark ? 'dark' : 'light') : d.theme;
  const reduce = d.reduceMotion === 'on' || (d.reduceMotion === 'system' && prefersReducedMotion);
  return { theme, motion: reduce ? 'off' : d.animation };
}

/** Put the display settings on <html> (data attributes read by tokens.css) and remember them
 * locally so the next load can apply them before the first paint. */
export function applyDisplay(d: AppSettings['display'], root: HTMLElement = document.documentElement) {
  const r = resolveDisplay(d, matchMedia('(prefers-color-scheme: dark)').matches, matchMedia('(prefers-reduced-motion: reduce)').matches);
  root.dataset.theme = r.theme;
  root.dataset.motion = r.motion;
  root.dataset.palette = d.palette;
  root.dataset.felt = d.felt;
  root.dataset.density = d.density;
  root.style.fontSize = `${d.textSize}%`;
  try {
    localStorage.setItem(DISPLAY_KEY, JSON.stringify(d));
  } catch {
    // Private mode or storage disabled: the display still applies for this session.
  }
}

export const DISPLAY_KEY = 'openrange.display';

/** Display settings saved by the last session (synchronous, for the first paint). */
export function lastDisplay(): AppSettings['display'] {
  try {
    return { ...DEFAULTS.display, ...(JSON.parse(localStorage.getItem(DISPLAY_KEY) ?? '{}') as Partial<AppSettings['display']>) };
  } catch {
    return DEFAULTS.display;
  }
}
