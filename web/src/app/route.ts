/** A parsed hash URL: "#/trainer/math?drill=potodds" → page "trainer", rest ["math"], query. */
export type Route = { page: string; rest: string[]; query: URLSearchParams };

export function parseRoute(hash: string): Route {
  const [path = '', q = ''] = hash.replace(/^#\/?/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  return { page: parts[0] ?? '', rest: parts.slice(1), query: new URLSearchParams(q) };
}

export function href(page: string, rest: string[] = [], query: Record<string, string> = {}): string {
  const q = new URLSearchParams(query).toString();
  return `#/${[page, ...rest].map(encodeURIComponent).join('/')}${q ? `?${q}` : ''}`;
}

/** Old links (before M6.5) → their new place, or null. */
export function redirect(r: Route): string | null {
  const q = Object.fromEntries(r.query.entries());
  switch (r.page) {
    case 'trainer':
      return r.rest[0] === 'review' ? href('stats') : href('train', r.rest, q);
    case 'charts':
      return href('solve', ['charts'], q);
    case 'solver':
      return href('solve', ['workbench'], q);
    case 'equity':
      return href('solve', ['equity'], q);
    case 'pushfold':
      return href('solve', ['pushfold'], q);
    default:
      return null;
  }
}
