# Data Model — 001 Gym PWA MVP

Convenciones para toda entidad de usuario sincronizable:
`id` (UUID v7 generado en el cliente), `ownerId`, `createdAt`, `updatedAt` (hora del servidor al
aplicar), `deletedAt` (borrado lógico), `serverVersion` (cursor monotónico asignado al aplicar el
cambio; lo usa `/sync/pull`). El servidor **siempre** filtra por `ownerId = usuario de la sesión`.

## Vocabularios fijos (parte del paquete de catálogo)

| Entidad | Campos | Notas |
|---|---|---|
| **Muscle** | `slug`, `nameEs`, `group` (pecho, espalda, piernas…), `bodyMapZones[]`, `size` (grande/mediano/pequeño → vida media de recuperación) | ~20 músculos mapeados a las zonas del mapa del cuerpo |
| **Equipment** | `slug`, `nameEs`, `category` | mancuernas, barra, barra Z, banco, poleas, máquina, kettlebell, banda, barra de dominadas, balón, rodillo, ninguno |

## Catálogo (servidor, lectura para todos; ejercicios propios por usuario)

**Exercise**
| Campo | Tipo | Reglas |
|---|---|---|
| `id` | string | estable (`fedb:Air_Bike`, `wger:123`, `user:<uuid>`) |
| `ownerId` | uuid \| null | null = catálogo base |
| `nameEs`, `nameEn` | string | `nameEs` obligatorio |
| `instructionsEs[]` | string[] | ≥ 1 paso |
| `primaryMuscles[]`, `secondaryMuscles[]` | Muscle.slug[] | ≥ 1 principal |
| `equipment[]` | Equipment.slug[] | `[]` o `none` = peso corporal |
| `level` | beginner \| intermediate \| expert | |
| `category` | strength \| stretching \| plyometrics \| cardio \| … | |
| `mechanic` | compound \| isolation \| null | orden en rutina de hoy |
| `force` | push \| pull \| static \| null | |
| `measure` | weight_reps \| reps \| time \| distance | define campos de Serie |
| `media[]` | `{type: image\|video, url, author, license, sourceUrl}` | licencia obligatoria |
| `source`, `license`, `authors[]` | string | para créditos |
| `catalogVersion` | int | versión del paquete en que cambió |
| `retiredAt` | timestamp \| null | nunca se borra (historial) |

**Favorite** — `ownerId`, `exerciseId` (sincronizable).

## Usuario y perfil

**User** (Better Auth): `id`, `email`, `name`, `emailVerified`, `image`, `role`
(`user` | `admin`, por defecto `user`), + tablas `session`, `account`, `verification` de Better
Auth. El rol nunca se puede cambiar por `/sync` ni por el propio usuario.

**Invitation** — `id`, `codeHash`, `createdBy`, `email?`, `expiresAt`, `usedBy?`, `usedAt?`.
Regla: registro sólo con código válido, no usado y no vencido.

**Profile** (1:1 con User, sincronizable; excepción a la convención: `id` = id del usuario, no un
UUID del cliente, para que dos dispositivos sin conexión converjan en un solo perfil) — `goal` (fuerza | hipertrofia | resistencia | salud |
pérdida de grasa), `level`, `daysPerWeek` (1–7), `sessionMinutes`, `units` (kg | lb),
`bodyweightKg?`, `birthYear?`, `sex?`, `medicalAckAt` (aceptó aviso médico).

**Location** (sincronizable) — `name`, `equipment[]` (Equipment.slug), `isDefault`.

## Entrenamiento (sincronizable)

**Program** — `name`, `weeks`, `source` (user | coach), `coachRequestId?`, `startedAt?`,
`archivedAt?`.

**Routine** — `name`, `programId?`, `weekIndex?`, `dayIndex?`, `locationId?`, `notes`,
`items[]` (embebido, se reemplaza completo al editar):
`{position, exerciseId, supersetGroup?, targetSets, repMin?, repMax?, targetSeconds?,
targetRir?, restSeconds, notes?}`.

**WorkoutSession** — `routineId?`, `locationId?`, `startedAt`, `endedAt?`, `status`
(in_progress | completed | discarded), `notes`, `perceivedEffort?`.
Transiciones: `in_progress → completed | discarded`; una sesión `in_progress` > 6 h se ofrece
cerrar.

