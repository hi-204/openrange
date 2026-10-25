// Spots for "drill this spot". Ranges and bet sizes are example inputs (the same ones the
// solver page offers); the strategies are solved in the browser. Ranges are written as hand
// classes, so they are suit-symmetric (required by the card mapping, D-051).

import type { SpotJson } from '../../../lib/wasm/protocol';
import { PRESETS, toSpot } from '../../solver/spotForm';

export type DrillSpot = { id: string; street: 'flop' | 'turn' | 'river'; spot: SpotJson; target: number; maxIterations: number; slow?: boolean };

export const DRILL_SPOTS: DrillSpot[] = [
  { id: 'river-qj742', street: 'river', spot: toSpot(PRESETS.river), target: 0.3, maxIterations: 2000 },
  { id: 'river-k9472', street: 'river', spot: { ...toSpot(PRESETS.river), board: 'Kh 9h 4h 7c 2d' }, target: 0.3, maxIterations: 2000 },
  { id: 'turn-qj74', street: 'turn', spot: toSpot(PRESETS.turn), target: 0.5, maxIterations: 500 },
  { id: 'turn-kt63', street: 'turn', spot: { ...toSpot(PRESETS.turn), board: 'Kh Th 6h 3s' }, target: 0.5, maxIterations: 500 },
  { id: 'flop-qj4', street: 'flop', spot: toSpot(PRESETS.flop), target: 1, maxIterations: 300, slow: true },
];
