import type { CatalogExercise } from '@gym/shared';
import { inferMeasure, mapEquipment, mapMuscles, FEDB_CATEGORY, type FedbExercise } from './sources/fedb';
import { normalizeName, type spanishNamesByEnglish } from './sources/wger';

/** Reviewed or machine-translated Spanish text, keyed by free-exercise-db id. */
export interface TranslationEntry {
  nameEs: string;
  instructionsEs: string[];
  /** true once a person checked it; reviewed entries are never overwritten. */
  reviewed: boolean;
  source: 'ai' | 'human';
}
export type Translations = Record<string, TranslationEntry>;

export interface MergeInputs {
  fedb: FedbExercise[];
  wgerNames: ReturnType<typeof spanishNamesByEnglish>;
  translations: Translations;
  version: number;
  fedbRepoUrl: string;
}

/**
 * Builds the base catalog: free-exercise-db data (Unlicense) with Spanish text from our
 * translations file, else a Spanish name from wger (CC-BY-SA, attributed), else the English
 * text marked `translated: false`.
 */
export function mergeCatalog({ fedb, wgerNames, translations, version, fedbRepoUrl }: MergeInputs): CatalogExercise[] {
  return fedb.map((ex) => {
    const equipment = mapEquipment(ex.equipment);
    const primary = mapMuscles(ex.primaryMuscles);
    const secondary = mapMuscles(ex.secondaryMuscles).filter((m) => !primary.includes(m));
    const tr = translations[ex.id];
    const wger = wgerNames.get(normalizeName(ex.name));
    const authors = ['free-exercise-db contributors'];
    if (!tr && wger?.author) authors.push(wger.author);
    const category = FEDB_CATEGORY[ex.category];
    if (!category) throw new Error(`Unknown category ${ex.category}`);
    return {
      id: `fedb:${ex.id}`,
      nameEs: tr?.nameEs ?? wger?.nameEs ?? ex.name,
      nameEn: ex.name,
      instructionsEs: cleanSteps(tr?.instructionsEs ?? ex.instructions),
      translated: Boolean(tr),
      primaryMuscles: primary as CatalogExercise['primaryMuscles'],
      secondaryMuscles: secondary as CatalogExercise['secondaryMuscles'],
      equipment: equipment as CatalogExercise['equipment'],
      level: ex.level,
      category: category as CatalogExercise['category'],
      mechanic: ex.mechanic,
      force: ex.force,
      measure: inferMeasure(ex, equipment),
      media: ex.images.map((_, i) => ({
        type: 'image' as const,
        url: `/media/exercises/${ex.id}/${i}.webp`,
        author: null,
        license: 'Unlicense',
        sourceUrl: `${fedbRepoUrl}/tree/main/exercises/${ex.id}`,
      })),
      source: 'free-exercise-db' as const,
      license: !tr && wger ? `Unlicense; nombre en español: wger ${wger.license}` : 'Unlicense',
      authors,
      sourceUrl: `${fedbRepoUrl}/tree/main/exercises/${ex.id}`,
      catalogVersion: version,
      retiredAt: null,
    };
  });
}

/** Drops empty steps and trims whitespace (some upstream records have blank lines). */
export function cleanSteps(steps: string[]): string[] {
  return steps.map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean).slice(0, 20);
}
