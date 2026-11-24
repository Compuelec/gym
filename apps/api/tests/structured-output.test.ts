import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseStructured, shorten } from '../src/lib/structured-output';

describe('shorten', () => {
  it('leaves short texts alone', () => {
    expect(shorten('Hola.', 10)).toBe('Hola.');
  });
  it('cuts at the last sentence end when it keeps at least half', () => {
    expect(shorten('Primera frase larga. Segunda frase que sobra mucho.', 30)).toBe('Primera frase larga.');
  });
  it('otherwise cuts at a word and adds an ellipsis, never over the limit', () => {
    const out = shorten('palabra '.repeat(20), 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith('palabra…')).toBe(true);
  });
  it('handles a text with no spaces', () => {
    const out = shorten('x'.repeat(50), 10);
    expect(out).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('parseStructured', () => {
  const schema = z.object({
    title: z.string().max(10),
    tips: z.array(z.string().max(5)).max(2),
    n: z.number().int().max(3),
  });
  it('repairs nested string and list overruns', () => {
    const out = parseStructured(schema, JSON.stringify({ title: 'Un título demasiado largo', tips: ['abcdefgh', 'b', 'c'], n: 1 }));
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.data.title.length).toBeLessThanOrEqual(10);
      expect(out.data.tips).toHaveLength(2);
      expect(out.data.tips[0]!.length).toBeLessThanOrEqual(5);
    }
  });
  it('does not invent fixes for other problems, and reports no content', () => {
    const out = parseStructured(schema, JSON.stringify({ title: 'secreto', tips: [], n: 9 }));
    expect(out).toEqual({ ok: false, reason: 'schema', issues: ['n: too_big'] });
  });
  it('rejects text that is not JSON', () => {
    expect(parseStructured(schema, '{"title": ')).toMatchObject({ ok: false, reason: 'json' });
  });
});
