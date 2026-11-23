# Gym — reglas del proyecto

- Principios obligatorios: `.specify/memory/constitution.md`. Las funcionalidades nuevas siguen el
  ciclo spec-kit (`/speckit-specify` → `/speckit-plan` → `/speckit-tasks` → `/speckit-implement`).
  Funcionalidad actual: `specs/001-gym-pwa-mvp/`.
- Comandos: `pnpm dev`, `pnpm test`, `pnpm e2e`, `pnpm lint`, `pnpm typecheck`, `pnpm check`.
- Monorepo pnpm: `apps/web` (PWA React), `apps/api` (Hono), `packages/{shared,engine,catalog}`, `e2e`.
- Toda consulta a datos de usuario se filtra por el dueño de la sesión.
- Pruebas en vivo en el navegador: con Claude in Chrome; chrome-devtools sólo para emular el ancho
  de celular.
- Despliegue: clúster Kubernetes por SSH (`ssh root@k8s-master.example.com 'kubectl apply -f -'`),
  imágenes en Forgejo `registry.example.com/carlos/gym-*`, túnel de Cloudflare. Guía: `deploy/README.md`.
- Ramas: `main` = versión estable (lo que se instala en el servidor); `development` = integración.
  Cada funcionalidad nace de `development` en su propia rama (`NNN-nombre`), se prueba en los tres
  niveles y vuelve a `development` con merge `--no-ff`. Nunca se trabaja directo sobre `main`.
