// `{{calc …}}` in lessons (D-059): numbers in lesson text are computed, not typed. A tiny
// recursive-descent evaluator for numbers, + - * / and parentheses (no names, no eval()).

export type CalcFormat = 'pct' | 'pct1' | 'int' | 'dec1' | 'dec2' | 'bb' | 'ratio';

export function evaluate(expr: string): number {
  let i = 0;
  const s = expr.replace(/\s+/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-');
  const fail = (msg: string): never => {
    throw new Error(`calc "${expr}": ${msg}`);
  };
  const number = (): number => {
    const m = /^\d+(\.\d+)?/.exec(s.slice(i));
    if (!m) return fail(`expected a number at "${s.slice(i)}"`);
    i += m[0].length;
    return Number(m[0]);
  };
  const factor = (): number => {
    if (s[i] === '-') {
      i++;
      return -factor();
    }
    if (s[i] === '(') {
      i++;
      const v = sum();
      if (s[i] !== ')') fail('missing ")"');
      i++;
      return v;
    }
    return number();
  };
  const product = (): number => {
    let v = factor();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++];
      const r = factor();
      if (op === '/' && r === 0) fail('division by zero');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const sum = (): number => {
    let v = product();
    while (s[i] === '+' || s[i] === '-') {
      const op = s[i++];
      const r = product();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  if (!s) fail('empty expression');
  const v = sum();
  if (i !== s.length) fail(`unexpected "${s.slice(i)}"`);
  if (!Number.isFinite(v)) fail('not a finite number');
  return v;
}

export function format(x: number, f: CalcFormat): string {
  switch (f) {
    case 'pct':
      return `${(x * 100).toFixed(0)}%`;
    case 'pct1':
      return `${(x * 100).toFixed(1)}%`;
    case 'int':
      return Math.round(x).toLocaleString('en-US');
    case 'dec1':
      return x.toFixed(1);
    case 'dec2':
      return x.toFixed(2);
    case 'bb':
      return `${x.toFixed(2)} bb`;
    case 'ratio':
      return `${x.toFixed(1)} to 1`;
  }
}

const FORMATS = new Set<CalcFormat>(['pct', 'pct1', 'int', 'dec1', 'dec2', 'bb', 'ratio']);

/** Parse the inside of `{{calc …}}`: "expr | format [| show]". */
export function parseCalc(body: string): { expr: string; format: CalcFormat; show: boolean } {
  // Inside a Markdown table the pipe must be written as \|.
  const parts = body.replace(/\\\|/g, '|').split('|').map((p) => p.trim());
  const expr = parts[0] ?? '';
  const fmt = (parts[1] ?? 'dec2') as CalcFormat;
  if (!FORMATS.has(fmt)) throw new Error(`calc "${body}": unknown format "${fmt}"`);
  const flags = parts.slice(2);
  if (flags.some((f) => f !== 'show')) throw new Error(`calc "${body}": unknown option`);
  return { expr, format: fmt, show: flags.includes('show') };
}

/** Rendered text of a calc directive. */
export function renderCalc(body: string): string {
  const c = parseCalc(body);
  const value = format(evaluate(c.expr), c.format);
  if (!c.show) return value;
  const shown = c.expr.replace(/\*/g, ' × ').replace(/\//g, ' ÷ ').replace(/\s+/g, ' ').trim();
  return `${shown} = ${value}`;
}
