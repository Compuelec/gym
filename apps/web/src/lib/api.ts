import {
  ApiErrorSchema,
  SyncPullResponseSchema,
  SyncPushResponseSchema,
  type SyncPushRequest,
} from '@gym/shared';
import { UnauthorizedError, type SyncTransport } from '@/db/sync';

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/** Same-origin JSON request; the session cookie travels automatically. */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await fetch(`/api${path}`, {
    ...init,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', ...init.headers },
  });
  if (res.status === 401) throw new UnauthorizedError();
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const parsed = ApiErrorSchema.safeParse(body);
    throw new ApiRequestError(
      res.status,
      parsed.success ? parsed.data.error.code : 'INTERNAL',
      parsed.success ? parsed.data.error.message : 'Ocurrió un error inesperado.',
    );
  }
  return body;
}

export const syncTransport: SyncTransport = {
  async push(body: SyncPushRequest) {
    const res = await apiFetch('/sync/push', { method: 'POST', body: JSON.stringify(body) });
    return SyncPushResponseSchema.parse(res).results;
  },
  async pull(cursor: number) {
    return SyncPullResponseSchema.parse(await apiFetch(`/sync/pull?cursor=${cursor}`));
  },
};
