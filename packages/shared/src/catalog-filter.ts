import type { EquipmentSlug, MuscleSlug } from './vocabulary';

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

export function matchesFilter(ex: FilterableExercise, f: CatalogFilter): boolean {
  if (ex.retiredAt) return false;
  if (f.text) {
    const words = normalizeText(f.text).split(/\s+/).filter(Boolean);
    const hay = normalizeText(`${ex.nameEs} ${ex.nameEn ?? ''}`);
    if (!words.every((w) => hay.includes(w))) return false;
  }
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

export function filterExercises<T extends FilterableExercise>(list: readonly T[], f: CatalogFilter): T[] {
  return list.filter((ex) => matchesFilter(ex, f)).sort((a, b) => a.nameEs.localeCompare(b.nameEs, 'es'));
}
