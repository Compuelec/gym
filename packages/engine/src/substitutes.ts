import { EQUIPMENT, MUSCLES, fitsEquipment } from '@gym/shared';

export interface SubstituteCandidate {
  id: string;
  nameEs: string;
  primaryMuscles: readonly string[];
  secondaryMuscles: readonly string[];
  equipment: readonly string[];
  mechanic: string | null;
  force: string | null;
  measure: string;
  retiredAt?: string | null;
}

export interface Substitute {
  exerciseId: string;
  score: number;
  reason: string;
}

const muscleName = new Map<string, string>(MUSCLES.map((m) => [m.slug, m.nameEs.toLowerCase()]));
const equipmentName = new Map<string, string>(EQUIPMENT.map((e) => [e.slug, e.nameEs.toLowerCase()]));

function listEs(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
}

/**
 * Exercises that train the same main muscles with the equipment available at a location,
 * best first. Each comes with a Spanish explanation (constitution IV).
 */
export function findSubstitutes(
  target: SubstituteCandidate,
  candidates: readonly SubstituteCandidate[],
  available: readonly string[],
  locationName: string,
  limit = 8,
): Substitute[] {
  const results: Substitute[] = [];
  for (const c of candidates) {
    if (c.id === target.id || c.retiredAt) continue;
    if (!fitsEquipment(c.equipment, available)) continue;
    const sharedPrimary = c.primaryMuscles.filter((m) => target.primaryMuscles.includes(m));
    if (sharedPrimary.length === 0) continue;
    const sharedSecondary = c.secondaryMuscles.filter((m) => target.secondaryMuscles.includes(m));
    let score = sharedPrimary.length * 3 + sharedSecondary.length;
    // Penalize extra primary muscles the target does not train.
    score -= c.primaryMuscles.filter((m) => !target.primaryMuscles.includes(m)).length;
    if (c.mechanic && c.mechanic === target.mechanic) score += 1;
    if (c.force && c.force === target.force) score += 1;
    if (c.measure === target.measure) score += 0.5;

    const muscles = listEs(sharedPrimary.map((m) => muscleName.get(m) ?? m));
    const gear = c.equipment.length ? listEs(c.equipment.map((e) => equipmentName.get(e) ?? e)) : 'tu propio peso';
    results.push({ exerciseId: c.id, score, reason: `Trabaja ${muscles} con ${gear}, disponible en ${locationName}.` });
  }
  return results.sort((a, b) => b.score - a.score || a.exerciseId.localeCompare(b.exerciseId)).slice(0, limit);
}
