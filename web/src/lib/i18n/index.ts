import en from './en.json';

export type MessageKey = keyof typeof en;
type Params = Record<string, string | number>;

const catalog: Record<MessageKey, string> = en;

/** Look up a UI string and fill `{name}` placeholders. Unknown placeholders are left visible. */
export function t(key: MessageKey, params: Params = {}): string {
  return catalog[key].replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}
