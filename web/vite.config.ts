/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Production builds get a strict Content-Security-Policy so the app physically cannot talk to
// another origin (principle 6: offline and private). Dev is exempt because Vite's HMR needs
// inline scripts and a websocket.
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function contentSecurityPolicy(): Plugin {
  return {
    name: 'openrange-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<meta charset="UTF-8" />',
        `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), contentSecurityPolicy()],
  worker: { format: 'es' },
  // Never inline fonts as data: URLs: the CSP allows fonts from 'self' only (small font subsets
  // were inlined and blocked).
  build: { assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  server: { port: Number(process.env.PORT) || 5173 },
  preview: { port: 4173 },
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
    // Several tests solve spots or enumerate boards; in a parallel run they compete for the
    // CPU. 5 s (the default) was too tight (D-068).
    testTimeout: 30_000,
  },
});
