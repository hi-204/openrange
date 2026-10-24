import type { CallType, Calls, WorkerRequest, WorkerResponse } from './protocol';

type Pending = { resolve: (r: unknown) => void; reject: (e: Error) => void };

/**
 * Talks to the solver worker. All solver work happens off the UI thread. `cancel()` stops
 * whatever is running by terminating the worker; the next call starts a fresh one.
 */
export class SolverClient {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  private ensureWorker(): Worker {
    if (this.worker) return this.worker;
    const w = new Worker(new URL('../../workers/solver.worker.ts', import.meta.url), { type: 'module' });
    w.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else p.resolve(msg.result);
    });
    w.addEventListener('error', (e) => this.failAll(new Error(e.message || 'the solver worker failed to start')));
    this.worker = w;
    return w;
  }

  private failAll(err: Error) {
    for (const p of this.pending.values()) p.reject(err);
    this.pending.clear();
  }

  call<K extends CallType>(type: K, args: Calls[K]['args']): Promise<Calls[K]['result']> {
    const id = this.nextId++;
    const req = { id, type, ...args } as WorkerRequest;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (r: unknown) => void, reject });
      this.ensureWorker().postMessage(req);
    });
  }

  cancel() {
    this.worker?.terminate();
    this.worker = null;
    this.failAll(new CancelledError());
  }
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

let shared: SolverClient | null = null;
export function solverClient(): SolverClient {
  shared ??= new SolverClient();
  return shared;
}
