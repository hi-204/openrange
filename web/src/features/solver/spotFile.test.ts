import { describe, expect, it } from 'vitest';
import { parseSpotFile, spotFileText } from './spotFile';
import { PRESETS } from './spotForm';

describe('spot files', () => {
  it('round-trip every preset', () => {
    for (const f of Object.values(PRESETS)) expect(parseSpotFile(spotFileText(f))).toEqual({ form: f });
  });

  it('give a readable reason for bad files', () => {
    expect(parseSpotFile('nope')).toEqual({ error: 'not a JSON file' });
    expect(parseSpotFile('{"format":"x"}')).toEqual({ error: 'not an OpenRange spot file' });
    const bad = (patch: Record<string, unknown>) => JSON.stringify({ format: 'openrange.spot/1', spot: { ...PRESETS.river, ...patch } });
    expect(parseSpotFile(bad({ board: 'Qs Qs 7d' }))).toEqual({ error: 'the board repeats a card' });
    expect(parseSpotFile(bad({ board: 'Qs Jh' }))).toMatchObject({ error: expect.stringContaining('3 to 5 cards') });
    expect(parseSpotFile(bad({ pot: 10 }))).toMatchObject({ error: expect.stringContaining('"pot"') });
    expect(parseSpotFile(bad({ streets: { flop: PRESETS.river.streets.flop } }))).toMatchObject({ error: expect.stringContaining('sizes are incomplete') });
  });
});
