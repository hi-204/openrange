import type { SpotJson } from '../../lib/wasm/protocol';

export const STREETS = ['flop', 'turn', 'river'] as const;
export type StreetName = (typeof STREETS)[number];

export type StreetForm = { oopBet: string; oopRaise: string; ipBet: string; ipRaise: string; maxRaises: string };

export type Form = {
  board: string;
  pot: string;
  stack: string;
  oop: string;
  ip: string;
  streets: Record<StreetName, StreetForm>;
  allIn: string;
  rake: string;
  rakeCap: string;
  target: string;
  maxIterations: string;
  budgetMb: string;
  simplify: boolean;
};

const street = (oopBet: string, oopRaise: string, ipBet: string, ipRaise: string, maxRaises: string): StreetForm => ({
  oopBet,
  oopRaise,
  ipBet,
  ipRaise,
  maxRaises,
});

const common = { allIn: '67', rake: '0', rakeCap: '0', budgetMb: '1000', simplify: true };

// Example inputs the user can edit. They are ranges and tree settings typed into a form,
// not solver output.
export const PRESETS: Record<'river' | 'turn' | 'flop', Form> = {
  river: {
    ...common,
    board: 'Qs Jh 7d 4c 2s',
    pot: '10',
    stack: '90',
    oop: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 75s+, 64s+, 54s, ATo+, KTo+, QTo+, JTo',
    ip: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A5o+, K9o+, Q9o+, J9o+, T9o',
    streets: {
      flop: street('33', '100', '33', '100', '1'),
      turn: street('66', '100', '66', '100', '1'),
      river: street('33, 75, 150', '100', '33, 75, 150', '100', '2'),
    },
    target: '0.3',
    maxIterations: '2000',
  },
  turn: {
    ...common,
    board: 'Qs Jh 7d 4c',
    pot: '10',
    stack: '90',
    oop: 'TT+, AJs+, KQs, QJs, JTs, T9s, AQo+',
    ip: '99+, ATs+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
    streets: {
      flop: street('33', '100', '33', '100', '1'),
      turn: street('66', '100', '50, 100', '100', '1'),
      river: street('75', '', '75', '', '0'),
    },
    target: '0.5',
    maxIterations: '500',
  },
  flop: {
    ...common,
    board: 'Qs Jh 4d',
    pot: '6',
    stack: '97',
    oop: 'TT+, AJs+, KQs, AQo+',
    ip: '88+, ATs+, KJs+, QJs, JTs, AJo+',
    streets: {
      flop: street('33', '', '33', '', '0'),
      turn: street('66', '', '66', '', '0'),
      river: street('75', '', '75', '', '0'),
    },
    target: '1',
    maxIterations: '300',
  },
};

/** Streets that are part of a spot with this board (3 cards: all three; 5 cards: river only). */
export function activeStreets(board: string): StreetName[] {
  const cards = board.replace(/\s+/g, '').length / 2;
  const first = cards <= 3 ? 0 : cards === 4 ? 1 : 2;
  return STREETS.slice(first);
}

export function toSpot(f: Form): SpotJson {
  const sizes: SpotJson['sizes'] = {};
  const maxRaises: Record<string, number> = {};
  for (const s of STREETS) {
    const st = f.streets[s];
    sizes[s] = { oop: { bet: st.oopBet, raise: st.oopRaise }, ip: { bet: st.ipBet, raise: st.ipRaise } };
    maxRaises[s] = Number(st.maxRaises) || 0;
  }
  return {
    board: f.board,
    pot: Number(f.pot),
    stack: Number(f.stack),
    ranges: { oop: f.oop, ip: f.ip },
    sizes,
    maxRaises,
    allInThreshold: Number(f.allIn) / 100,
    rake: { percent: Number(f.rake), capBb: Number(f.rakeCap) },
  };
}
