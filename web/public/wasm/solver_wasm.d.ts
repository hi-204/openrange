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
 * Parse a range string. Returns JSON: `{ok, canonical, combos, weights[1326]}` or
 * `{ok: false, error}`.
 */
export function parseRange(text: string): string;

/**
 * solver-core version string.
 */
export function version(): string;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_solver_free: (a: number, b: number) => void;
    readonly countStartingCombos: () => number;
    readonly equity: (a: number, b: number) => [number, number];
    readonly estimateMemory: (a: number, b: number) => [number, number, number, number];
    readonly parseRange: (a: number, b: number) => [number, number];
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
