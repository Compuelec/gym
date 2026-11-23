# API Contract (REST, JSON) — base `/api`

Reglas generales:
- Mismo origen que la PWA. Sesión por cookie `httpOnly; Secure; SameSite=Lax`.
- Todo endpoint exige sesión salvo los marcados **público**.
- Peticiones que cambian estado (`POST/PUT/PATCH/DELETE`) exigen `Origin` igual al dominio de la
  app (protección CSRF); se prueba con un navegador real (lección del 2026-10-05).
- Errores: `{error: {code, message}}` con `message` en español. Códigos: 400 validación,
  401 sin sesión, 403 sin permiso, 404 no existe **o no es tuyo** (no revelar existencia),
  409 conflicto, 422 importación inválida, 429 límite, 5xx.
- Validación de entrada y salida con los esquemas Zod de `packages/shared`.

## Salud
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/health` | **público** — estado de API y base |

## Autenticación (Better Auth, montado en `/api/auth/*`)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/auth/sign-up/email` | requiere `inviteCode` válido; si no → 403 `INVITE_REQUIRED` |
| POST | `/auth/sign-in/email` | ingreso |
| GET | `/auth/sign-in/social?provider=google` | ingreso con Google (registro nuevo exige invitación pendiente) |
| POST | `/auth/sign-out` | salir |
| POST | `/auth/forget-password`, `/auth/reset-password` | recuperación por correo |
| GET | `/auth/get-session` | sesión actual |

## Administración (sólo rol `admin`; cualquier otro usuario → 403)
| Método | Ruta | Descripción |
|---|---|---|
| POST | `/admin/invitations` | crea código (devuelto una sola vez) |
| GET | `/admin/invitations` | lista |
| DELETE | `/admin/invitations/:id` | revoca |
| GET | `/admin/settings/ai` | `{enabled, available, model, allowedModels, keyConfigured, keyLast4, keyUpdatedAt, dailyLimitPerUser, monthlyBudgetUsd, monthSpentUsd, pausedReason}` — **nunca** la clave |
| PATCH | `/admin/settings/ai` | `{enabled?, model?, dailyLimitPerUser?, monthlyBudgetUsd?, clearPause?}`; activar sin clave → 409 `AI_KEY_MISSING` |
| PUT | `/admin/settings/ai/key` | `{apiKey}` → prueba la clave contra el servicio; si funciona la guarda cifrada y responde `{keyLast4}`; si no, 422 `AI_KEY_INVALID` y no se guarda |
| DELETE | `/admin/settings/ai/key` | borra la clave y desactiva la IA |
| POST | `/admin/settings/ai/test` | prueba la clave guardada → `{ok, latencyMs, model}` |
| GET | `/admin/audit` | bitácora de cambios (sin secretos) |

La clave sólo viaja del navegador al servidor en `PUT /admin/settings/ai/key` (HTTPS); se excluye
del registro de peticiones.

## Catálogo
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/catalog/manifest` | **público** — `{version, url, sizeBytes, sha256, imageCount}` |
| GET | `/catalog/v/:version/catalog.json` | **público**, caché inmutable — ejercicios base + vocabularios |
| GET | `/media/exercises/:file` | **público**, caché inmutable (servido por Caddy) |
| GET | `/credits` | **público** — autores y licencias agregados |

Los ejercicios propios, favoritos y todo dato de usuario viajan por `/sync`.

## Sincronización
Ver [sync.md](./sync.md).
| Método | Ruta |
|---|---|
| POST | `/sync/push` |
| GET | `/sync/pull?cursor=<n>&limit=<n>` |

## Coach
Ver [coach.md](./coach.md).
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/coach/status` | `{available, reason?}` (`DISABLED`, `PAUSED`, `NO_KEY`) — la PWA oculta o muestra el coach |
| POST | `/coach/requests` | `{kind, message, locationIds?}` → 202 `{id}`; 429 `COACH_LIMIT` con `retryAt`; 503 `COACH_UNAVAILABLE` si la IA está desactivada o pausada |
| GET | `/coach/requests/:id` | estado y resultado validado |
| GET | `/coach/requests/:id/stream` | SSE con progreso |
| POST | `/coach/requests/:id/accept` | convierte el programa en Program + Routines (vía sync) |
| GET | `/coach/quota` | `{used, limit, resetsAt}` |

## Notificaciones push
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/push/vapid-key` | clave pública |
| POST | `/push/subscriptions` | guarda suscripción |
| DELETE | `/push/subscriptions` | elimina |
| POST | `/push/rest-timer` | `{sessionId, fireAt}` programa aviso de fin de descanso |
| DELETE | `/push/rest-timer/:sessionId` | cancela |

## Datos del usuario
| Método | Ruta | Descripción |
|---|---|---|
| GET | `/me/export` | descarga JSON (formato en data-model.md) |
| POST | `/me/import` | `multipart` o JSON; 422 si inválido; transacción todo-o-nada |
| DELETE | `/me` | requiere `{confirm: "BORRAR"}` y contraseña o re-autenticación reciente; borra todo en cascada |

## Pruebas negativas obligatorias (punta a punta)
- Sin sesión → 401 en todo lo no público.
- Usuario A pide/edita/borra recursos de B (por id en sync, coach, export) → 404 y sin cambios.
- `POST` sin `Origin` válido → 403.
- Registro sin invitación, con invitación usada o vencida → 403.
- Exceder límite del coach → 429.
- Usuario normal llama a cualquier `/admin/*` → 403 y sin cambios.
- Ninguna respuesta, registro de la API ni bitácora contiene la clave completa de la IA.
- IA desactivada por el admin → `POST /coach/requests` responde 503 desde la siguiente petición.
