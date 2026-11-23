import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import type { ErrorCode } from '@gym/shared';

/** Spanish, user-facing messages for each error code. */
export const MESSAGES: Record<ErrorCode, string> = {
  VALIDATION: 'Los datos enviados no son válidos.',
  UNAUTHORIZED: 'Tienes que iniciar sesión.',
  FORBIDDEN: 'No tienes permiso para hacer esto.',
  BAD_ORIGIN: 'Solicitud rechazada por seguridad.',
  NOT_FOUND: 'No encontramos lo que buscas.',
  CONFLICT: 'Hay un conflicto con los datos actuales.',
  REFERENCE: 'Falta un dato relacionado.',
  UNKNOWN_ENTITY: 'Tipo de dato desconocido.',
  RATE_LIMITED: 'Demasiados intentos. Espera un momento.',
  INTERNAL: 'Ocurrió un error inesperado. Intenta de nuevo.',
};

export function apiError(c: Context, status: ContentfulStatusCode, code: ErrorCode, message?: string) {
  return c.json({ error: { code, message: message ?? MESSAGES[code] } }, status);
}
