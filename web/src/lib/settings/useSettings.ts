// The app's settings in a small Zustand store: loaded once from the trainer database, saved on
// every change, display settings applied to <html> immediately.

import { create } from 'zustand';
import type { TrainerStore } from '../../features/trainer/store';
import { trainerStore } from '../../features/trainer/store';
import { applyDisplay, DEFAULTS, lastDisplay, normalize, type AppSettings } from './settings';

type State = {
  settings: AppSettings;
  loaded: boolean;
  load: (store?: TrainerStore) => Promise<void>;
  update: (f: (s: AppSettings) => AppSettings, store?: TrainerStore) => Promise<void>;
};

export const useSettings = create<State>((set, get) => ({
  // Until the database answers, use the display remembered from last time (no flash).
  settings: { ...DEFAULTS, display: typeof localStorage === 'undefined' ? DEFAULTS.display : lastDisplay() },
  loaded: false,
  load: async (store = trainerStore()) => {
    const s = normalize(await store.appSettings());
    set({ settings: s, loaded: true });
    if (typeof document !== 'undefined') applyDisplay(s.display);
  },
  update: async (f, store = trainerStore()) => {
    const s = normalize(f(get().settings));
    set({ settings: s });
    if (typeof document !== 'undefined') applyDisplay(s.display);
    await store.putAppSettings(s);
  },
}));
