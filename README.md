# Gym

Aplicación web progresiva (PWA) en español para entrenar en casa o en el gimnasio: catálogo de
876 ejercicios con imágenes, rutinas, registro de series sin conexión, temporizador de descanso,
sugerencias inteligentes (progresión, recuperación muscular, rutina de hoy), progreso con
gráficos, mediciones, exportación de datos y un coach con IA (Claude Haiku 5.5) que el
administrador activa, desactiva y configura desde la app.

Registro sólo con invitación. Los datos de cada persona viven en su teléfono (funciona sin
conexión) y se sincronizan con el servidor.

## Arquitectura

```
apps/web        PWA (React 19, Vite, TanStack Router/Query, Tailwind, Dexie, service worker)
apps/api        API (Hono, Drizzle, PostgreSQL 17, Better Auth) + worker de trabajos
packages/shared esquemas Zod y vocabulario compartido (web ↔ API)
packages/engine motor inteligente puro (sustituciones, progresión, récords, recuperación, hoy)
packages/catalog importador del catálogo (free-exercise-db + nombres de wger)
e2e             pruebas de punta a punta (Playwright, navegador real)
infra           Caddy, Dockerfiles, pilas de Docker Compose, servidor de IA falso
deploy          manifiestos de Kubernetes y respaldos
```

- **Sin conexión primero:** cada cambio se guarda en el teléfono junto con una «bandeja de
  salida»; al volver la red se envía (push) y luego se traen los cambios (pull). Gana el último
  cambio aplicado en el servidor; nada se duplica (cada cambio tiene un id único).
- **Seguridad:** toda consulta se filtra por el dueño de la sesión; las peticiones que cambian
  datos exigen el `Origin` de la app; la clave de la IA se guarda cifrada (AES-256-GCM) y nunca se
  devuelve ni se registra; los datos de salud no se escriben en los registros.
- **Coach:** las consultas entran a una cola en Postgres; el worker llama a Claude con salida
  estructurada, valida cada ejercicio contra el catálogo y el equipo del lugar, reintenta una vez
  con los errores y registra tokens y costo. Hay límite diario por persona y tope de gasto mensual.
- **Catálogo:** archivos estáticos servidos por Caddy (`/catalog`, `/media`), con caché en el
  teléfono. Créditos y licencias en la pantalla «Créditos».

Detalle de decisiones: `specs/001-gym-pwa-mvp/` (especificación, plan, investigación, modelo de
datos, contratos) y principios en `.specify/memory/constitution.md`.

## Desarrollo

Requisitos: Node 24, pnpm 10, Docker.

```bash
pnpm install
cp .env.example .env              # completar; nunca subir .env
pnpm catalog:build                # descarga y arma el catálogo (fijado a un commit)
docker compose -f infra/docker-compose.dev.yml up -d   # Postgres + Mailpit
pnpm db:migrate
pnpm dev                          # web + API
pnpm admin:invite                 # imprime un código de invitación
pnpm admin:promote <correo>       # da rol de administrador
```

Para usar la app a mano con las imágenes de producción y datos que se conservan (sin IA):
`docker compose -f infra/docker-compose.local.yml up -d --build --wait` → http://localhost:8090
(correos en http://localhost:58030). Los secretos van en `.env.local` (no se sube); la invitación
se crea con `docker compose -f infra/docker-compose.local.yml exec api node --import tsx src/cli/admin.ts invite`.

La clave de la IA se carga desde **Administración → Clave del servicio de IA** (se prueba antes
de guardarla). `ANTHROPIC_API_KEY` en `.env` es sólo un respaldo opcional.

## Pruebas (tres niveles)

```bash
pnpm check        # revisión de código, tipos y pruebas unitarias
pnpm test         # unitarias e integración (necesita la base de pruebas: infra/docker-compose.test.yml)
pnpm e2e          # punta a punta contra la pila de imágenes de producción (infra/docker-compose.e2e.yml)
pnpm test:backup  # respaldo y restauración
```

La pila de punta a punta usa un servidor de IA falso (`infra/fake-ai`): no gasta dinero. La
evaluación del coach con el modelo real (`apps/api/evals/coach-eval.ts`) sí gasta y se corre sólo
con aprobación.

Cada etapa se prueba además en vivo en el navegador; los resultados quedan en
`specs/001-gym-pwa-mvp/checklists/`.

## Despliegue

Kubernetes del servidor (namespace `gym`), imágenes en Forgejo y publicación por el túnel de
Cloudflare. Guía paso a paso: [`deploy/README.md`](deploy/README.md).

Ramas: `main` = versión estable; `development` = integración; cada funcionalidad en su rama
`NNN-nombre`.

## Licencias de contenido

Ejercicios e imágenes de [free-exercise-db](https://github.com/yuhonas/free-exercise-db)
(Unlicense); algunos nombres en español de [wger](https://wger.de) (CC-BY-SA). El detalle por
ejercicio está en la pantalla «Créditos» de la app.
