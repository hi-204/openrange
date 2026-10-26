import { describe, expect, it } from 'vitest';
import { cleanStack, diagnostics } from './diagnostics';

describe('diagnostics', () => {
  it('has the version, page without its query, mode and the error', () => {
    const text = diagnostics({ error: new TypeError('boom'), hash: '#/train/preflop?files=secret.json', mode: 'guided' });
    expect(text).toMatch(/^OpenRange diagnostics/);
    expect(text).toMatch(/version: \d+\.\d+\.\d+/);
    expect(text).toContain('page: #/train/preflop');
    expect(text).not.toContain('secret');
    expect(text).toContain('mode: guided');
    expect(text).toContain('error: TypeError: boom');
  });

  it('strips URLs and paths from stack lines', () => {
    const s = cleanStack('Error: x\n    at f (http://localhost:4173/assets/index-abc.js:1:200)\n    at g (file:///C:/Users/someone/app/main.js:3:4)');
    expect(s).toContain('index-abc.js:1:200');
    expect(s).toContain('main.js:3:4');
    expect(s).not.toContain('someone');
    expect(s).not.toContain('localhost');
  });
});
