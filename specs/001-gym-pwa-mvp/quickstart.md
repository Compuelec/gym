# Quickstart / Guía de validación — 001 Gym PWA MVP

Guía para comprobar que el MVP funciona. Detalles en [contracts/](./contracts/) y
[data-model.md](./data-model.md).

## Requisitos
- Node.js 24, pnpm, Docker con Compose.
- `.env` a partir de `.env.example` (nunca se sube al repositorio): `DATABASE_URL`,
  `BETTER_AUTH_SECRET`, `APP_ENCRYPTION_KEY`, `GOOGLE_CLIENT_ID/SECRET`, `SMTP_*`, `VAPID_*`.
  La clave de la IA **no** va aquí: se carga desde la pantalla de Administración
  (`ANTHROPIC_API_KEY` es sólo un respaldo opcional para el primer arranque).

## Levantar en local
```bash
pnpm install
pnpm catalog:build            # importa free-exercise-db + wger y genera el paquete del catálogo
docker compose -f infra/docker-compose.dev.yml up -d   # postgres + mailpit
pnpm db:migrate
pnpm dev                      # web + api con HTTPS local
pnpm admin:invite             # imprime un código de invitación
pnpm admin:promote <email>    # da rol de administrador
```

## Nivel 1 — Unitarias
```bash
pnpm test                     # Vitest en todo el monorepo
```
Esperado: verde. Cubre motor (`packages/engine`), validaciones, outbox/sync del cliente,
importador del catálogo, validación del coach (con respuestas grabadas, sin llamar a la IA).

## Nivel 2 — De punta a punta (entorno desechable)
```bash
docker compose -f infra/docker-compose.test.yml up -d   # postgres limpio + mailpit
pnpm e2e
```
Escenarios mínimos (Playwright, navegador real):
1. Registro con invitación → asistente → lugares «Casa» y «Gimnasio».
2. Registro sin invitación / invitación usada → rechazado.
3. Catálogo: filtro «Casa» + «pecho» sólo devuelve ejercicios con equipo de casa.
4. **Sin conexión** (`context.setOffline(true)`): crear rutina, sesión completa, cerrar y reabrir
   la página, terminar; volver a conectar; un **segundo contexto** con la misma cuenta ve la
   sesión sin duplicados.
5. Edición de la misma rutina en dos contextos sin conexión → queda la más reciente.
6. Usuario B intenta leer/editar datos de A por id → 404, sin cambios en la base.
7. `POST` sin `Origin` válido → 403.
8. Motor: con historial sembrado, la sugerencia sube carga tras 3×10 completas y la rutina de hoy
   evita los músculos fatigados.
9. Exportar → borrar cuenta → nueva cuenta → importar → mismos datos.
10. Coach con IA simulada (servidor falso): programa válido aceptado; ID inexistente descartado;
    límite diario → 429; respuesta `refusal` → solicitud fallida con mensaje claro.
12. Administración: el admin guarda una clave (el servidor falso la acepta), ve sólo `••••` +
    4 caracteres, desactiva la IA → el coach responde 503 y la PWA muestra el aviso; tope mensual
    alcanzado → pausa automática; un usuario normal recibe 403 en `/admin/*`; buscar la clave en
    respuestas, registros de la API y bitácora → no aparece.
11. Recuperación de contraseña: el correo llega a Mailpit y el enlace funciona.

## Nivel 3 — En vivo en el navegador y en el teléfono
1. Abrir la URL HTTPS en Chrome Android y Safari iOS; instalar en la pantalla de inicio.
2. Modo avión en el teléfono: abrir la app instalada, ver catálogo con imágenes, hacer una sesión
   con temporizador; volver a conectar y verla en el escritorio.
3. Temporizador: aviso con la app en primer plano; con red y pantalla bloqueada llega la
   notificación push (iOS instalada).
4. Revisar en la base que los registros tienen `ownerId` correcto y no hay duplicados.
5. Administración en vivo: pegar la clave real en la pantalla, «Probar conexión», activar la IA.
6. Coach real con Haiku 5.5: pedir un programa en casa con mancuernas; verificar que todos los
   ejercicios existen y usan mancuernas o peso corporal; revisar costo registrado (< 0,01 US$).
7. Desactivar la IA desde la pantalla y comprobar en el teléfono que el coach muestra el aviso.
8. Página de créditos visible y con autores/licencias.

## Despliegue en Kubernetes + Cloudflare Tunnel
Guía completa en `deploy/README.md` (mismo patrón que Al Día).
```bash
# imágenes (Forgejo)
docker buildx build --platform linux/amd64 -f infra/docker/web.Dockerfile \
  -t registry.example.com/carlos/gym-web:<versión> --push .
docker buildx build --platform linux/amd64 -f infra/docker/api.Dockerfile \
  -t registry.example.com/carlos/gym-api:<versión> --push .
# fijar los digests nuevos en deploy/k8s/app.yaml y migrate-job.yaml, luego aplicar:
ssh root@k8s-master.example.com 'kubectl apply -f -' < deploy/k8s/namespace.yaml
ssh root@k8s-master.example.com 'kubectl apply -f -' < deploy/k8s/postgres.yaml
ssh root@k8s-master.example.com 'kubectl apply -f -' < deploy/k8s/migrate-job.yaml
ssh root@k8s-master.example.com 'kubectl apply -f -' < deploy/k8s/app.yaml
ssh root@k8s-master.example.com 'kubectl apply -f -' < deploy/k8s/network-policy.yaml
# Cloudflare Zero Trust → Tunnels → Public Hostnames → http://gym.gym.svc.cluster.local:80
```
Comprobar: pods `web`, `api`, `worker` y `postgres` listos; `https://<dominio>/api/health`
responde a través del túnel; desde otro namespace la app no responde (NetworkPolicy); el
CronJob de respaldo generó su primer archivo y la verificación de restauración pasa.

## Al informar cada etapa
Indicar qué se probó en los tres niveles y qué quedó sin probar y por qué (principio III).
