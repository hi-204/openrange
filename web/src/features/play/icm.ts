// ICM-aware coaching in tournament sessions (D-090): when a hand reaches exactly the heads-up
// push/fold spot (folded to the small blind, or the big blind facing the small blind's shove) and
// every player left is at this table, the push/fold engine solves it with the remaining payouts.

import { cellName, cellOf } from '../../lib/poker/hands';
import type { PushFoldResult, PushFoldSpotJson } from '../../lib/wasm/protocol';
import type { GameState } from './engine';
import { remainingPayouts, type Session } from './session';

export type IcmReference = { role: 'shove' | 'call'; actions: [string, string]; ev: [number, number]; strategy: [number, number]; best: 0 | 1; pool: number } | { reason: string };

export async function icmReference(state: GameState, session: Session, stacks: number[], ante: number, solve: (spot: PushFoldSpotJson) => Promise<PushFoldResult>): Promise<IcmReference> {
  if (session.format.kind === 'cash') return { reason: 'cash game: no prize money' };
  if (session.field.length) return { reason: 'other tables are still running: ICM needs every player left' };
  if (state.street !== 'preflop' || state.toAct === null) return { reason: 'push/fold applies to preflop decisions only' };
  const hero = state.toAct;
  const seat = state.seats[hero]!;
  const acts = state.history.filter((a) => a.kind !== 'post');
  const sb = state.seats.findIndex((p) => p.position === 'SB' || (state.seats.length === 2 && p.position === 'BTN'));
  const bb = state.seats.findIndex((p) => p.position === 'BB');
  let role: 'shove' | 'call';
  if (hero === sb && acts.every((a) => a.kind === 'fold')) role = 'shove';
  else if (hero === bb && acts.filter((a) => a.kind !== 'fold').length === 1 && acts.some((a) => a.kind === 'raise' && a.allIn && a.player === state.seats[sb]!.name)) role = 'call';
  else return { reason: 'only "folded to the small blind" and "big blind facing the small blind\'s shove" have a push/fold reference' };
  const payouts = remainingPayouts(session);
  const r = await solve({ stacks, pusher: sb, caller: bb, ante, payouts });
  const k = r.classes.indexOf(cellName(cellOf(seat.cards.join('')).index));
  if (k < 0) return { reason: 'hand not found in the push/fold result' };
  const side = role === 'shove' ? r.pusher : r.caller;
  const ev: [number, number] = [side.ev[k]![0]!, side.ev[k]![1]!];
  return { role, actions: role === 'shove' ? ['Fold', 'Shove'] : ['Fold', 'Call'], ev, strategy: [side.strategy[k]![0]!, side.strategy[k]![1]!], best: ev[1] >= ev[0] ? 1 : 0, pool: payouts.reduce((a, b) => a + b, 0) };
}
