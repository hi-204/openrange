import type { HelloResult, WorkerRequest, WorkerResponse } from './protocol';

type Pending = { resolve: (r: HelloResult) => void; reject: (e: Error) => void };

/** Talks to the solver worker. All solver work happens off the UI thread. */
export class SolverClient {
  private worker: Worker;
  private nextId = 1;
  private pending = new Map<number, Pending>();

  constructor() {
    this.worker = new Worker(new URL('../../workers/solver.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.addEventListener('message', (e: MessageEvent<WorkerResponse>) => {
      const msg = e.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.type === 'error') p.reject(new Error(msg.message));
      else p.resolve(msg.result);
    });
    this.worker.addEventListener('error', (e) => {
      const err = new Error(e.message || 'the solver worker failed to start');
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    });
  }

  hello(): Promise<HelloResult> {
    const id = this.nextId++;
    const req: WorkerRequest = { id, type: 'hello' };
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(req);
    });
  }
}

let shared: SolverClient | null = null;
export function solverClient(): SolverClient {
  shared ??= new SolverClient();
  return shared;
}