**SessionExercise** — `sessionId`, `position`, `exerciseId`, `replacedFromExerciseId?`,
`supersetGroup?`, `notes`.

**SetEntry** (sólo-agregar en la práctica) — `sessionExerciseId`, `position`, `type`
(warmup | normal | failure | drop), `weightKg?`, `reps?`, `seconds?`, `meters?`, `rir?`,
`rpe?`, `completedAt`, `suggested?` (`{weightKg, reps, reason}` mostrado por el motor).
Validación por `measure` del ejercicio; peso siempre guardado en kg, mostrado en la unidad del
usuario.

**PersonalRecord** (derivado, recalculable) — `exerciseId`, `kind` (max_weight | max_reps |
est_1rm | max_volume), `value`, `setEntryId`, `achievedAt`.

**BodyMeasurement** — `measuredAt`, `weightKg?`, `bodyFatPct?`, `waistCm?`, `chestCm?`,
`armCm?`, `thighCm?`, `notes?`. Dato sensible (principio V).

## Coach (servidor; no sincroniza al cliente salvo el resultado)

**CoachRequest** — `id`, `ownerId`, `kind` (program | weekly_review), `messages[]`,
`status` (queued | running | done | failed | rejected), `resultJson?`, `validationErrors?`,
`model`, `inputTokens`, `outputTokens`, `cacheReadTokens`, `costUsd`, `createdAt`.
**CoachQuota** — `ownerId`, `day`, `count` (límite configurable, inicial 20).

## Administración (servidor, sólo rol admin)

**AppSettings** (una sola fila) —
| Campo | Tipo | Reglas |
|---|---|---|
| `aiEnabled` | boolean | por defecto `false` |
| `aiModel` | enum | `claude-haiku-5-5` (defecto) \| `claude-sonnet-5-5` \| `claude-opus-5-5` |
| `aiApiKeyCiphertext`, `aiApiKeyIv`, `aiApiKeyTag` | bytes | AES-256-GCM con `APP_ENCRYPTION_KEY` (Secret de Kubernetes) |
| `aiApiKeyLast4` | string | lo único que se muestra |
| `aiApiKeyUpdatedAt` | timestamp | |
| `aiDailyLimitPerUser` | int | 0–500, defecto 20 |
| `aiMonthlyBudgetUsd` | decimal | defecto 5,00 |
| `aiPausedReason` | string \| null | p. ej. `BUDGET_REACHED`; se limpia al cambiar de mes o por el admin |
| `aiPricing` | json | precio por millón de tokens de entrada/salida/caché por modelo |
| `updatedBy`, `updatedAt` | | |

Regla: el coach está disponible ⇔ `aiEnabled` ∧ hay clave (base o `Secret`) ∧ `aiPausedReason`
es null.

**AdminAudit** — `id`, `adminId`, `action` (ai_enabled, ai_disabled, ai_key_set, ai_key_deleted,
ai_model_changed, limits_changed, invite_created, invite_revoked), `details` (json sin secretos),
`createdAt`.

## Sincronización y notificaciones

**SyncMutation** (servidor, para idempotencia) — `mutationId`, `ownerId`, `appliedAt`,
`resultVersion`. Un `mutationId` repetido devuelve el mismo resultado sin reaplicar.

**Outbox** (cliente, Dexie) — `mutationId`, `entity`, `op` (upsert | delete), `payload`,
`createdAt`, `attempts`.

**PushSubscription** — `ownerId`, `endpoint`, `keys`, `userAgent`.
**ScheduledPush** — `ownerId`, `fireAt`, `kind` (rest_end), `sessionId`, `cancelledAt?`.

## Relaciones

```
User 1─1 Profile        User 1─* Location        User 1─* Exercise(propios)
User 1─* Program 1─* Routine 1─* items → Exercise
User 1─* WorkoutSession 1─* SessionExercise 1─* SetEntry
SetEntry → PersonalRecord (derivado)      User 1─* BodyMeasurement
User 1─* CoachRequest → Program (si se acepta)
```

## Exportación (formato abierto)

JSON versionado `{formatVersion: 1, exportedAt, profile, locations, exercises(propios),
favorites, programs, routines, sessions[{exercises[{sets}]}], measurements}`; la importación
valida con Zod, rechaza versiones desconocidas y se aplica en una transacción (o nada).
