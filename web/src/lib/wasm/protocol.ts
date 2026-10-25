// Messages between the UI thread and the solver worker (docs/ARCHITECTURE.md §4).
// Every request carries an id; the worker answers with the same id. Long runs also send
// `progress` messages with the request's id before the final answer.

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

/** Spot description sent to the solver (openrange.spot/1; amounts in big blinds). */
export type SpotJson = {
  board: string;
  pot: number;
  stack: number;
  ranges: { oop: string; ip: string };
  sizes: Record<string, { oop: { bet: string; raise: string }; ip: { bet: string; raise: string } }>;
  maxRaises: number | Record<string, number>;
  allInThreshold: number;
  rake?: { percent: number; capBb: number };
};

export type SolverInfo = {
  estimateBytes: number;
  hands: [string[], string[]];
  actionNodes: number;
  expandedNodes: number;
  storageEntries: number;
  /** Suit relabellings used to share work (1 = none). */
  symmetries: number;
  algorithm: string;
  /** Simplifications applied to fit the memory budget, in plain words. */
  abstraction: string[];
  /** The spot actually solved (after any simplification). */
  spot: SpotJson;
};

export type ExploitabilityReport = {
  iterations: number;
  chips: number;
  bb: number;
  pctPot: number;
  evBb: [number, number];
};

export type RunResult = ExploitabilityReport & { reason: 'target' | 'max' | 'paused'; elapsedMs: number };

export type NodeBase = {
  board: string[];
  pot: number;
  street: string;
  committed: [number, number];
  reach: [number[], number[]];
};

export type SolverNode = NodeBase &
  (
    | {
        kind: 'action';
        player: 0 | 1;
        actions: string[];
        aggressive: boolean[];
        /** [action][hand] average strategy of the acting player. */
        strategy: number[];
        /** [action][hand] EV in bb; null where the hand can't be here. */
        evBb: (number | null)[];
      }
    | { kind: 'chance'; cards: string[]; mirrors: string[][] }
    | { kind: 'fold'; folder: 0 | 1 }
    | { kind: 'showdown' }
  );

export type PushFoldSpotJson = { stacks: number[]; pusher: number; caller: number; ante: number; payouts: number[] };
export type PushFoldSide = { actions: string[]; strategy: number[][]; ev: (number | null)[][] };
export type PushFoldResult = {
  units: 'bb' | 'prize';
  iterations: number;
  exploitability: number;
  value: [number, number];
  classes: string[];
  pusher: PushFoldSide;
  caller: PushFoldSide;
};

/** Request payloads by type, and what each one resolves to. */
export type Calls = {
  hello: { args: Record<string, never>; result: HelloResult };
  parseRange: { args: { text: string }; result: ParsedRange };
  equity: { args: { request: EquityRequest }; result: EquityResult };
  estimateMemory: { args: { spot: SpotJson }; result: { bytes: number } };
  solverStart: { args: { spot: SpotJson; budgetBytes: number; allowAbstraction: boolean }; result: SolverInfo };
  solverRun: { args: { maxIterations: number; targetPct: number }; result: RunResult };
  solverPause: { args: Record<string, never>; result: Record<string, never> };
  solverNode: { args: { path: number[] }; result: SolverNode };
  pushFold: { args: { spot: PushFoldSpotJson }; result: PushFoldResult };
};

export type CallType = keyof Calls;

export type WorkerRequest = {
  [K in CallType]: { id: number; type: K } & Calls[K]['args'];
}[CallType];

export type WorkerResponse =
  | { id: number; type: 'ok'; result: unknown }
  | { id: number; type: 'progress'; progress: ExploitabilityReport & { elapsedMs: number } }
  | { id: number; type: 'error'; message: string };
