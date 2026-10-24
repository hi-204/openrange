// Messages between the UI thread and the solver worker (docs/ARCHITECTURE.md §4).
// Every request carries an id; the worker answers with the same id.

export type WorkerRequest = { id: number; type: 'hello' };

export type HelloResult = { version: string; combos: number };

export type WorkerResponse =
  | { id: number; type: 'hello'; result: HelloResult }
  | { id: number; type: 'error'; message: string };
