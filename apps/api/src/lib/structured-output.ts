import type { z } from 'zod';

/**
 * Structured outputs guarantee the JSON *shape*, but limits such as a string's max length or an
 * array's max items are only hints to the model. Rejecting the whole answer because one text ran
 * long throws away a good (and already paid for) result, so over-long texts are shortened and
 * over-long lists trimmed before validating.
 */

/** Shortens `text` to at most `max` chars, at a sentence end if one is close, else at a word. */
export function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = text.slice(0, max);
  const sentenceEnd = Math.max(head.lastIndexOf('. '), head.lastIndexOf('.\n'), head.endsWith('.') ? max - 1 : -1);
  if (sentenceEnd >= max * 0.5) return head.slice(0, sentenceEnd + 1);
  const room = head.slice(0, max - 1);
  const space = room.lastIndexOf(' ');
  return `${(space >= max * 0.5 ? room.slice(0, space) : room).trimEnd()}…`;
}

type Path = ReadonlyArray<PropertyKey>;

function fixAt(root: unknown, path: Path, fix: (value: unknown) => unknown) {
  if (path.length === 0) return;
  let parent = root as Record<PropertyKey, unknown>;
  for (const key of path.slice(0, -1)) {
    parent = parent?.[key] as Record<PropertyKey, unknown>;
    if (parent == null || typeof parent !== 'object') return;
  }
  const last = path[path.length - 1]!;
  parent[last] = fix(parent[last]);
}

export type StructuredResult<T> =
  | { ok: true; data: T; adjusted: string[] }
  | { ok: false; reason: 'json' | 'schema'; issues: string[] };

/**
 * Parses the model's JSON text against `schema`, repairing length overruns. Issue strings carry
 * only paths and codes (never the content), so they are safe to log.
 */
export function parseStructured<T extends z.ZodType>(schema: T, text: string): StructuredResult<z.infer<T>> {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'json', issues: ['invalid JSON'] };
  }
  const adjusted: string[] = [];
  // Each pass fixes the overruns zod reports; nested lists can surface new ones, hence a few passes.
  for (let pass = 0; pass < 3; pass++) {
    const out = schema.safeParse(value);
    if (out.success) return { ok: true, data: out.data, adjusted };
    let fixed = false;
    for (const issue of out.error.issues) {
      if (issue.code !== 'too_big') continue;
      const max = Number(issue.maximum);
      if (issue.origin === 'string') {
        fixAt(value, issue.path, (v) => (typeof v === 'string' ? shorten(v, max) : v));
      } else if (issue.origin === 'array') {
        fixAt(value, issue.path, (v) => (Array.isArray(v) ? v.slice(0, max) : v));
      } else continue;
      adjusted.push(issue.path.join('.'));
      fixed = true;
    }
    if (!fixed) {
      return {
        ok: false,
        reason: 'schema',
        issues: out.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.code}`),
      };
    }
  }
  const last = schema.safeParse(value);
  return last.success
    ? { ok: true, data: last.data, adjusted }
    : { ok: false, reason: 'schema', issues: last.error.issues.slice(0, 5).map((i) => `${i.path.join('.')}: ${i.code}`) };
}
