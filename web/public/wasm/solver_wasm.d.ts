/* tslint:disable */
/* eslint-disable */

/**
 * A postflop solving session. Created only if the memory estimate fits the budget.
 */
export class Solver {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * `{iterations, chips, bb, pctPot, evBb: [oop, ip]}`
     */
    exploitability(): string;
    /**
     * Hex fingerprint of the solver state; equal across native and WASM builds for the same
     * inputs (checked against the regression goldens).
     */
    fingerprint(): string;
    /**
     * `{estimateBytes, hands: [[combo]...], actionNodes, storageEntries, algorithm}`
     */
    info(): string;
    /**
     * `allowAbstraction`: if the spot doesn't fit the budget, simplify the tree (and report
     * how in `info().abstraction`) instead of refusing.
     */
    constructor(spot_json: string, budget_bytes: number, allow_abstraction: boolean);
    /**
     * Node reached by `pathJson` (array of action/card indices).
     */
    node(path_json: string): string;
    /**
     * Run `n` more iterations; returns the total.
     */
    step(n: number): number;
}

/**
 * Outs against a known hand on a flop or turn: which next cards put the hero ahead or tie.
 */
export function countOuts(request_json: string): string;

/**
 * M0 smoke test: number of two-card combos, computed in Rust.
 */
export function countStartingCombos(): number;

/**
 * All-in equity. Request JSON: `{ranges: [string], board, dead, mode, samples, seed}`;
 * see `api::equity` for the response shape.
 */
export function equity(request_json: string): string;

/**
 * Memory a spot would need, without allocating it: `{bytes}`. Throws on a bad spot.
 */
export function estimateMemory(spot_json: string): string;

/**
 * Evaluate 5 to 7 cards: category, comparable strength and the best five cards.
 */
export function evaluateHand(cards: string): string;

/**
 * ICM prize equity of each stack for a payout list (Malmuth–Harville).
 */
export function icm(request_json: string): string;

/**
 * Load the exact combo-pair equities (`data/equity/preflop-pairs.json` text) once.
 */
export function loadPairs(json: string): string;

export function pairsLoaded(): boolean;

/**
 * Parse a range string. Returns JSON: `{ok, canonical, combos, weights[1326]}` or
 * `{ok: false, error}`.
 */
export function parseRange(text: string): string;

/**
 * Hero hand (combo or class) against a per-class continuing range, with exact card removal:
 * the villain's continue probability and the hero's equity against the continuing hands.
 * Needs `loadPairs` first.
 */
export function preflopMatchup(json: string): string;

/**
 * Exact heads-up push/fold: `{stacks, pusher, caller, ante, payouts}` (empty payouts = chip
 * EV). Needs `loadPairs` first.
 */
export function pushFold(spot_json: string): string;

/**
 * solver-core version string.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_solver_free: (a: number, b: number) => void;
    readonly countOuts: (a: number, b: number) => [number, number];
    readonly countStartingCombos: () => number;
    readonly equity: (a: number, b: number) => [number, number];
    readonly estimateMemory: (a: number, b: number) => [number, number, number, number];
    readonly evaluateHand: (a: number, b: number) => [number, number];
    readonly icm: (a: number, b: number) => [number, number];
    readonly loadPairs: (a: number, b: number) => [number, number, number, number];
    readonly pairsLoaded: () => number;
    readonly parseRange: (a: number, b: number) => [number, number];
    readonly preflopMatchup: (a: number, b: number) => [number, number, number, number];
    readonly pushFold: (a: number, b: number) => [number, number, number, number];
    readonly solver_exploitability: (a: number) => [number, number];
    readonly solver_fingerprint: (a: number) => [number, number];
    readonly solver_info: (a: number) => [number, number];
    readonly solver_new: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly solver_node: (a: number, b: number, c: number) => [number, number, number, number];
    readonly solver_step: (a: number, b: number) => number;
    readonly version: () => [number, number];
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
