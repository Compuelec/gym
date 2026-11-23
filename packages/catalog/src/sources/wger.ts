import { z } from 'zod';

const Translation = z.object({ language: z.number(), name: z.string(), description: z.string().optional() });
export const WgerExerciseSchema = z.object({
  id: z.number(),
  translations: z.array(Translation),
  license: z.object({ short_name: z.string() }).nullable().optional(),
  license_author: z.string().nullable().optional(),
});
export type WgerExercise = z.infer<typeof WgerExerciseSchema>;

export const WGER_LANG = { en: 2, es: 4 } as const;

export function normalizeName(s: string) {
  return s.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** English name (normalized) → Spanish name, for wger exercises that have both. */
export function spanishNamesByEnglish(list: WgerExercise[]) {
  const map = new Map<string, { nameEs: string; wgerId: number; license: string; author: string | null }>();
  for (const ex of list) {
    const en = ex.translations.find((t) => t.language === WGER_LANG.en);
    const es = ex.translations.find((t) => t.language === WGER_LANG.es);
    if (!en || !es || !es.name.trim()) continue;
    map.set(normalizeName(en.name), {
      nameEs: es.name.trim(),
      wgerId: ex.id,
      license: ex.license?.short_name ?? 'CC-BY-SA 4',
      author: ex.license_author ?? null,
    });
  }
  return map;
}
