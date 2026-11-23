import es from './es.json';

type Dict = { [key: string]: string | Dict };

const messages: Dict = es;

/** Looks up a dotted key in the Spanish dictionary and fills `{param}` placeholders. */
export function t(key: string, params: Record<string, string | number> = {}): string {
  const value = key.split('.').reduce<string | Dict | undefined>(
    (node, part) => (node && typeof node === 'object' ? node[part] : undefined),
    messages,
  );
  if (typeof value !== 'string') {
    if (import.meta.env.DEV) console.warn(`Missing translation: ${key}`);
    return key;
  }
  return value.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function hasKey(key: string): boolean {
  return t(key) !== key;
}

/** Picks `${key}One` when count is 1 (Spanish singular), else `key` with {count}. */
export function tn(key: string, count: number, params: Record<string, string | number> = {}): string {
  return count === 1 && hasKey(`${key}One`) ? t(`${key}One`, params) : t(key, { ...params, count });
}
