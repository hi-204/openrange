// Shared helpers for the repo's Node scripts. Windows-first: no shell strings, quoted paths
// are never needed because arguments are passed as arrays (D-008).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const isWindows = process.platform === 'win32';

/**
 * Run a program and stream its output. On Windows `npm` is a `.cmd` shim that Node can't
 * start without a shell, so when we were launched by npm we run its JS entry point with the
 * current Node instead (no shell, no argument concatenation).
 */
export function run(cmd, args, { cwd = ROOT, capture = false, allowFail = false } = {}) {
  const npmJs = process.env.npm_execpath;
  if (cmd === 'npm' && npmJs && npmJs.endsWith('.js')) {
    [cmd, args] = [process.execPath, [npmJs, ...args]];
  } else if (cmd === 'npm' && isWindows) {
    throw new Error('run this script through npm (for example `npm run check`)');
  }
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
    encoding: 'utf8',
  });
  if (res.error && !allowFail) throw res.error;
  if (res.status !== 0 && !allowFail) {
    const out = capture ? `\n${res.stdout ?? ''}${res.stderr ?? ''}` : '';
    throw new Error(`command failed (${res.status}): ${cmd} ${args.join(' ')}${out}`);
  }
  return res;
}

/** True if `cmd` can be started (used to give friendly "please install X" messages). */
export function hasCommand(cmd, versionArgs = ['--version']) {
  const res = spawnSync(cmd, versionArgs, { stdio: 'ignore', shell: false });
  return !res.error && res.status === 0;
}

function walk(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * Hash of every input that affects the WASM build. Line endings are normalised so a
 * Windows checkout (CRLF) and a Linux checkout (LF) produce the same hash.
 */
export function wasmSourceHash() {
  // Only crates compiled into the WASM; solver-cli changes don't affect it.
  const crateDirs = ['solver-core', 'solver-wasm'].map((c) => join(ROOT, 'crates', c));
  const files = [
    ...crateDirs.flatMap((d) => walk(d, [])).filter((f) => f.endsWith('.rs') || f.endsWith('Cargo.toml')),
    join(ROOT, 'Cargo.toml'),
    join(ROOT, 'Cargo.lock'),
    join(ROOT, 'rust-toolchain.toml'),
  ];
  const rel = (f) => relative(ROOT, f).split(sep).join('/');
  files.sort((a, b) => (rel(a) < rel(b) ? -1 : 1));
  const h = createHash('sha256');
  for (const f of files) {
    h.update(rel(f));
    h.update('\0');
    h.update(readFileSync(f, 'utf8').replace(/\r\n/g, '\n'));
    h.update('\0');
  }
  return h.digest('hex');
}

/** The exact wasm-bindgen version pinned in the workspace Cargo.toml (`=x.y.z`). */
export function pinnedWasmBindgenVersion() {
  const toml = readFileSync(join(ROOT, 'Cargo.toml'), 'utf8');
  const m = /^wasm-bindgen\s*=\s*"=([^"]+)"/m.exec(toml);
  if (!m) throw new Error('wasm-bindgen must be pinned as "=x.y.z" in Cargo.toml');
  return m[1];
}
