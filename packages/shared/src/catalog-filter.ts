import { EQUIPMENT, MUSCLES, type EquipmentSlug, type MuscleSlug } from './vocabulary';

/** Minimal shape both catalog and own exercises share for filtering. */
export interface FilterableExercise {
  nameEs: string;
  nameEn?: string | null;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  equipment: readonly string[];
  level: string;
  category: string;
  retiredAt?: string | null;
}

export interface CatalogFilter {
  text?: string;
  muscle?: MuscleSlug | null;
  includeSecondary?: boolean;
  equipment?: EquipmentSlug | null;
  /** Equipment available at a location: exercises must need only these (or nothing). */
  availableEquipment?: readonly string[] | null;
  level?: string | null;
  category?: string | null;
}

/** Lower-case, accent-free text for search («sentadilla» matches «Sentadílla», «SENTADILLA»). */
export function normalizeText(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

/** Bodyweight (no equipment) always fits; otherwise every required item must be available. */
export function fitsEquipment(required: readonly string[], available: readonly string[]): boolean {
  return required.every((e) => available.includes(e));
}

/** Words that carry no meaning in a search («press en banca para pecho»). */
const STOPWORDS = new Set([
  'a', 'al', 'con', 'de', 'del', 'el', 'en', 'la', 'las', 'lo', 'los', 'o', 'para', 'por', 'sin', 'sobre',
  'un', 'una', 'unos', 'unas', 'y', 'ejercicio', 'ejercicios', 'the', 'with', 'of',
]);

/** Everyday words people type that the catalog names differently (keys and values are stems). */
const SYNONYMS: Record<string, string[]> = {
  pectoral: ['pech'],
  pec: ['pech'],
  abdomen: ['abdominal'],
  abs: ['abdominal'],
  gemel: ['pantorrill'],
  pierna: ['cuadricep', 'isquiotibial', 'glute', 'pantorrill'],
  brazo: ['bicep', 'tricep', 'antebraz'],
  pesa: ['mancuern', 'disc'],
};

/**
 * Crude Spanish stemmer for search: plurals and the final vowel go, so «banca» and «banco»,
 * «pectorales» and «pectoral», «sentadillas» and «sentadilla» meet.
 */
export function stemWord(word: string): string {
  let s = normalizeText(word);
  if (s.length >= 6 && s.endsWith('es') && !/[aeiou]/.test(s[s.length - 3]!)) s = s.slice(0, -2);
  else if (s.length >= 4 && s.endsWith('s')) s = s.slice(0, -1);
  if (s.length >= 5 && /[aeo]$/.test(s)) s = s.slice(0, -1);
  return s;
}

function queryTerms(text: string): string[][] {
  return normalizeText(text)
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w && !STOPWORDS.has(w))
    .map((w) => {
      const stem = stemWord(w);
      return [stem, ...(SYNONYMS[stem] ?? [])];
    });
}

const MUSCLE_TEXT = new Map<string, string>(MUSCLES.map((m) => [m.slug, `${m.nameEs} ${m.group}`]));
const EQUIPMENT_TEXT = new Map<string, string>(EQUIPMENT.map((e) => [e.slug, e.nameEs]));

/** Weighted relevance: a word in the name counts double; muscles and equipment count once. */
function relevance(ex: FilterableExercise, terms: string[][]): { matched: number; score: number } {
  const name = normalizeText(`${ex.nameEs} ${ex.nameEn ?? ''}`);
  const rest = normalizeText(
    [...ex.primaryMuscles, ...ex.secondaryMuscles].map((m) => MUSCLE_TEXT.get(m) ?? m).join(' ') +
      ' ' +
      ex.equipment.map((e) => EQUIPMENT_TEXT.get(e) ?? e).join(' '),
  );
  let matched = 0;
  let score = 0;
  for (const alternatives of terms) {
    if (alternatives.some((a) => name.includes(a))) {
      matched += 1;
      score += 2;
    } else if (alternatives.some((a) => rest.includes(a))) {
      matched += 1;
      score += 1;
    }
  }
  return { matched, score };
}

export function matchesFilter(ex: FilterableExercise, f: CatalogFilter): boolean {
  if (ex.retiredAt) return false;
  if (f.text) {
    const terms = queryTerms(f.text);
    if (terms.length && relevance(ex, terms).matched < terms.length) return false;
  }
  return matchesNonText(ex, f);
}

function matchesNonText(ex: FilterableExercise, f: CatalogFilter): boolean {
  if (ex.retiredAt) return false;
  if (f.muscle) {
    const inPrimary = ex.primaryMuscles.includes(f.muscle);
    const inSecondary = f.includeSecondary && ex.secondaryMuscles.includes(f.muscle);
    if (!inPrimary && !inSecondary) return false;
  }
  if (f.equipment && !ex.equipment.includes(f.equipment)) return false;
  if (f.availableEquipment && !fitsEquipment(ex.equipment, f.availableEquipment)) return false;
  if (f.level && ex.level !== f.level) return false;
  if (f.category && ex.category !== f.category) return false;
  return true;
}

export interface SearchResult<T> {
  results: T[];
  /** No exercise matched every word: these are the closest ones, best first. */
  approximate: boolean;
}

/**
 * Search with the filters. With text, results are ranked by relevance; when nothing matches
 * every word, the closest matches are returned (flagged) rather than an empty list.
 */
export function searchExercises<T extends FilterableExercise>(list: readonly T[], f: CatalogFilter): SearchResult<T> {
  const pool = list.filter((ex) => matchesNonText(ex, f));
  const terms = f.text ? queryTerms(f.text) : [];
  if (terms.length === 0) {
    return { results: pool.sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es')), approximate: false };
  }
  const ranked = pool
    .map((ex) => ({ ex, ...relevance(ex, terms) }))
    .filter((r) => r.matched > 0)
    .sort((a, b) => b.matched - a.matched || b.score - a.score || a.ex.nameEs.localeCompare(b.ex.nameEs, 'es'));
  const exact = ranked.filter((r) => r.matched === terms.length);
  if (exact.length > 0) return { results: exact.map((r) => r.ex), approximate: false };
  return { results: ranked.map((r) => r.ex), approximate: ranked.length > 0 };
}

export function filterExercises<T extends FilterableExercise>(list: readonly T[], f: CatalogFilter): T[] {
  return searchExercises(list, f).results;
}
