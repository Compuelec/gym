import { z } from 'zod';

/** Structured output of the coach for a multi-week program (validated again on the server). */
export const CoachProgramSchema = z.object({
  name: z.string().max(80),
  summaryEs: z.string().max(600),
  weeks: z.number().int().min(1).max(16),
  progressionNoteEs: z.string().max(400),
  days: z
    .array(
      z.object({
        dayIndex: z.number().int().min(1).max(7),
        title: z.string().max(60),
        locationId: z.string(),
        items: z
          .array(
            z.object({
              exerciseId: z.string(),
              sets: z.number().int().min(1).max(10),
              repMin: z.number().int().min(1).max(50).nullable(),
              repMax: z.number().int().min(1).max(50).nullable(),
              seconds: z.number().int().min(5).max(600).nullable(),
              rir: z.number().int().min(0).max(5).nullable(),
              restSeconds: z.number().int().min(15).max(600),
              supersetGroup: z.string().nullable(),
              noteEs: z.string().max(160).nullable(),
            }),
          )
          .min(1)
          .max(12),
      }),
    )
    .min(1)
    .max(7),
  safetyNoteEs: z.string().max(300).nullable(),
});
export type CoachProgram = z.infer<typeof CoachProgramSchema>;

export const CoachReviewSchema = z.object({
  highlightsEs: z.array(z.string().max(200)).max(5),
  concernsEs: z.array(z.string().max(200)).max(5),
  adjustments: z
    .array(z.object({ routineId: z.string(), exerciseId: z.string(), changeEs: z.string().max(200) }))
    .max(10),
});
export type CoachReview = z.infer<typeof CoachReviewSchema>;

export const CoachRequestBodySchema = z.object({
  kind: z.enum(['program', 'weekly_review']),
  message: z.string().trim().min(3).max(1000),
  locationIds: z.array(z.uuid()).max(5).optional(),
});
export type CoachRequestBody = z.infer<typeof CoachRequestBodySchema>;

/** Health topics where the coach must refer to a professional (deterministic safety net). */
export const HEALTH_KEYWORDS = [
  'dolor', 'lesión', 'lesion', 'lesionado', 'embarazo', 'embarazada', 'operación', 'operacion', 'cirugía', 'cirugia',
  'hernia', 'corazón', 'corazon', 'cardíaco', 'cardiaco', 'presión alta', 'presion alta', 'hipertensión', 'diabetes',
  'mareo', 'desmayo', 'fractura', 'esguince', 'tendinitis', 'medicamento', 'enfermedad',
];

export function mentionsHealth(text: string): boolean {
  const t = text.toLowerCase();
  return HEALTH_KEYWORDS.some((k) => t.includes(k));
}

export const SAFETY_NOTE_ES =
  'Mencionaste un tema de salud: consulta a un médico o profesional del ejercicio antes de seguir este programa y detente si sientes dolor.';
