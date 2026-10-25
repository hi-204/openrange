// Review references for imported hands, against the real chart files.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { ChartFile } from '../../lib/provenance/types';
import { parseHand } from './handHistory';
import { GG, STARS } from './samples';
import { cashFileFor, preflopSpot, reviewHand } from './reviewHand';

const load = (f: string) => JSON.parse(readFileSync(fileURLToPath(new URL(`../../../public/data/charts/${f}`, import.meta.url)), 'utf8')) as ChartFile;
const docs = new Map(['cash-6max-100bb.json', 'cash-6max-20bb.json', 'pushfold-hu.json'].map((f) => [f, load(f)]));

const HU = `PokerStars Hand #100000000003:  Hold'em No Limit (10/20) - 2026/10/25 22:00:00 ET
Table 'Sample III' 2-max Seat #1 is the button
Seat 1: Hero (200 in chips)
Seat 2: Golf (240 in chips)
Hero: posts small blind 10
Golf: posts big blind 20
*** HOLE CARDS ***
Dealt to Hero [Kc 7d]
Hero: raises 180 to 200 and is all-in
Golf: folds
Uncalled bet (180) returned to Hero
Hero collected 40 from pot
*** SUMMARY ***
Total pot 40 | Rake 0
`;

describe('review references', () => {
  it('picks the cash chart for the stack, within a quarter', () => {
    expect(cashFileFor(100)).toBe('cash-6max-100bb.json');
    expect(cashFileFor(118)).toBe('cash-6max-100bb.json');
    expect(cashFileFor(140)).toBeNull();
    expect(cashFileFor(22)).toBe('cash-6max-20bb.json');
  });

  it('PokerStars sample: CO first in at 100 bb is a practice reference; postflop is not graded', () => {
    const h = parseHand(STARS);
    const d = reviewHand(h, docs);
    expect(d[0]).toMatchObject({ status: 'practice', ref: { chart: 'first-in-CO', file: 'cash-6max-100bb.json' } });
    expect(d[0]!.actions![d[0]!.chosen!]).toMatch(/^Raise/);
    expect(d[0]!.strategy).toHaveLength(2);
    // AKo opens from the cutoff in the chart: the raise is the model's play.
    expect(d[0]!.grade?.category).toBe('best');
    for (const x of d.slice(1)) {
      expect(x.status).toBe('none');
      expect(x.reason).toMatch(/postflop/);
    }
  });

  it('GGPoker sample (3 players at 100 bb): button first in, then facing a 3-bet from the big blind', () => {
    const h = parseHand(GG);
    const d = reviewHand(h, docs);
    expect(d[0]!.ref?.chart).toBe('first-in-BTN');
    expect(d[1]!.ref?.chart).toBe('vs-3bet-BTN-vs-BB');
    expect(d[1]!.actions![d[1]!.chosen!]).toBe('Call');
  });

  it('heads-up at 10 bb: the small-blind shove is graded against the exact chart', () => {
    const h = parseHand(HU);
    expect(h.seats.map((s) => s.position)).toEqual(['BTN', 'BB']);
    const d = reviewHand(h, docs);
    expect(d[0]).toMatchObject({ status: 'graded', ref: { file: 'pushfold-hu.json', chart: 'sb-shove-10' } });
    expect(d[0]!.actions![d[0]!.chosen!]).toBe('All-in');
    expect(d[0]!.grade).toBeDefined();
  });

  it('explains when there is no reference', () => {
    const h = parseHand(STARS);
    // Pretend everyone had 150 bb: no chart that deep.
    const deep = { ...h, seats: h.seats.map((s) => ({ ...s, stack: 150 })) };
    const k = deep.actions.findIndex((a) => a.player === 'Hero' && a.kind === 'raise');
    expect(preflopSpot(deep, k)).toEqual({ reason: 'effective stack 150 bb: charts exist for 20, 40, 60 and 100 bb' });
  });
});
