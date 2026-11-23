---
description: "Task list for 001 Gym PWA MVP"
---

# Tasks: PWA de entrenamiento casa/gimnasio (MVP)

**Input**: Design documents from `/specs/001-gym-pwa-mvp/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: OBLIGATORIAS — la constitución (principio III, no negociable) exige unitarias, de punta a
punta y en vivo. En cada historia las pruebas se escriben primero y deben fallar antes de
implementar.

**Organization**: tareas agrupadas por historia de usuario. Orden de historias: US1 → US2 → US3 →
US4 → US5 → US7 → US6 (US7 va antes que US6 porque el coach necesita los ajustes y la clave que
configura el administrador).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede hacer en paralelo (archivos distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1…US7)

## Path Conventions

Monorepo pnpm: `apps/web/`, `apps/api/`, `packages/shared/`, `packages/engine/`,
`packages/catalog/`, `e2e/`, `infra/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: inicializar el monorepo y las herramientas.

- [X] T001 Create root workspace files `package.json` (scripts: dev, build, test, e2e, lint, typecheck, db:migrate, catalog:build, admin:invite, admin:promote), `pnpm-workspace.yaml` (apps/*, packages/*, e2e), `.nvmrc` (24), `.gitignore` (node_modules, dist, .env*, !.env.example, coverage, playwright-report)
- [X] T002 Create shared TypeScript config `tsconfig.base.json` (strict, ES2023, moduleResolution bundler, noUncheckedIndexedAccess) at repo root
- [X] T003 [P] Configure ESLint (flat config, typescript-eslint, react-hooks) in `eslint.config.js` and Prettier in `.prettierrc`
- [X] T004 [P] Scaffold `packages/shared` (package.json, tsconfig, `src/index.ts`) exporting Zod schemas and types
- [X] T005 [P] Scaffold `packages/engine` (package.json, tsconfig, `src/index.ts`, Vitest config) as pure TS with no runtime deps
- [X] T006 [P] Scaffold `packages/catalog` (package.json, tsconfig, `src/` and `scripts/`) for catalog import/build
- [X] T007 [P] Scaffold `apps/api` with Hono + `@hono/node-server`, Drizzle, Zod, pino; entry `apps/api/src/index.ts` and `apps/api/src/worker.ts`
- [X] T008 [P] Scaffold `apps/web` with Vite + React 19 + TanStack Router/Query + Tailwind + shadcn/ui; entry `apps/web/src/main.tsx`
- [X] T009 [P] Scaffold `e2e/` with Playwright (Chromium + WebKit + mobile emulation projects) in `e2e/playwright.config.ts`
- [X] T010 [P] Configure Vitest projects in `vitest.config.ts` (Vitest 5 replaced workspace files) covering packages/*, apps/api and apps/web (jsdom)
- [X] T011 [P] Create `.env.example` with DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, APP_ENCRYPTION_KEY, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, SMTP_HOST/PORT/USER/PASS/FROM, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, ANTHROPIC_API_KEY (optional fallback), ADMIN_EMAIL
- [X] T012 [P] Create `infra/docker-compose.dev.yml` (postgres:17 + mailpit) and `infra/docker-compose.test.yml` (ephemeral postgres on tmpfs + mailpit + fake AI server port)
- [X] T013 [P] Create Git hooks/CI script `scripts/check.sh` running lint, typecheck and unit tests

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: base que todas las historias necesitan: base de datos, API, autenticación base, sincronización, app shell offline, despliegue.

**⚠️ CRITICAL**: ninguna historia empieza hasta terminar esta fase.

### Pruebas de la base (escribir primero)

- [X] T014 [P] Unit tests for sync client (outbox write in same Dexie transaction, retry backoff 1 s → 5 min, never drop outbox on 401, apply pull in one transaction then save cursor) in `apps/web/src/db/sync.test.ts`, and for safe writes (timeout retry, `QuotaExceededError` evicts images but keeps outbox) in `apps/web/src/db/safe-write.test.ts`
- [X] T015 [P] Integration tests for `/sync/push` and `/sync/pull` against ephemeral Postgres (idempotent `mutationId` → `duplicate`, other user's id → `rejected NOT_FOUND`, delete sets `deletedAt` and is returned by pull, cursor monotonic, last-write-wins by server apply order, batch ≤ 200) in `apps/api/tests/sync.test.ts`
- [X] T016 [P] Integration tests for security middleware (401 without session on non-public routes, 403 on state-changing request without matching `Origin`, error body `{error:{code,message}}` in Spanish) in `apps/api/tests/security.test.ts`

### Implementación de la base

- [X] T017 Configure Drizzle (`apps/api/drizzle.config.ts`, `apps/api/src/db/client.ts`) and migration runner `apps/api/src/db/migrate.ts`
- [X] T018 Define sync conventions in Drizzle (`apps/api/src/db/columns.ts`): `id uuid` (client UUID v7), `ownerId`, `createdAt`, `updatedAt` (server time), `deletedAt`, `serverVersion bigint` from a global Postgres sequence `sync_version_seq`
- [X] T019 Create `sync_mutations` table (`mutationId` PK, `ownerId`, `appliedAt`, `resultVersion`) in `apps/api/src/db/schema/sync.ts`
- [X] T020 [P] Define shared vocabularies and base Zod schemas (UUID v7, timestamps, error codes) in `packages/shared/src/common.ts`
- [X] T021 [P] Implement UUID v7 generator used by web and api in `packages/shared/src/uuid.ts`
- [X] T022 Configure Better Auth base (email+password, Google provider, Drizzle adapter, cookie `httpOnly; Secure; SameSite=Lax`, `role` field default `user`) in `apps/api/src/lib/auth.ts`; generate its schema into `apps/api/src/db/schema/auth.ts`
- [X] T023 Mount Hono app with routes prefix `/api`, pino request logger with redaction of `authorization`, `cookie`, `apiKey`, `password` fields, error handler, `/api/health/live` (no DB, liveness) and `/api/health` (DB ping, readiness), and trust the client IP only from `CF-Connecting-IP` (configurable `AUTH_IP_HEADER`) in `apps/api/src/app.ts`
- [X] T024 Implement middlewares `requireSession`, `requireAdmin`, `originCheck` (state-changing methods require `Origin` == `BETTER_AUTH_URL` origin) in `apps/api/src/lib/middleware.ts`
- [X] T025 Implement generic sync engine (entity registry with Zod schema + Drizzle table + owner check + reference validation; push apply in one transaction; pull by cursor with limit 500 and `hasMore`) in `apps/api/src/routes/sync.ts` and `apps/api/src/lib/sync-registry.ts` (per `contracts/sync.md`)
- [X] T026 [P] Define Dexie database (versioned schema, `outbox`, `meta` with cursor/clientId) in `apps/web/src/db/database.ts`
- [X] T027 Implement client sync engine (repository helpers that write entity + outbox atomically, push then pull, triggers: `online`, app open, every 60 s, after set/session, Background Sync where available) in `apps/web/src/db/sync.ts`
- [X] T028 [P] Implement typed API client (fetch + shared Zod schemas from @gym/shared, validated responses) and auth client (Better Auth React) in `apps/web/src/lib/api.ts` and `apps/web/src/lib/auth-client.ts`
- [X] T029 [P] Set up i18n with Spanish strings file `apps/web/src/i18n/es.json` and helper `apps/web/src/i18n/index.ts`, plus a test `apps/web/src/i18n/i18n.test.ts` that fails on missing keys and an ESLint rule (`i18next/no-literal-string` or equivalent) that fails on hard-coded UI text in JSX
- [X] T030 Build app shell (layout, bottom navigation: Entrenar, Rutinas, Ejercicios, Progreso, Perfil; offline indicator; sync status badge) in `apps/web/src/routes/__root.tsx` and `apps/web/src/components/AppShell.tsx`
- [X] T031 Configure `vite-plugin-pwa` with `injectManifest`, web manifest in Spanish (name, icons 192/512/maskable, `display: standalone`, theme colors) and base service worker precaching the app in `apps/web/vite.config.ts` and `apps/web/src/sw/sw.ts`; update strategy `prompt` (no automatic `skipWaiting`): show «Hay una versión nueva» and never reload while a workout session is `in_progress`, apply on next open or when the user accepts after finishing
- [X] T032 [P] Request `navigator.storage.persist()` after install/first login and detect empty local DB to force full resync (`cursor=0`) in `apps/web/src/db/persistence.ts`
- [X] T033 [P] Wrap Dexie writes with timeout + one retry (iOS 26 IndexedDB hang, WebKit 315804) and handle `QuotaExceededError` (show «Tu teléfono no tiene espacio», free space by evicting cached catalog images first, never drop outbox or session data) in `apps/web/src/db/safe-write.ts`
- [X] T034 [P] Create Caddyfile (serve PWA with SPA fallback, immutable cache for `/media/*` and hashed assets, no-cache for `sw.js`/`index.html`, reverse proxy `/api/*` to api) in `infra/Caddyfile`
- [X] T035 [P] Create Dockerfiles `infra/docker/web.Dockerfile` (build web → Caddy image with catalog media) and `infra/docker/api.Dockerfile` (api + worker, numeric non-root user), base images pinned by `@sha256`, built for `linux/amd64` and pushed to the Forgejo registry `registry.example.com/carlos/gym-web` and `registry.example.com/carlos/gym-api`
- [X] T036 Create Kubernetes manifests in `deploy/k8s/` following the existing cluster conventions (see `../finanzas/deploy/k8s/`): `namespace.yaml` (`gym`); `postgres.yaml` (Service headless + StatefulSet `postgres:17-alpine@sha256:…`, Longhorn PVC 10 GiB, `pg_isready` probes, 60 s grace); `app.yaml` (Service `gym` port 80 → `web`; Deployments `web`, `api` with startup/readiness `/api/health` and liveness `/api/health/live`, `worker`; images `version@sha256`; `imagePullSecrets: gym-registry`; `envFrom` `gym-secrets`; `AUTH_IP_HEADER=cf-connecting-ip`; non-root securityContext, drop ALL, seccomp RuntimeDefault; requests/limits); `migrate-job.yaml` (Job whose first step runs a mandatory `pg_dump` pre-migration backup to the backups volume and aborts the migration if the backup fails — constitution: backup before every migration); `network-policy.yaml` (web only from `cloudflare/app=cloudflared` and own namespace; api only from own namespace; postgres only from own namespace); `secret.example.yaml` without values (never applied)
- [X] T037 Document deployment in `deploy/README.md` in Spanish, mirroring `../finanzas/docs/DESPLIEGUE.md`: create secrets and `gym-registry` pull secret, `docker buildx build --platform linux/amd64 … --push`, pin digests, `ssh root@k8s-master.example.com 'kubectl apply -f -' < deploy/k8s/<file>.yaml`, Cloudflare Zero Trust public hostname → `http://gym.gym.svc.cluster.local:80`, rollout and smoke check
- [X] T038 [P] Create Playwright fixtures (start test compose, migrate, seed helpers, create users with invites, two browser contexts helper, offline toggle) in `e2e/fixtures/index.ts`
- [ ] T039 Stage 0 deploy: build and push images to Forgejo, create secrets, apply `deploy/k8s/*.yaml` over SSH, add the public hostname to the cluster tunnel (Carlos, in Cloudflare Zero Trust); verify `https://<domain>/api/health` and that the empty PWA installs on Android and iOS (live check, record results in `specs/001-gym-pwa-mvp/checklists/stage-0.md`)

**Checkpoint**: base lista — PWA vacía instalable por HTTPS a través del túnel, sync genérico probado.

---

## Phase 3: User Story 1 - Cuenta e instalación (Priority: P1) 🎯 MVP

**Goal**: registro por invitación, ingreso con correo o Google, recuperación de contraseña, perfil con lugares y equipo, aislamiento por usuario.

**Independent Test**: crear cuenta con invitación, instalar la app, cerrar sesión, entrar desde otro navegador y ver el mismo perfil y lugares; sin invitación → rechazado; usuario B no ve datos de A.

### Tests for User Story 1 ⚠️

- [X] T040 [P] [US1] Integration tests for invitations (sign-up without code → 403 `INVITE_REQUIRED`; used or expired code → 403; valid code marks `usedBy/usedAt`; only SHA-256 hash stored) in `apps/api/tests/invitations.test.ts`
- [X] T041 [P] [US1] Integration tests for profile/location sync entities (validation ranges, owner isolation, `role` cannot be changed via sync, profile `id` must equal the session user id so two devices onboarding offline converge on one profile — last write wins) in `apps/api/tests/profile-sync.test.ts`
- [X] T042 [P] [US1] E2E: sign-up with invite → onboarding wizard → locations «Casa» (mancuernas, banda) and «Gimnasio» (completo) → sign out → sign in in a second context sees same data; measure sign-up + onboarding duration and assert < 3 min of interaction (SC-007), in `e2e/us1-account.spec.ts`
- [X] T043 [P] [US1] E2E negative: sign-up without/used invite rejected; user B cannot read/edit A's profile or locations via API (404, no DB change); POST without Origin → 403, in `e2e/us1-security.spec.ts`
- [X] T044 [P] [US1] E2E password reset: email arrives in Mailpit and link sets new password, in `e2e/us1-password-reset.spec.ts`

### Implementation for User Story 1

- [X] T045 [P] [US1] Create `invitations` table (`id`, `codeHash`, `createdBy`, `email?`, `expiresAt`, `usedBy?`, `usedAt?`) in `apps/api/src/db/schema/invitations.ts`
- [X] T046 [P] [US1] Create `profiles` table per data-model (`id` = user id, not a client UUID; `goal` enum fuerza|hipertrofia|resistencia|salud|perdida_grasa, `level`, `daysPerWeek` 1–7, `sessionMinutes`, `units` kg|lb, `bodyweightKg?`, `birthYear?`, `sex?`, `medicalAckAt`) in `apps/api/src/db/schema/profiles.ts`
- [X] T047 [P] [US1] Create `locations` table (`name`, `equipment[]` of Equipment.slug, `isDefault`) in `apps/api/src/db/schema/locations.ts`
- [X] T048 [P] [US1] Define Zod schemas Profile and Location in `packages/shared/src/profile.ts`
- [X] T049 [US1] Enforce invitation in Better Auth `databaseHooks.user.create.before` (email sign-up requires `inviteCode`; Google sign-up of a new user requires a pending invite stored in a short-lived cookie) and consume invite after create in `apps/api/src/lib/invitations.ts`
- [X] T050 [US1] Configure password reset and email verification emails (Spanish templates) via SMTP in `apps/api/src/lib/mailer.ts`
- [X] T051 [US1] Register `profile` and `location` in the sync registry in `apps/api/src/lib/sync-registry.ts`
- [X] T052 [US1] Implement CLI scripts `admin:invite` (prints one-time code) and `admin:promote <email>` (sets `role=admin`) in `apps/api/src/cli/admin.ts`
- [X] T053 [P] [US1] Build sign-up (with invite code field, prefilled from `?invite=` link), sign-in (email + Google), forgot/reset password screens in `apps/web/src/routes/auth/`
- [X] T054 [US1] Build onboarding wizard (goal, level, days/week, minutes, units, locations with equipment checklist from vocabulary, medical disclaimer acceptance) in `apps/web/src/features/onboarding/`
- [X] T055 [P] [US1] Build Perfil/Ajustes screen (edit profile, manage locations, sign out) in `apps/web/src/routes/profile.tsx`
- [X] T056 [P] [US1] Build install prompt (Android `beforeinstallprompt`, iOS instructions «Compartir → Agregar a inicio») in `apps/web/src/features/install/InstallPrompt.tsx`
- [X] T057 [US1] Live check US1 on phone and desktop (install, sign in, second device), record in `specs/001-gym-pwa-mvp/checklists/us1-live.md`

**Checkpoint**: US1 funcional y probada en los tres niveles.

---

## Phase 4: User Story 2 - Catálogo de ejercicios en español (Priority: P1)

**Goal**: ~870 ejercicios en español con imágenes, filtros por músculo/equipo/lugar, mapa de músculos, créditos, favoritos y ejercicios propios, disponible sin conexión.

**Independent Test**: buscar «sentadilla», filtrar por «Casa» y ver sólo lo posible con su equipo; abrir uno con imágenes, mapa e instrucciones en español; repetir en modo avión.

### Tests for User Story 2 ⚠️

- [ ] T058 [P] [US2] Unit tests for importer (field mapping, name normalization and fedb↔wger matching, every exercise has `nameEs`, ≥1 `instructionsEs`, ≥1 primary muscle, license and author kept per media) in `packages/catalog/src/import.test.ts`
- [ ] T059 [P] [US2] Unit tests for catalog filters (location equipment ⊇ exercise equipment, bodyweight always allowed, text search accent-insensitive) in `packages/shared/src/catalog-filter.test.ts`
- [ ] T060 [P] [US2] E2E: filter «Casa» + «pecho» returns only compatible exercises; detail shows images, body map, Spanish steps and credits; create own exercise visible only to its owner; favorites sync to second context; repeat detail offline; after loading a new catalog version where an exercise is retired, past sessions and routines still show it and search hides it, in `e2e/us2-catalog.spec.ts`

### Implementation for User Story 2

- [ ] T061 [P] [US2] Define vocabularies Muscle (`slug`, `nameEs`, `group`, `bodyMapZones[]`, `size`) and Equipment (`slug`, `nameEs`, `category`) in `packages/shared/src/vocabulary.ts`
- [ ] T062 [P] [US2] Define Exercise Zod schema per data-model (`id` stable `fedb:*|wger:*|user:*`, `measure` weight_reps|reps|time|distance, `level` beginner|intermediate|expert, `media[]` with required `license`, `retiredAt`) in `packages/shared/src/exercise.ts`
- [ ] T063 [US2] Implement free-exercise-db importer (download pinned commit of `dist/exercises.json` + images) mapping to Exercise in `packages/catalog/src/sources/fedb.ts`
- [ ] T064 [US2] Implement wger importer (exerciseinfo with Spanish translations, images, videos, license fields) in `packages/catalog/src/sources/wger.ts`
- [ ] T065 [US2] Implement merge + Spanish translation step (prefer wger Spanish text; translate the rest with AI using a cached, reviewable `translations/es.json`; never overwrite reviewed entries) in `packages/catalog/src/merge.ts` and `packages/catalog/translations/es.json`
- [ ] T066 [US2] Implement catalog build (WebP conversion ≤ 60 MB total, `catalog.json` versioned, `manifest.json` with version/sha256/size/imageCount, credits aggregation) in `packages/catalog/scripts/build.ts`
- [ ] T067 [P] [US2] Create `exercises` table for user-owned exercises and `favorites` table in `apps/api/src/db/schema/exercises.ts`; register both in sync registry
- [ ] T068 [US2] Implement public routes `/catalog/manifest`, `/catalog/v/:version/catalog.json`, `/credits` in `apps/api/src/routes/catalog.ts`; media served by Caddy from the web image
- [ ] T069 [US2] Client catalog loader: compare manifest version, download and replace in one Dexie transaction keeping exercises with `retiredAt` (hidden from search, still resolvable by id for history and routines; never deleted), precache images in background via service worker in `apps/web/src/features/catalog/catalog-loader.ts` and `apps/web/src/sw/sw.ts`
- [ ] T070 [US2] Implement catalog filter/search shared logic in `packages/shared/src/catalog-filter.ts`
- [ ] T071 [P] [US2] Build exercise list with search and filters (músculo, equipo, lugar, nivel, categoría) in `apps/web/src/routes/exercises/index.tsx`
- [ ] T072 [P] [US2] Build exercise detail (image start/end alternating animation, video if any, body map with `react-body-highlighter`, steps, author/license) in `apps/web/src/routes/exercises/$id.tsx`
- [ ] T073 [P] [US2] Build create/edit own exercise form in `apps/web/src/features/catalog/OwnExerciseForm.tsx`
- [ ] T074 [P] [US2] Build Créditos page in `apps/web/src/routes/credits.tsx`
- [ ] T075 [US2] Manual review of top 100 exercises' Spanish names/steps, record in `packages/catalog/translations/REVIEW.md`
- [ ] T076 [US2] Live check US2 in airplane mode on phone, record in `specs/001-gym-pwa-mvp/checklists/us2-live.md`

**Checkpoint**: catálogo completo offline, probado en los tres niveles.

---

## Phase 5: User Story 3 - Entrenar y registrar sin conexión (Priority: P1)

**Goal**: rutinas, sesión en curso con series, temporizador de descanso, sustitutos, todo offline y sincronizado.

**Independent Test**: en modo avión crear rutina, hacer sesión completa con temporizador, cerrar a mitad y reabrir; reconectar y ver la sesión en otro dispositivo sin duplicados.

### Tests for User Story 3 ⚠️

- [ ] T077 [P] [US3] Unit tests for SetEntry validation by `measure`, kg storage with lb display conversion, superset grouping in `packages/shared/src/workout.test.ts`
- [ ] T078 [P] [US3] Unit tests for substitutes (same primary muscle, equipment available, ranked by similarity, every result has a non-empty Spanish `reason`) in `packages/engine/src/substitutes.test.ts`
- [ ] T079 [P] [US3] Unit tests for rest timer (absolute end time, survives reload, overtime display) in `apps/web/src/features/session/rest-timer.test.ts`
- [ ] T080 [P] [US3] Integration tests for workout entities sync (references session→exercise→set validated within batch or same owner; setEntry never conflicts) in `apps/api/tests/workout-sync.test.ts`
- [ ] T081 [P] [US3] E2E offline: create routine, full session, reload mid-session keeps sets, finish, reconnect, second context sees session once within 60 s of reconnecting (SC-002); logging a set takes ≤ 2 taps from the session screen (SC-001); routine edited in two offline contexts keeps latest in `e2e/us3-offline-session.spec.ts`
- [ ] T082 [P] [US3] Integration tests for push rest-timer scheduling and cancel in `apps/api/tests/push.test.ts`

### Implementation for User Story 3

- [ ] T083 [P] [US3] Define Zod schemas Program, Routine (items: `position`, `exerciseId`, `supersetGroup?`, `targetSets`, `repMin?`, `repMax?`, `targetSeconds?`, `targetRir?`, `restSeconds`, `notes?`), WorkoutSession (`status` in_progress|completed|discarded), SessionExercise, SetEntry (`type` warmup|normal|failure|drop, `weightKg?`, `reps?`, `seconds?`, `meters?`, `rir?`, `rpe?`, `suggested?`) in `packages/shared/src/workout.ts`
- [ ] T084 [P] [US3] Create tables `programs`, `routines` (items jsonb), `workout_sessions`, `session_exercises`, `set_entries` in `apps/api/src/db/schema/workout.ts`; register all in sync registry
- [ ] T085 [P] [US3] Implement substitutes returning `{exerciseId, score, reason}` with a Spanish explanation (e.g. «Trabaja pecho y tríceps con mancuernas, que tienes en Casa») in `packages/engine/src/substitutes.ts`
- [ ] T086 [US3] Build routines list/editor (add exercises from catalog, reorder, supersets, targets, rest, duplicate, delete) in `apps/web/src/routes/routines/`
- [ ] T087 [US3] Build active session screen (start from routine or empty, log set in ≤ 2 taps with prefilled last values, set type, RIR/RPE, notes, swap exercise, finish/discard, summary) in `apps/web/src/routes/session/$id.tsx` and `apps/web/src/features/session/`
- [ ] T088 [US3] Implement rest timer with absolute end time, Screen Wake Lock during session, sound + vibration in `apps/web/src/features/session/rest-timer.ts`
- [ ] T089 [US3] Implement Web Push: VAPID routes, subscriptions, `ScheduledPush` table and pg-boss job firing rest-end notifications, cancel on next set in `apps/api/src/routes/push.ts`, `apps/api/src/db/schema/push.ts`, `apps/api/src/jobs/rest-push.ts`; service worker `push` handler in `apps/web/src/sw/sw.ts`
- [ ] T090 [US3] Offer to close sessions `in_progress` > 6 h on app open in `apps/web/src/features/session/stale-session.ts`
- [ ] T091 [US3] Live check US3 in a real gym-like airplane-mode run (Android + iPhone installed), including locked-screen push with network, record in `specs/001-gym-pwa-mvp/checklists/us3-live.md`

**Checkpoint**: MVP mínimo útil (US1+US2+US3) — se puede usar a diario.

---

## Phase 6: User Story 4 - Recomendaciones inteligentes sin conexión (Priority: P2)

**Goal**: sugerencia de carga con explicación, recuperación por músculo, rutina de hoy, récords y 1RM.

**Independent Test**: con historial sembrado, la sugerencia sube tras 3×10 completas, se mantiene/baja tras dos fallos, y la rutina de hoy evita músculos fatigados y respeta el equipo de casa.

### Tests for User Story 4 ⚠️

- [ ] T092 [P] [US4] Unit tests for progression (double progression, increments 2,5 kg barbell / 1–2 kg dumbbell, two failed sessions → hold or −10 %, RIR adjustment, Spanish `reason`) in `packages/engine/src/progression.test.ts`
- [ ] T093 [P] [US4] Unit tests for 1RM (Epley; Brzycki ≤10 reps; only sets 1–12 reps) and PR detection (max_weight, max_reps, est_1rm, max_volume) in `packages/engine/src/records.test.ts`
- [ ] T094 [P] [US4] Unit tests for recovery (primary 1, secondary 0,5 effective sets; exponential decay with half-life by muscle size 24–48 h; thresholds recuperado/parcial/fatigado) in `packages/engine/src/recovery.test.ts`
- [ ] T095 [P] [US4] Unit tests for today's routine (focus on most recovered/least trained muscles, location equipment filter, time budget = sets × (work + rest), compound before isolation, routine and each item carry a Spanish `reason`) in `packages/engine/src/today.test.ts`
- [ ] T096 [P] [US4] E2E with seeded history: suggestion shown with reason; body map shows fatigue; «Rutina de hoy» 30 min en casa excludes legs after heavy leg day; PR toast on new best — all offline, in `e2e/us4-smart.spec.ts`

### Implementation for User Story 4

- [ ] T097 [P] [US4] Implement progression in `packages/engine/src/progression.ts`
- [ ] T098 [P] [US4] Implement 1RM and PR detection in `packages/engine/src/records.ts`
- [ ] T099 [P] [US4] Implement recovery model in `packages/engine/src/recovery.ts`
- [ ] T100 [US4] Implement today's routine generator with a Spanish `reason` for the chosen focus and for each exercise (e.g. «Piernas descansan: las trabajaste ayer») in `packages/engine/src/today.ts` (depends on T099)
- [ ] T101 [US4] Show suggestion + «¿por qué?» in session set row and store `suggested` on SetEntry in `apps/web/src/features/session/Suggestion.tsx`
- [ ] T102 [P] [US4] Build recovery body map screen in `apps/web/src/features/smart/RecoveryMap.tsx`
- [ ] T103 [US4] Build «Rutina de hoy» flow (objective, minutes, location → preview → start session) in `apps/web/src/features/smart/TodayRoutine.tsx`
- [ ] T104 [US4] PR toast on set save and PR list per exercise (derived locally from history) in `apps/web/src/features/smart/records.ts`
- [ ] T105 [US4] Live check US4, record in `specs/001-gym-pwa-mvp/checklists/us4-live.md`

**Checkpoint**: inteligencia local funcionando sin conexión.

---

## Phase 7: User Story 5 - Progreso y datos propios (Priority: P2)

**Goal**: gráficas, medidas corporales, exportar/importar, borrar cuenta, respaldos.

**Independent Test**: ver gráficas con historial; exportar, borrar la cuenta, crear otra, importar y comprobar que todo vuelve.

### Tests for User Story 5 ⚠️

- [ ] T106 [P] [US5] Unit tests for progress aggregations (weekly frequency, volume per muscle, streak, est-1RM series) in `packages/engine/src/progress.test.ts`
- [ ] T107 [P] [US5] Integration tests for export/import (format `formatVersion: 1`; unknown version or invalid file → 422 and no changes; transactional all-or-nothing) and account deletion (`{confirm:"BORRAR"}` + recent re-auth; cascade removes all user rows) in `apps/api/tests/user-data.test.ts`
- [ ] T108 [P] [US5] E2E: export → delete account → new account → import → same routines, sessions, measurements, own exercises (SC-008) in `e2e/us5-data.spec.ts`
- [ ] T109 [P] [US5] Integration tests for backups in `deploy/backup/backup.test.sh`: daily script produces a restorable dump; migrate Job writes a pre-migration dump before applying migrations; a forced backup failure stops the migration and leaves the schema unchanged

### Implementation for User Story 5

- [ ] T110 [P] [US5] Define BodyMeasurement schema and table (`measuredAt`, `weightKg?`, `bodyFatPct?`, `waistCm?`, `chestCm?`, `armCm?`, `thighCm?`, `notes?`; excluded from logs) in `packages/shared/src/measurement.ts` and `apps/api/src/db/schema/measurements.ts`; register in sync
- [ ] T111 [P] [US5] Implement progress aggregations in `packages/engine/src/progress.ts`
- [ ] T112 [US5] Implement `/me/export`, `/me/import`, `DELETE /me` in `apps/api/src/routes/me.ts`
- [ ] T113 [P] [US5] Build Progreso screens (per-exercise charts, weekly frequency, volume per muscle, streak) with Recharts in `apps/web/src/routes/progress/`
- [ ] T114 [P] [US5] Build body measurements screen and chart in `apps/web/src/features/progress/Measurements.tsx`
- [ ] T115 [US5] Build data screen (export, import with confirmation, delete account flow) in `apps/web/src/routes/profile.data.tsx`
- [ ] T116 [US5] Implement backups like `../finanzas/deploy/`: scripts `deploy/backup/backup.sh` (daily dump verified on creation, keep 30 days and at least 7) and `deploy/backup/verify.sh` (monthly restore into a scratch DB), ConfigMap `deploy/k8s/backup-scripts.yaml`, CronJobs in `deploy/k8s/backup.yaml` (03:30 and day 1 05:00, `timeZone: America/Santiago`, Longhorn PVC `gym-backups` 5 GiB), and restore procedure in `deploy/README.md`
- [ ] T117 [US5] Live check US5 including a restore drill into a scratch DB, record in `specs/001-gym-pwa-mvp/checklists/us5-live.md`

**Checkpoint**: progreso y control total de los datos.

---

## Phase 8: User Story 7 - Administración de la IA (Priority: P3)

**Goal**: pantalla sólo para el admin: interruptor de IA, clave cifrada con prueba de conexión, modelo, límites, gasto, bitácora, invitaciones.

**Independent Test**: como admin guardar clave, probar, desactivar IA y ver que el coach queda no disponible; usuario normal recibe 403.

### Tests for User Story 7 ⚠️

- [ ] T118 [P] [US7] Unit tests for key encryption (AES-256-GCM round trip with `APP_ENCRYPTION_KEY`, wrong key fails, only `last4` exposed) in `apps/api/src/lib/crypto.test.ts`
- [ ] T119 [P] [US7] Integration tests for `/admin/settings/ai*` (non-admin → 403; enable without key → 409 `AI_KEY_MISSING`; PUT key tested against fake AI server, invalid → 422 `AI_KEY_INVALID` not stored; GET never returns key; audit rows written without secret; availability rule `aiEnabled ∧ key ∧ !pausedReason`) in `apps/api/tests/admin-settings.test.ts`
- [ ] T120 [P] [US7] E2E: admin saves key → sees `••••abcd` → disables AI → `/coach/status` unavailable; normal user cannot open admin route; grep API logs for key → absent, in `e2e/us7-admin.spec.ts`

### Implementation for User Story 7

- [ ] T121 [P] [US7] Create `app_settings` single-row table per data-model (`aiEnabled` default false, `aiModel` enum `claude-haiku-5-5` (default) | `claude-sonnet-5-5` | `claude-opus-5-5`, ciphertext/iv/tag, `aiApiKeyLast4`, `aiDailyLimitPerUser` 0–500 default 20, `aiMonthlyBudgetUsd` default 5.00, `aiPausedReason`, `aiPricing` json, `updatedBy`, `updatedAt`) and `admin_audit` table in `apps/api/src/db/schema/admin.ts`
- [ ] T122 [P] [US7] Implement AES-256-GCM helpers in `apps/api/src/lib/crypto.ts`
- [ ] T123 [US7] Implement settings service (30 s cache, key resolution DB → `ANTHROPIC_API_KEY` fallback, availability check, monthly spend sum) in `apps/api/src/lib/ai-settings.ts`
- [ ] T124 [US7] Implement AI client factory with `@anthropic-ai/sdk` and connection test (minimal request with given key/model) in `apps/api/src/lib/ai-client.ts`
- [ ] T125 [US7] Implement routes `/admin/settings/ai` (GET, PATCH), `/admin/settings/ai/key` (PUT, DELETE), `/admin/settings/ai/test`, `/admin/audit`, `/admin/invitations` (POST, GET, DELETE) with request-body logging disabled for the key route in `apps/api/src/routes/admin.ts`
- [ ] T126 [US7] Build Administración screen (AI switch, key field with «Probar conexión», model select, limits, month spend, pause reason with «Reanudar», audit list, invitations with copyable link) visible only to `role=admin` in `apps/web/src/routes/admin.tsx`
- [ ] T127 [US7] Live check US7 with the real key on the deployed app, record in `specs/001-gym-pwa-mvp/checklists/us7-live.md`

**Checkpoint**: IA controlada por el admin sin desplegar de nuevo.

---

## Phase 9: User Story 6 - Coach con IA (Priority: P3)

**Goal**: programa de varias semanas y revisión semanal en español con Haiku 5.5, validados contra el catálogo, con límites y costo.

**Independent Test**: pedir un programa; sólo usa ejercicios del catálogo con el equipo declarado; aceptarlo y entrenarlo; superar el límite → aviso.

### Tests for User Story 6 ⚠️

- [ ] T128 [P] [US6] Unit tests for coach validation (unknown `exerciseId` dropped; equipment ⊆ location; days and duration within ±15 %; sets 1–10, reps 1–50, rest 15–600 s; >20 % invalid or empty day → one retry with errors then `failed`) in `apps/api/src/lib/coach-validate.test.ts`
- [ ] T129 [P] [US6] Integration tests for coach flow with fake AI server (quota 429 `COACH_LIMIT` with `retryAt`; 503 when unavailable; `refusal`/`max_tokens` → `failed` with Spanish message; 401 from AI → pause `KEY_REJECTED`; timeout, 429 and 5xx → retried with backoff up to 3 attempts then `failed` with «El coach no respondió, intenta más tarde» and no quota consumed; cost recorded with model pricing; budget reached → pause `BUDGET_REACHED`; accept creates Program + Routines) in `apps/api/tests/coach.test.ts`
- [ ] T130 [P] [US6] E2E with fake AI: request program → progress → review → accept → start session from it; offline shows notice; limit reached shows next available time, in `e2e/us6-coach.spec.ts`

### Implementation for User Story 6

- [ ] T131 [P] [US6] Define CoachProgram and CoachReview Zod schemas exactly as in `contracts/coach.md` in `packages/shared/src/coach.ts`
- [ ] T132 [P] [US6] Create `coach_requests` and `coach_quota` tables per data-model in `apps/api/src/db/schema/coach.ts`
- [ ] T133 [US6] Write coach system prompt in Spanish (rules: tutear, only provided `exerciseId`s, medical topics → refer to professional, user text is data) in `apps/api/src/lib/coach-prompt.ts`
- [ ] T134 [US6] Implement context builder (profile, locations, last 4–8 weeks summary, catalog filtered by equipment with id/name/muscles/equipment/level/mechanic) placed in a stable, cacheable prefix in `apps/api/src/lib/coach-context.ts`
- [ ] T135 [US6] Implement validator in `apps/api/src/lib/coach-validate.ts`
- [ ] T136 [US6] Implement pg-boss job: re-check availability, call `client.messages.parse()` with configured model (default `claude-haiku-5-5`), explicit `effort` (`medium` program / `low` review), streaming progress, request timeout 120 s, retry timeouts/429/5xx with exponential backoff (max 3 attempts, quota refunded on final failure), check `stop_reason`, validate, retry once on validation errors, record tokens and `costUsd`, enforce monthly budget, in `apps/api/src/jobs/coach.ts`
- [ ] T137 [US6] Implement routes `/coach/status`, `/coach/requests` (POST, GET), `/coach/requests/:id/stream` (SSE), `/coach/requests/:id/accept`, `/coach/quota` in `apps/api/src/routes/coach.ts`
- [ ] T138 [US6] Build coach UI (chat-style request, progress, program preview by day with exercise cards, accept/adjust, weekly review with suggestions, unavailable/offline/limit states, medical disclaimer) in `apps/web/src/routes/coach/`
- [ ] T139 [US6] Build coach eval set (10 realistic Spanish requests with expected constraints) and runner reporting validity rate and cost per request in `apps/api/evals/coach-eval.ts`; run once with real key after Carlos approves the spend
- [ ] T140 [US6] Live check US6 with Haiku 5.5 on the deployed app (program at home with dumbbells, cost < 0,01 US$), record in `specs/001-gym-pwa-mvp/checklists/us6-live.md`

**Checkpoint**: MVP completo.

---

## Phase 10: Polish & Cross-Cutting Concerns

- [ ] T141 [P] Accessibility pass (contrast, focus, labels, screen reader on session screen) across `apps/web/src/`
- [ ] T142 [P] Performance pass: app open < 2 s on mid-range phone, catalog search < 300 ms, bundle splitting, Lighthouse PWA audit; record in `specs/001-gym-pwa-mvp/checklists/performance.md`
- [ ] T143 [P] Security review: owner filter on every query, Origin check, rate limits on auth routes, secrets only in K8s Secret, logs redaction (no health data, no keys) — fix findings
- [ ] T144 [P] Update `README.md` (setup, scripts, deploy, architecture) and `docs/` with final decisions
- [ ] T145 Full regression: `pnpm test`, `pnpm e2e`, and complete `quickstart.md` level 3 on Android and iPhone; record what was and wasn't tested in `specs/001-gym-pwa-mvp/checklists/release.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)** → historias.
- **US1** (cuentas) es requisito práctico de todas las demás (sin sesión no hay sync).
- **US2** (catálogo) depende de US1 sólo para favoritos/ejercicios propios; el catálogo público puede avanzar en paralelo.
- **US3** depende de US2 (rutinas usan ejercicios).
- **US4** depende de US3 (necesita historial de series).
- **US5** depende de US3 (gráficas de sesiones); medidas y exportación pueden avanzar en paralelo.
- **US7** depende de Foundational y US1 (rol admin); puede hacerse en paralelo con US4/US5.
- **US6** depende de US7 (ajustes y clave), US2 (catálogo) y US3 (programas → rutinas).
- **Polish** al final.

### Within Each User Story

- Pruebas primero (deben fallar) → esquemas/tablas → servicios/motor → rutas → pantallas → prueba en vivo.
- Cada historia se cierra con las tres pruebas del principio III y su checklist en vivo.

### Parallel Opportunities

- Setup: T003–T013 en paralelo.
- Foundational: T014–T016 (pruebas), T020–T021, T026, T028–T029, T032–T035, T038 en paralelo.
- Dentro de cada historia, las tareas [P] de pruebas, esquemas y pantallas independientes.
- US7 en paralelo con US4/US5; el motor de US4 (T097–T099) en paralelo entre sí.

---

## Parallel Example: User Story 4

```bash
# Pruebas del motor a la vez:
Task: "Unit tests for progression in packages/engine/src/progression.test.ts"
Task: "Unit tests for 1RM and PR in packages/engine/src/records.test.ts"
Task: "Unit tests for recovery in packages/engine/src/recovery.test.ts"
Task: "Unit tests for today's routine in packages/engine/src/today.test.ts"

# Implementaciones independientes a la vez:
Task: "Implement progression in packages/engine/src/progression.ts"
Task: "Implement 1RM and PR detection in packages/engine/src/records.ts"
Task: "Implement recovery model in packages/engine/src/recovery.ts"
```

---

## Implementation Strategy

### MVP First

1. Phase 1 + Phase 2 (incluye etapa 0: PWA vacía instalable vía túnel).
2. US1 → validar en los tres niveles.
3. US2 + US3 → **MVP mínimo útil para entrenar a diario**; desplegar y usar.

### Incremental Delivery

4. US4 (inteligencia local) → desplegar.
5. US5 (progreso y datos) → desplegar.
6. US7 (administración) → US6 (coach con Haiku 5.5) → desplegar.
7. Polish + regresión completa.

---

## Notes

- Commits pequeños en inglés (Conventional Commits) por tarea o grupo lógico.
- Ninguna tarea se marca completa sin su prueba; lo no probado se declara en el checklist en vivo.
- Las pruebas de punta a punta nunca se corren contra la base de producción.
