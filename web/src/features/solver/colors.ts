// Action colours from the Okabe–Ito palette, chosen to stay distinguishable with the common
// forms of colour blindness. Colour is never the only cue: every grid cell and table also
// shows action names and numbers.

const PASSIVE = { fold: '#56B4E9', check: '#009E73' };
// Aggressive actions, smallest size first.
const AGGRESSIVE = ['#F0E442', '#E69F00', '#D55E00', '#CC79A7', '#882255', '#661100'];

export function actionColors(actions: string[], aggressive: boolean[]): string[] {
  let k = 0;
  return actions.map((label, i) => {
    if (!aggressive[i]) return label === 'Fold' ? PASSIVE.fold : PASSIVE.check;
    return AGGRESSIVE[Math.min(k++, AGGRESSIVE.length - 1)]!;
  });
}
