// The hero's action panel for play mode: fold / check / call, preset sizes, all-in and a custom
// "raise to" (shared by quick play and sessions, D-090).

import { useState } from 'react';
import { t } from '../../lib/i18n';
import { legal, type GameState, type Move } from './engine';

export function HeroActions({ state, onMove }: { state: GameState; onMove: (m: Move) => void }) {
  const [raiseTo, setRaiseTo] = useState('');
  const l = legal(state);
  const hero = state.seats[state.toAct!]!;
  const pot = state.contributed.reduce((a, b) => a + b, 0);
  const sizes = l.minTo !== null ? (state.street === 'preflop' ? [l.minTo, state.currentBet * 3, state.currentBet * 2 + pot] : [0.33, 0.5, 0.75, 1].map((f) => state.currentBet + f * (pot + (l.call ?? 0)))) : [];
  const move = (m: Move) => {
    setRaiseTo('');
    onMove(m);
  };
  return (
    <section className="card space-y-3" data-testid="play-actions">
      <p className="text-sm font-medium">{t('play.yourMove', { cards: hero.cards.join(' ') })}</p>
      <div className="flex flex-wrap gap-2">
        {l.fold && (
          <button type="button" className="btn-secondary" onClick={() => move({ kind: 'fold' })}>
            {t('play.fold')}
          </button>
        )}
        {l.check && (
          <button type="button" className="btn-secondary" onClick={() => move({ kind: 'check' })}>
            {t('play.check')}
          </button>
        )}
        {l.call !== null && (
          <button type="button" className="btn-secondary" onClick={() => move({ kind: 'call' })}>
            {t('play.call', { amount: l.call.toFixed(1) })}
          </button>
        )}
        {l.minTo !== null &&
          [...new Set(sizes.map((x) => Math.min(l.maxTo!, Math.max(l.minTo!, Math.round(x * 2) / 2))))].map((to) => (
            <button key={to} type="button" className="btn-secondary" onClick={() => move({ kind: 'raise', to })}>
              {t(state.currentBet === 0 ? 'play.betTo' : 'play.raiseTo', { to: to.toFixed(1) })}
            </button>
          ))}
        {l.maxTo !== null && (
          <button type="button" className="btn-secondary" onClick={() => move({ kind: 'raise', to: l.maxTo! })}>
            {t('play.allIn', { to: l.maxTo.toFixed(1) })}
          </button>
        )}
      </div>
      {l.minTo !== null && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const to = Number(raiseTo);
            if (Number.isFinite(to)) move({ kind: 'raise', to });
          }}
        >
          <label className="text-sm">
            <span className="mb-1 block font-medium">{t('play.customTo', { min: l.minTo.toFixed(1), max: l.maxTo!.toFixed(1) })}</span>
            <input className="field w-28" type="number" step="0.5" min={l.minTo} max={l.maxTo!} value={raiseTo} onChange={(e) => setRaiseTo(e.target.value)} />
          </label>
          <button type="submit" className="btn-quiet" disabled={!raiseTo}>
            {t('play.custom')}
          </button>
        </form>
      )}
    </section>
  );
}
