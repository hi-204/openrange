import type { WorkerRequest, WorkerResponse } from '../lib/wasm/protocol';

// Types come from the wasm-bindgen output; the module itself is loaded at runtime from
// /wasm/ (it lives in public/ so the app runs without Rust installed, see D-009).
type SolverWasm = typeof import('../../public/wasm/solver_wasm');

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

self.addEventListener('message', async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    const wasm = await loadWasm();
    switch (req.type) {
      case 'hello':
        reply({
          id: req.id,
          type: 'hello',
          result: { version: wasm.version(), combos: wasm.countStartingCombos() },
        });
        break;
    }
  } catch (err) {
    reply({ id: req.id, type: 'error', message: err instanceof Error ? err.message : String(err) });
  }
});
