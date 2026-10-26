// Builds a self-contained release (D-083): release/openrange-<version>/ with the built app, a
// dependency-free local server (serve.mjs, 127.0.0.1 only), a double-click start.cmd for
// Windows and START-HERE.txt; then zips it. Only Node is needed to run the result.
// Usage: npm run release
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, run } from './lib/repo.mjs';

const { version } = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
const name = `openrange-${version}`;
const out = join(ROOT, 'release', name);

console.log(`release: building ${name}…`);
run('npm', ['--workspace', 'web', 'run', 'build']);
if (!existsSync(join(ROOT, 'web', 'dist', 'sw.js'))) throw new Error('the build has no service worker');

try {
  rmSync(out, { recursive: true, force: true });
} catch (e) {
  // Windows refuses while a server started from the old release is still running there.
  if (e.code !== 'EPERM' && e.code !== 'EBUSY') throw e;
  console.error(`release: can't replace release/${name}/: close any OpenRange window started from it (start.cmd or serve.mjs) and try again.`);
  process.exit(1);
}
mkdirSync(out, { recursive: true });
cpSync(join(ROOT, 'web', 'dist'), join(out, 'app'), { recursive: true });
for (const f of ['LICENSE', 'NOTICE']) cpSync(join(ROOT, f), join(out, f));
cpSync(join(ROOT, 'docs', 'USER_GUIDE.md'), join(out, 'USER_GUIDE.md'));
cpSync(join(ROOT, 'docs', 'KNOWN_LIMITS.md'), join(out, 'KNOWN_LIMITS.md'));
cpSync(join(ROOT, 'docs', 'THIRD_PARTY_LICENSES.md'), join(out, 'THIRD_PARTY_LICENSES.md'));

writeFileSync(
  join(out, 'serve.mjs'),
  `// OpenRange ${version}: serves ./app on this computer only (127.0.0.1). No dependencies.
// Usage: node serve.mjs [--port 8080] [--open]
import { createServer, get } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { exec } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), 'app');
const args = process.argv.slice(2);
const port = Number(args[args.indexOf('--port') + 1]) || Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.wasm': 'application/wasm', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff',
  '.ttf': 'font/ttf', '.ts': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
};

const server = createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
    const file = normalize(join(root, path.endsWith('/') ? path + 'index.html' : path));
    if (!file.startsWith(root + sep) && file !== root) throw Object.assign(new Error('outside'), { code: 'ENOENT' });
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
    res.end(body);
  } catch (e) {
    res.writeHead(e.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'text/plain' });
    res.end(e.code === 'ENOENT' ? 'Not found' : 'Error');
  }
});
const url = 'http://localhost:' + port + '/';
const open = () => args.includes('--open') && exec(process.platform === 'win32' ? 'start "" "' + url + '"' : (process.platform === 'darwin' ? 'open ' : 'xdg-open ') + url);

server.on('error', (e) => {
  if (e.code !== 'EADDRINUSE') throw e;
  // Something already listens on the port: if it's OpenRange (started earlier), just open it.
  get('http://127.0.0.1:' + port + '/manifest.webmanifest', (r) => {
    let body = '';
    r.on('data', (c) => (body += c));
    r.on('end', () => {
      if (!body.includes('OpenRange')) return busy();
      console.log('OpenRange is already running at ' + url + ' (opening it).');
      open();
    });
  }).on('error', busy);
});
function busy() {
  console.log('Port ' + port + ' is used by another program. Close it, or start OpenRange on another port:');
  console.log('  node serve.mjs --open --port 8090');
  console.log('Progress is saved per address, so on another port OpenRange starts empty');
  console.log('(Settings > Data: Export, then Import, moves it).');
  process.exitCode = 2;
}

server.listen(port, '127.0.0.1', () => {
  console.log('OpenRange ${version} is running at ' + url + '  (close this window or press Ctrl+C to stop)');
  open();
});
`,
);

writeFileSync(
  join(out, 'start.cmd'),
  [
    '@echo off',
    `rem OpenRange ${version}: starts the local server and opens your browser.`,
    'where node >nul 2>nul',
    'if errorlevel 1 (',
    '  echo Node.js is needed: install the LTS version from https://nodejs.org and try again.',
    '  pause',
    '  exit /b 1',
    ')',
    'node "%~dp0serve.mjs" --open',
    'if errorlevel 1 pause',
    '',
  ].join('\r\n'),
);

writeFileSync(
  join(out, 'START-HERE.txt'),
  `OpenRange ${version}: an offline No-Limit Hold'em study suite
=============================================================

1. Install Node.js (version 22 or newer) from https://nodejs.org if you don't have it.
2. Windows: double-click start.cmd. Elsewhere: run  node serve.mjs --open  in this folder.
3. Your browser opens http://localhost:8080. Keep the window open while you use OpenRange.

After the first visit OpenRange also works without a network, and you can install it as an
app from your browser's menu. Everything stays on this computer: no accounts, no telemetry.

Study tool only: OpenRange does not read your screen, show overlays or connect to any poker
site. Use it before and after you play, never during.

USER_GUIDE.md explains every page; KNOWN_LIMITS.md lists what is approximate.
License: MIT (LICENSE, NOTICE); third-party packages in THIRD_PARTY_LICENSES.md.
`.replace(/\n/g, '\r\n'),
);

// Zip it (bsdtar ships with Windows 10+ and most other systems).
const zip = join(ROOT, 'release', `${name}.zip`);
rmSync(zip, { force: true });
// On Windows use its own tar.exe: Git's GNU tar may come first on the PATH and can't write zips.
const winTar = 'C:/Windows/System32/tar.exe';
const tar = process.platform === 'win32' && existsSync(winTar) ? winTar : 'tar';
try {
  run(tar, ['-a', '-c', '-f', zip, '-C', join(ROOT, 'release'), name]);
  console.log(`release: wrote release/${name}/ and release/${name}.zip`);
} catch {
  console.log(`release: wrote release/${name}/ (no zip: tar wasn't available)`);
}
