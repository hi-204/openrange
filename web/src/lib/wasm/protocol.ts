// Messages between the UI thread and the solver worker (docs/ARCHITECTURE.md §4).
// Every request carries an id; the worker answers with the same id.

export type HelloResult = { version: string; combos: number };

export type ParsedRange =
  | { ok: true; canonical: string; combos: number; weights: number[] }
  | { ok: false; error: string };

export type EquityMode = 'auto' | 'exact' | 'montecarlo';

export type EquityRequest = {
  ranges: string[];
  board: string;
  dead: string;
  mode: EquityMode;
  samples?: number;
  seed?: number;
};

export type ComboEquity = { combo: string; weight: number; equity: number };

export type EquityResult =
  | {
      ok: true;
      method: 'exact';
      runouts: number;
      players: { equity: number; tie: number; perCombo: ComboEquity[] }[];
    }
  | {
      ok: true;
      method: 'montecarlo';
      samples: number;
      seed: number;
      players: { equity: number; win: number; tie: number; stdError: number }[];
    }
  | { ok: false; error: string };

/** Request payloads by type, and what each one resolves to. */
export type Calls = {
  hello: { args: Record<string, never>; result: HelloResult };
  parseRange: { args: { text: string }; result: ParsedRange };
  equity: { args: { request: EquityRequest }; result: EquityResult };
};

export type CallType = keyof Calls;

export type WorkerRequest = {
  [K in CallType]: { id: number; type: K } & Calls[K]['args'];
}[CallType];

export type WorkerResponse =
  | { id: number; type: 'ok'; result: unknown }
  | { id: number; type: 'error'; message: string };
