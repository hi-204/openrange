// Subtle sound effects, synthesized with Web Audio (no audio files). Off by default; played only
// when Settings → Display → Sound effects is on.

import { useSettings } from '../settings/useSettings';

type Cue = 'deal' | 'good' | 'fine' | 'bad';

let ctx: AudioContext | null = null;

/** Short sine blips; frequencies and lengths per cue. */
const CUES: Record<Cue, { f: number[]; ms: number; gain: number }> = {
  deal: { f: [880], ms: 40, gain: 0.03 },
  good: { f: [660, 880], ms: 90, gain: 0.05 },
  fine: { f: [660], ms: 90, gain: 0.04 },
  bad: { f: [330, 262], ms: 120, gain: 0.05 },
};

export function play(cue: Cue) {
  if (!useSettings.getState().settings.display.sound || typeof AudioContext === 'undefined') return;
  try {
    ctx ??= new AudioContext();
    const c = CUES[cue];
    c.f.forEach((freq, i) => {
      const start = ctx!.currentTime + (i * c.ms) / 1000;
      const osc = ctx!.createOscillator();
      const g = ctx!.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      g.gain.setValueAtTime(c.gain, start);
      g.gain.exponentialRampToValueAtTime(0.0001, start + c.ms / 1000);
      osc.connect(g).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + c.ms / 1000 + 0.02);
    });
  } catch {
    // Audio unavailable: stay silent.
  }
}
