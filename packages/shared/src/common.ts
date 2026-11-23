import { z } from 'zod';

/** RFC 9562 UUID (any version); entity ids are UUID v7 generated on the client. */
export const UuidSchema = z.uuid();

export const IsoDateSchema = z.iso.datetime({ offset: true });

/** Error codes returned by the API in `{ error: { code, message } }`. */
export const ErrorCode = {
  VALIDATION: 'VALIDATION',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_ORIGIN: 'BAD_ORIGIN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  REFERENCE: 'REFERENCE',
  UNKNOWN_ENTITY: 'UNKNOWN_ENTITY',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
