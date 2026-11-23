# Implementation Plan: PWA de entrenamiento casa/gimnasio (MVP)

**Branch**: `001-gym-pwa-mvp` | **Date**: 2026-11-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-gym-pwa-mvp/spec.md`

## Summary

PWA instalable, en español y **offline-first** para entrenar en casa o en el gimnasio. El cliente
guarda todo primero en el dispositivo y sincroniza con un servidor propio en Proxmox. Incluye
catálogo propio de ~870 ejercicios (free-exercise-db + wger, en español), rutinas, sesión en curso
con temporizador, motor inteligente determinista que funciona sin conexión (progresión,
recuperación, rutina de hoy, sustitutos, récords) y un coach con IA (Claude Haiku 5.5 por
defecto) en el servidor que devuelve programas validados contra el catálogo; el administrador
activa/desactiva la IA y gestiona su clave desde la app. Se despliega en el clúster Kubernetes
propio con Cloudflare Tunnel. Detalle de decisiones en [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js 24 LTS

**Primary Dependencies**: Cliente: React 19, Vite, vite-plugin-pwa (Workbox), Dexie, TanStack
Router/Query, Tailwind + shadcn/ui, Recharts, react-body-highlighter. Servidor: Hono, Drizzle ORM,
Zod, Better Auth, pg-boss, web-push, `@anthropic-ai/sdk`.

**Storage**: PostgreSQL 17 (servidor); IndexedDB vía Dexie (cliente); archivos de imágenes
servidos por Caddy.

**Testing**: Vitest (unitarias e integración), PostgreSQL desechable en Docker, Playwright
(punta a punta y en vivo), dispositivos reales para PWA/iOS.

**Target Platform**: Navegadores modernos (Chrome/Edge/Firefox de escritorio y Android, Safari iOS
17+ instalada); servidor: clúster Kubernetes propio (sobre Proxmox), namespace `gym`, publicado
por Cloudflare Tunnel. Docker Compose sólo para desarrollo y pruebas.

**Project Type**: Aplicación web (PWA) + API, en monorepo pnpm.

**Performance Goals**: apertura de la app instalada < 2 s (SC-003); registrar una serie ≤ 2 toques
(SC-001); búsqueda en catálogo local < 300 ms; sincronización de una sesión < 1 min tras
reconectar (SC-002).

**Constraints**: todo el flujo de entrenamiento sin conexión; HTTPS obligatorio; catálogo base
completo cacheado (~870 ejercicios, objetivo < 60 MB de imágenes WebP); costo de IA acotado por
usuario.

**Scale/Scope**: < 20 usuarios iniciales; ~25 pantallas; diseño sin límites que impidan crecer.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cómo lo cumple el plan | Estado |
|---|---|---|
| I. Offline-first | Dexie + outbox; service worker cachea app, catálogo e imágenes; motor local; sólo coach y cuentas requieren red | ✅ |
| II. Español primero | UI y catálogo en español; textos en archivos de idioma desde el día 1; código/commits en inglés | ✅ |
| III. Pruebas en tres niveles | Vitest + Playwright (offline, dos dispositivos, permisos) + prueba en vivo en teléfonos reales; ver [quickstart.md](./quickstart.md) | ✅ |
| IV. Inteligencia acotada | Motor determinista con `reason`; IA con salida estructurada validada contra IDs del catálogo; límite y costo por usuario; aviso médico; interruptor de IA del admin sin desplegar; clave cifrada con llave maestra en `Secret`; Haiku 5.5 por defecto | ✅ |
| V. Datos del usuario | Exportar/importar JSON versionado; borrado de cuenta en cascada; toda consulta filtra por `userId`; datos de salud fuera de logs | ✅ |
| VI. Simplicidad | Un repo, un lenguaje, una base; sin Redis ni servicio de sync externo; servicios extra justificados abajo | ✅ (con justificación) |
| Restricciones | TypeScript; manifiestos Kubernetes portables (mismo patrón que finanzas/agendas); HTTPS sólo por Cloudflare Tunnel; licencias guardadas por ejercicio + página de créditos; secretos en `Secret` de Kubernetes / `.env` local, fuera del repo | ✅ |

**Re-check post-diseño (Fase 1)**: el modelo de datos ([data-model.md](./data-model.md)) incluye
`ownerId` en toda entidad de usuario, campos de licencia en contenido y borrado lógico para sync;
los contratos ([contracts/](./contracts/)) exigen sesión en todo endpoint salvo salud y catálogo
público, e idempotencia en `/sync/push`. Sin violaciones nuevas.

## Project Structure

### Documentation (this feature)

```text
specs/001-gym-pwa-mvp/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── api.md           # endpoints REST
│   ├── sync.md          # protocolo de sincronización
│   └── coach.md         # esquema de salida del coach
├── checklists/requirements.md
└── tasks.md             # lo genera /speckit-tasks
```

### Source Code (repository root)

```text
apps/
├── web/                     # PWA React
│   ├── src/
│   │   ├── routes/          # pantallas (TanStack Router)
│   │   ├── features/        # auth, catalog, routines, session, progress, coach, settings
│   │   ├── db/              # esquema Dexie, outbox, motor de sync del cliente
│   │   ├── sw/              # service worker (Workbox injectManifest)
│   │   └── i18n/es.json
│   └── tests/               # unitarias de UI
└── api/                     # Hono
    ├── src/
    │   ├── routes/          # auth, sync, catalog, coach, export, push, admin (invites, settings)
    │   ├── db/              # esquema Drizzle + migraciones
    │   ├── jobs/            # pg-boss: coach, push programado, backups
    │   └── lib/             # auth, ownership guard, ai client
    └── tests/               # integración con PostgreSQL desechable
