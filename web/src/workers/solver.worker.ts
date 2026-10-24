import type { ExploitabilityReport, WorkerRequest, WorkerResponse } from '../lib/wasm/protocol';

// Types come from the wasm-bindgen output; the module itself is loaded at runtime from
// /wasm/ (it lives in public/ so the app runs without Rust installed, see D-009).
type SolverWasm = typeof import('../../public/wasm/solver_wasm');
type WasmSolver = InstanceType<SolverWasm['Solver']>;

let loaded: Promise<SolverWasm> | null = null;

function loadWasm(): Promise<SolverWasm> {
  loaded ??= (async () => {
    const url = new URL(`${import.meta.env.BASE_URL}wasm/solver_wasm.js`, self.location.origin);
    const mod = (await import(/* @vite-ignore */ url.href)) as SolverWasm;
    await mod.default(); // fetches solver_wasm_bg.wasm next to the JS file
    return mod;
  })();
  return loaded;
}

function reply(msg: WorkerResponse) {
  self.postMessage(msg);
}

// One solving session per worker. Each UI view that solves owns its own worker.
let session: WasmSolver | null = null;
let paused = false;

/** Let queued messages (e.g. pause) run between chunks of work. */
const yieldToEvents = () => new Promise<void>((r) => setTimeout(r, 0));

async function run(id: number, maxIterations: number, targetPct: number) {
  if (!session) throw new Error('no spot loaded');
  const s = session;
  paused = false;
  const start = performance.now();
  let chunk = 5;
  let lastReport = 0;
  let report = JSON.parse(s.exploitability()) as ExploitabilityReport;
  for (;;) {
    if (report.pctPot <= targetPct) return { ...report, reason: 'target', elapsedMs: performance.now() - start };
    if (report.iterations >= maxIterations) return { ...report, reason: 'max', elapsedMs: performance.now() - start };
    if (paused) return { ...report, reason: 'paused', elapsedMs: performance.now() - start };
    // Size chunks to ~50 ms so pause and progress stay responsive.
    const t0 = performance.now();
    const n = Math.min(chunk, maxIterations - report.iterations);
    s.step(n);
    const dt = performance.now() - t0;
    chunk = Math.max(1, Math.min(1000, Math.round((n * 50) / Math.max(dt, 1))));
    const now = performance.now();
    // Exploitability costs about one iteration; measure it a few times a second.
    if (now - lastReport > 400 || report.iterations + n >= maxIterations) {
      report = JSON.parse(s.exploitability()) as ExploitabilityReport;
      lastReport = now;
      reply({ id, type: 'progress', progress: { ...report, elapsedMs: now - start } });
    } else {
      report = { ...report, iterations: report.iterations + n };
    }
    await yieldToEvents();
  }
}

async function handle(wasm: SolverWasm, req: WorkerRequest): Promise<unknown> {
  switch (req.type) {
    case 'hello':
      return { version: wasm.version(), combos: wasm.countStartingCombos() };
    case 'parseRange':
      return JSON.parse(wasm.parseRange(req.text));
    case 'equity':
      return JSON.parse(wasm.equity(JSON.stringify(req.request)));
    case 'estimateMemory':
      return JSON.parse(wasm.estimateMemory(JSON.stringify(req.spot)));
    case 'solverStart':
      session?.free();
      session = null;
      session = new wasm.Solver(JSON.stringify(req.spot), req.budgetBytes);
      return JSON.parse(session.info());
    case 'solverRun':
      return run(req.id, req.maxIterations, req.targetPct);
    case 'solverPause':
      paused = true;
      return {};
    case 'solverNode':
      if (!session) throw new Error('no spot loaded');
      return JSON.parse(session.node(JSON.stringify(req.path)));
  }
}

self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    const wasm = await loadWasm();
    reply({ id: req.id, type: 'ok', result: await handle(wasm, req) });
  } catch (err) {
    reply({ id: req.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});
