import { z } from 'zod';
import { IsoDateSchema } from './common';

/** Body measurement (sensitive health data: never logged, never sent to third parties). */
export const BodyMeasurementSchema = z
  .object({
    measuredAt: IsoDateSchema,
    weightKg: z.number().min(20).max(400).nullable(),
    bodyFatPct: z.number().min(2).max(70).nullable(),
    waistCm: z.number().min(30).max(250).nullable(),
    chestCm: z.number().min(40).max(250).nullable(),
    armCm: z.number().min(10).max(80).nullable(),
    thighCm: z.number().min(20).max(120).nullable(),
    notes: z.string().trim().max(500).nullable(),
  })
  .refine((m) => [m.weightKg, m.bodyFatPct, m.waistCm, m.chestCm, m.armCm, m.thighCm].some((v) => v !== null), {
    message: 'Indica al menos una medida.',
  });
export type BodyMeasurement = z.infer<typeof BodyMeasurementSchema>;
