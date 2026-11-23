// @vitest-environment node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasKey, t } from './index';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') && !name.endsWith('.gen.ts') ? [path] : [];
  });
}

describe('i18n', () => {
  it('fills parameters', () => {
    expect(t('status.pending', { count: 3 })).toBe('3 cambios por sincronizar');
  });

  it('every t("…") key used in the source exists in es.json', () => {
    const missing: string[] = [];
    for (const file of sourceFiles(SRC)) {
      for (const m of readFileSync(file, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
        if (!hasKey(m[1]!)) missing.push(`${m[1]} (${file.replace(SRC, '')})`);
      }
    }
    expect(missing).toEqual([]);
  });
});
