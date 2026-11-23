import { fitsEquipment, type CoachProgram, type CoachReview } from '@gym/shared';

export interface CatalogEntry {
  id: string;
  equipment: readonly string[];
}

export interface ValidationContext {
  catalog: Map<string, CatalogEntry>; // base + the user's own exercises
  locations: Map<string, readonly string[]>; // id → equipment
  daysPerWeek: number;
  sessionMinutes: number;
}

export interface ProgramValidation {
  program: CoachProgram;
  errors: string[];
  /** true when too much was invalid: ask the model once more with the errors. */
  retry: boolean;
}

const WORK_SECONDS = 45;

export function estimateDayMinutes(day: CoachProgram['days'][number]) {
  return day.items.reduce((s, i) => s + i.sets * ((i.seconds ?? WORK_SECONDS) + i.restSeconds) + 60, 0) / 60;
}

/**
 * Checks the program against the catalog, the user's locations and profile. Invalid items are
 * dropped; if a day ends up empty or more than 20 % of the items were invalid, it asks for a retry.
 */
export function validateProgram(input: CoachProgram, ctx: ValidationContext): ProgramValidation {
  const errors: string[] = [];
  let total = 0;
  let dropped = 0;
  const fallbackLocation = [...ctx.locations.keys()][0];
  const days = input.days.map((day) => {
    let locationId = day.locationId;
    if (!ctx.locations.has(locationId)) {
      errors.push(`Día ${day.dayIndex}: lugar desconocido ${locationId}.`);
      locationId = fallbackLocation ?? locationId;
    }
    const equipment = ctx.locations.get(locationId) ?? [];
    const items = day.items.filter((item) => {
      total += 1;
      const ex = ctx.catalog.get(item.exerciseId);
      if (!ex) {
        errors.push(`Día ${day.dayIndex}: el ejercicio ${item.exerciseId} no existe en el catálogo.`);
        dropped += 1;
        return false;
      }
      if (!fitsEquipment(ex.equipment, equipment)) {
        errors.push(`Día ${day.dayIndex}: ${item.exerciseId} necesita equipo que no hay en ese lugar.`);
        dropped += 1;
        return false;
      }
      const repsOk = item.repMin === null || item.repMax === null || item.repMin <= item.repMax;
      if (!repsOk || (item.repMin === null && item.repMax === null && item.seconds === null)) {
        errors.push(`Día ${day.dayIndex}: ${item.exerciseId} tiene repeticiones o tiempo inválidos.`);
        dropped += 1;
        return false;
      }
      return true;
    });
    return { ...day, locationId, items };
  });

  const usable = days.filter((d) => d.items.length > 0);
  const tooManyDays = usable.length > ctx.daysPerWeek;
  if (tooManyDays) errors.push(`El programa tiene ${usable.length} días y el perfil indica ${ctx.daysPerWeek}.`);
  const longDays = usable.filter((d) => estimateDayMinutes(d) > ctx.sessionMinutes * 1.15);
  for (const d of longDays) errors.push(`Día ${d.dayIndex}: dura más de ${ctx.sessionMinutes} minutos.`);

  const retry =
    days.some((d) => d.items.length === 0) || (total > 0 && dropped / total > 0.2) || tooManyDays || longDays.length > 0;
  return { program: { ...input, days: usable.slice(0, ctx.daysPerWeek) }, errors, retry };
}

/** Keeps only adjustments about the user's routines and existing exercises. */
export function validateReview(input: CoachReview, routineIds: Set<string>, catalog: Map<string, CatalogEntry>): CoachReview {
  return {
    ...input,
    adjustments: input.adjustments.filter((a) => routineIds.has(a.routineId) && catalog.has(a.exerciseId)),
  };
}
