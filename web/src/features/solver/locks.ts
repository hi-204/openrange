// Villain-tendency presets for node-locking (D-076). Each turns the solved strategy at one
// node into a locked strategy by moving probability between actions, hand by hand, so the
// lock keeps the solved hand selection and only shifts frequencies.

export type Preset = 'asSolved' | 'foldMore' | 'callMore' | 'neverRaise' | 'betMore' | 'checkMore' | 'pure';

export type LockNode = { actions: string[]; aggressive: boolean[]; strategy: number[] };

const idx = (n: LockNode, re: RegExp) => n.actions.findIndex((a) => re.test(a));

/** Presets that make sense at this node (facing a bet, or first to act / checked to). */
export function presetsFor(n: LockNode): Preset[] {
  const fold = idx(n, /^Fold/) >= 0;
  const call = idx(n, /^Call/) >= 0;
  const check = idx(n, /^Check/) >= 0;
  const aggressive = n.aggressive.some(Boolean);
  const out: Preset[] = ['asSolved'];
  if (fold && call) out.push('foldMore', 'callMore');
  if (aggressive && (call || check)) out.push('neverRaise');
  if (check && aggressive) out.push('betMore', 'checkMore');
  out.push('pure');
  return out;
}

/**
 * The locked strategy `[action][hand]` for `hands` hands. `amount` (0–1) is the share of the
 * movable probability that moves; `action` is the target of the 'pure' preset.
 */
export function applyPreset(n: LockNode, hands: number, preset: Preset, amount: number, action = 0): number[] {
  const k = n.actions.length;
  const out = n.strategy.slice();
  const fold = idx(n, /^Fold/);
  const call = idx(n, /^Call/);
  const check = idx(n, /^Check/);
  const firstBet = n.aggressive.indexOf(true);
  const move = (h: number, from: number[], to: number, share: number) => {
    let moved = 0;
    for (const a of from) {
      const m = out[a * hands + h]! * share;
      out[a * hands + h]! -= m;
      moved += m;
    }
    out[to * hands + h]! += moved;
  };
  const all = Array.from({ length: k }, (_, a) => a);
  for (let h = 0; h < hands; h++) {
    switch (preset) {
      case 'asSolved':
        break;
      case 'foldMore':
        move(h, all.filter((a) => a !== fold), fold, amount);
        break;
      case 'callMore':
        move(h, all.filter((a) => a !== call), call, amount);
        break;
      case 'neverRaise':
        move(h, all.filter((a) => n.aggressive[a]), call >= 0 ? call : check, 1);
        break;
      case 'betMore':
        move(h, [check], firstBet, amount);
        break;
      case 'checkMore':
        move(h, all.filter((a) => n.aggressive[a]), check, amount);
        break;
      case 'pure':
        move(h, all.filter((a) => a !== action), action, 1);
        break;
    }
  }
  return out;
}

/** Overall frequency of each action, weighted by the acting player's reach. */
export function overall(strategy: number[], reach: number[], actions: number): number[] {
  const n = reach.length;
  const total = reach.reduce((s, w) => s + w, 0) || 1;
  return Array.from({ length: actions }, (_, a) => reach.reduce((s, w, h) => s + w * strategy[a * n + h]!, 0) / total);
}