packages/
├── shared/                  # esquemas Zod, tipos, vocabulario músculos/equipo
├── engine/                  # motor inteligente puro (+ tests)
└── catalog/                 # importadores free-exercise-db + wger, traducción, build del paquete
e2e/                         # Playwright (punta a punta y en vivo)
infra/
├── docker/                  # Dockerfiles de web (Caddy + PWA) y api/worker
├── docker-compose.dev.yml   # desarrollo local (postgres + mailpit)
├── docker-compose.test.yml  # entorno de pruebas desechable
└── Caddyfile
deploy/                      # mismo patrón que ../finanzas/deploy
├── k8s/                     # namespace, postgres, app (web/api/worker), migrate-job,
│                            # network-policy, backup + backup-scripts, secret.example (sin valores)
├── backup/                  # backup.sh y verify.sh
└── README.md                # guía de despliegue en español
docs/
```

**Structure Decision**: monorepo pnpm con dos apps (`web`, `api`) y tres paquetes. `engine` y
`shared` se usan en cliente y servidor, que es la razón de tener un monorepo TypeScript.

## Etapas de implementación (alineadas con las historias)

| Etapa | Historias | Entregable verificable |
|---|---|---|
| 0. Base | — | Monorepo, Compose de desarrollo, imágenes Docker, manifiestos Kubernetes, PWA vacía instalable por HTTPS vía Cloudflare Tunnel |
| 1. Cuentas | US1 | Registro por invitación, Google, perfil, lugares y equipo, aislamiento por usuario |
| 2. Catálogo | US2 | Importador, ~870 ejercicios en español, filtros, mapa de músculos, créditos, offline |
| 3. Entrenar | US3 | Rutinas, sesión, temporizador, sustitutos, outbox + sync, dos dispositivos |
| 4. Inteligencia local | US4 | Progresión, recuperación, rutina de hoy, récords, con explicaciones |
| 5. Progreso y datos | US5 | Gráficas, medidas, exportar/importar, borrar cuenta, respaldos |
| 6. Coach IA + administración | US6, US7 | Pantalla de administración (interruptor, clave cifrada, prueba de conexión, modelo, límites, gasto); programas y revisión semanal validados con Haiku 5.5 |

Cada etapa cierra con las tres pruebas del principio III.

## Riesgos principales

| Riesgo | Mitigación |
|---|---|
| iOS borra datos locales o error de IndexedDB (WebKit 315804) | `storage.persist()`, sync inmediato, recuperación desde servidor, prueba en iPhone real |
| Aviso de descanso con pantalla bloqueada | Wake Lock + push con red; limitación documentada sin red |
| Calidad de traducciones del catálogo | Priorizar las 650 de wger; revisión manual de los 100 ejercicios más usados |
| Licencia de fotos de free-exercise-db para uso comercial | Guardar origen por imagen; revisar antes de cobrar; reemplazo gradual |
| Costo de IA | Haiku 5.5 por defecto, límite diario, tope mensual con pausa automática, interruptor del admin, registro de costo |
| Calidad de Haiku para programas largos | Validación estricta + un reintento con los errores; conjunto de pruebas del coach; el admin puede subir de modelo sin desplegar |
| Filtración de la clave de IA | Cifrada con llave maestra en `Secret`; nunca se devuelve ni se registra; prueba negativa en punta a punta |
| Servidor casero caído | Respaldos diarios (CronJob) + la app sigue funcionando offline |

## Complexity Tracking

| Elemento adicional | Por qué hace falta | Alternativa más simple descartada porque |
|---|---|---|
| Proceso `worker` (pg-boss) | Llamadas largas a la IA y push programados no deben bloquear la API | Hacerlo en la petición HTTP: tiempos de espera y reintentos frágiles |
| Caddy como proxy | Servir PWA e imágenes con caché y unir PWA y API en un mismo origen detrás del túnel | Servir todo desde Node: peor caché de estáticos y más carga |
| Kubernetes (en vez de Compose) | Es la plataforma que Carlos ya opera con Cloudflare Tunnel; no agrega operación nueva | Compose en un LXC: sería una forma distinta de desplegar sólo para este proyecto |
| Cifrado de la clave de IA | Carlos pidió cargar la clave desde la app; guardarla en texto plano sería inseguro | Sólo `Secret` de Kubernetes: no permite cambiarla desde la app |
| Paquete `catalog` separado | Importación reproducible y auditable de licencias | Script suelto: imposible regenerar el catálogo con trazabilidad |
| Sync propio | Requisito offline (FR-016/017) | Sin sync: viola principio I; servicio externo: viola principio VI |
