# Gym — reglas del proyecto

- Principios obligatorios: `.specify/memory/constitution.md`. Las funcionalidades nuevas siguen el
  ciclo spec-kit (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`).
  Funcionalidad actual: `specs/001-gym-pwa-mvp/`.
- Comandos: `pnpm dev`, `pnpm test`, `pnpm e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm check`.
- Monorepo pnpm: `apps/web` (PWA React), `apps/api` (Hono), `packages/{shared,engine,catalog}`, `e2e`.
- Toda consulta a datos de usuario se filtra por el dueño de la sesión.
- Pruebas en vivo en el navegador: con Claude in Chrome; chrome-devtools sólo para emular el ancho
  de celular.
- Despliegue: clúster Kubernetes por SSH, imágenes en el registro de Forgejo, túnel de Cloudflare.
  Los datos reales (host, registro, dominio) están en `deploy/site.env` (no versionado; plantilla
  en `deploy/site.env.example`). Guía: `deploy/README.md`. El repo es público en GitHub: nunca
  versionar hosts, IPs, dominios reales ni secretos.
- Remotos: `origin` = Forgejo (principal); `github` = espejo público en GitHub.
- Ramas: `main` = versión estable (lo que se instala en el servidor); `development` = integración.
  Cada funcionalidad nace de `development` en su propia rama (`NNN-nombre`), se prueba en los tres
  niveles y vuelve a `development` con merge `--no-ff`. Nunca se trabaja directo sobre `main`.
