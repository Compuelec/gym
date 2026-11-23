# Research — 001 Gym PWA MVP

Fecha: 2026-11-22. Cada decisión: **Decisión / Razón / Alternativas**.

## R1. Lenguaje
- **Decisión**: TypeScript 5.x en cliente, servidor y paquetes compartidos; Node.js 24 LTS.
- **Razón**: un solo lenguaje y tipos compartidos (esquemas Zod usados por formulario, API y sync).
- **Alternativas**: Flutter/Dart (PWA pesada), Python/Go en servidor (dos lenguajes; la IA se usa
  por API, Python no aporta ventaja).

## R2. Cliente PWA
- **Decisión**: React 19 + Vite + `vite-plugin-pwa` (Workbox, estrategia `injectManifest` para
  poder escribir lógica propia en el service worker), TanStack Router + TanStack Query,
  Tailwind CSS + shadcn/ui, Recharts, `react-body-highlighter` (o fork sin dependencias) para el
  mapa de músculos.
- **Razón**: SPA instalable con caché completa; ecosistema maduro; el mapa de músculos existe en
  React; camino a tiendas con Capacitor.
- **Alternativas**: Next.js (SSR innecesario en una app privada y offline), SvelteKit/Vue (menos
  componentes listos para este dominio).

## R3. Almacenamiento local y sincronización
- **Decisión**: Dexie (IndexedDB) como base local + **sincronización propia push/pull**:
  bandeja de cambios (outbox) en el cliente, `POST /sync/push` idempotente por `mutationId`,
  `GET /sync/pull?cursor=` con cursor monotónico del servidor (no reloj del cliente),
  IDs UUID v7 generados en el cliente (salvo `profile`, cuyo id es el del usuario), borrado
  lógico, «gana el último cambio aplicado en el servidor» por registro.
- **Razón**: datos por usuario, pequeños y casi sin conflictos (las series son sólo-agregar).
  Cero servicios adicionales (principio VI). El cursor del servidor evita el problema de relojes
  desfasados (caso borde de la spec).
- **Alternativas**: Dexie Cloud autoalojado (licencia/madurez sin verificar, ata el backend),
  PowerSync (servicio extra con replicación lógica; sobredimensionado para <20 usuarios),
  ElectricSQL/RxDB (curva de aprendizaje y más piezas). Se reevalúa si aparecen datos
  compartidos entre usuarios (social/entrenadores).

## R4. Persistencia en iOS
- **Hallazgos**: desde Safari 17 la app instalada tiene la misma cuota que el navegador; WebKit
  puede excluir de la limpieza a un sitio en modo persistente y lo concede por heurística (p. ej.
  si está instalado). Existe un error reportado en iOS 26 (WebKit 315804) donde la primera
  transacción de escritura de IndexedDB puede colgarse tras suscribirse a push y navegar.
- **Decisión**: pedir `navigator.storage.persist()` tras instalar; vaciar la bandeja de cambios
  en cuanto haya red (el servidor es la fuente de verdad); detectar base local vacía y
  re-descargar todo; envolver escrituras con tiempo límite y reintento; prueba en vivo específica
  en iPhone instalado.
- **Alternativas**: depender sólo del almacenamiento local (riesgo de pérdida).

## R5. Temporizador de descanso con pantalla bloqueada
- **Hallazgos**: la API Notification Triggers (notificación local programada) no está disponible
  de forma estable; los temporizadores en página se congelan en segundo plano. Web Push sí llega
  con el teléfono bloqueado (iOS 16.4+ sólo con la app instalada) pero requiere red.
- **Decisión** en tres capas: (1) en primer plano, temporizador basado en hora absoluta de fin +
  Screen Wake Lock durante la sesión + sonido/vibración; (2) con red, el servidor programa un
  Web Push al fin del descanso (cancelable); (3) sin red y bloqueado, al volver se muestra el
  tiempo excedido. Se documenta como limitación conocida.
- **Alternativas**: sólo temporizador en página (falla bloqueado), sólo push (falla sin red).

## R6. Servidor y base de datos
- **Decisión**: Hono sobre Node.js (`@hono/node-server`), PostgreSQL 17, Drizzle ORM +
  drizzle-kit para migraciones, Zod para validación, pg-boss para trabajos en segundo plano
  (coach, push programados, limpieza).
- **Razón**: liviano, tipado de punta a punta (cliente RPC de Hono), sin Redis (principio VI).
- **Alternativas**: NestJS (más estructura y ceremonia de la necesaria), Fastify (equivalente;
  Hono tiene mejor cliente tipado), Prisma (más pesado; Drizzle es más cercano a SQL).

## R7. Autenticación e invitaciones
- **Decisión**: Better Auth (correo+contraseña, Google, recuperación por correo, sesiones por
  cookie `httpOnly`, `SameSite=Lax`, mismo dominio para PWA y API). Las invitaciones se
  implementan con una tabla propia y un hook de Better Auth antes de crear usuario (los plugins
  de invitación de la comunidad están en alfa). Migraciones del esquema de Better Auth generadas
  con su CLI hacia Drizzle.
- **Razón**: autoalojado, sin costo, TypeScript; invitaciones simples y bajo nuestro control.
- **Alternativas**: Lucia (discontinuado como librería), Auth.js (orientado a Next.js),
  Keycloak/Authentik (otro servicio que operar), Clerk/Supabase Auth (terceros de pago).
- **Correo**: SMTP configurable (proveedor transaccional con plan gratis); en pruebas, Mailpit.

## R8. Catálogo de ejercicios
- **Decisión**: paquete `catalog` con scripts de importación reproducibles: free-exercise-db
  (base, 873 con imágenes) + wger (650 traducciones al español, videos, licencias CC-BY-SA/CC0),
  cruce por nombre normalizado + revisión manual de dudosos; traducción del resto asistida por IA
  con revisión; vocabulario propio de músculos y equipo en español mapeado a las zonas del mapa
  del cuerpo; imágenes convertidas a WebP y servidas por nosotros. El catálogo se publica como
  paquete versionado (JSON + imágenes) que el cliente descarga y guarda.
- **Razón**: gratis, en español, sin dependencias en tiempo real, licencias trazables.
- **Alternativas**: ExerciseDB/MuscleWiki (licencias incompatibles con guardar contenido).

## R9. Motor inteligente local (`packages/engine`)
- **Decisión**: funciones puras y deterministas, compartidas por cliente y servidor:
  - **Progresión**: doble progresión (rango de repeticiones; al completar todas las series en el
    tope, subir carga con incremento según equipo: 2,5 kg barra, 1–2 kg mancuerna; si falla dos
    sesiones, mantener/bajar 10 %), ajustada por RIR/RPE.
  - **1RM estimado**: fórmula de Epley (y Brzycki para ≤10 reps), sólo con series de 1–12 reps.
  - **Recuperación**: fatiga por músculo = suma de series efectivas (principal 1, secundario 0,5)
    con decaimiento exponencial (vida media ~24–48 h según tamaño del músculo); umbrales para
    «recuperado/parcial/fatigado».
  - **Rutina de hoy**: elegir foco por músculos más recuperados y menos trabajados en la semana,
    filtrar por equipo del lugar, presupuesto de tiempo (series × (trabajo + descanso)), orden
    compuestos → aislados.
  - **Sustitutos**: ejercicios con ≥ coincidencia de músculo principal y equipo disponible,
    ordenados por similitud (músculos, mecánica, patrón).
  - Cada salida incluye un campo `reason` con la explicación en español.
- **Razón**: gratis, sin conexión, testeable al 100 % (principio IV).

## R10. Coach con IA
- **Decisión (ratificada por Carlos el 2026-11-22)**: API de Claude con el SDK oficial
  `@anthropic-ai/sdk` desde el servidor, modelo por defecto **`claude-haiku-5-5`**, salidas
  estructuradas con `client.messages.parse()` y esquema Zod (`output_config.format`) que sólo
  admite IDs del catálogo filtrado; tras la respuesta, validación propia: IDs existentes, equipo
  compatible, días y duración. `effort` explícito (`medium` para programas, `low` para
  revisiones), caché de prompt para el bloque estable (instrucciones + catálogo filtrado por
  equipo). Trabajo en cola (pg-boss) con streaming; límite 20 consultas/día/usuario y registro de
  tokens y costo por consulta.
- **Particularidades de Haiku 5.5**: piensa de forma adaptativa por defecto; su `effort` por
  defecto es `medium` (se fija explícito); **no tiene respaldo automático del servidor ante
  rechazos** (`stop_reason: "refusal"`), así que el worker revisa `stop_reason` y marca la
  solicitud como fallida con un mensaje claro. Al implementar se confirma con la API de modelos
  que soporta salidas estructuradas.
- **Modelo configurable**: el administrador puede cambiarlo desde la app a una lista permitida
  (`claude-haiku-5-5` por defecto, `claude-sonnet-5-5`, `claude-opus-5-5`); el precio por modelo
  se guarda en configuración para calcular el costo.
- **Costo estimado con Haiku 5.5** (0,10 US$ entrada / 0,50 US$ salida por millón de tokens, hasta
  100k tokens de entrada): un programa con ~6k de entrada y ~4k de salida ≈ **0,003 US$**; 20
  consultas diarias de un usuario ≈ 0,06 US$/día como máximo.
- **Alternativas**: ejecutar un modelo local en Proxmox (calidad y español inferiores, exige GPU),
  texto libre (viola principio IV).

## R11. Despliegue (ratificado por Carlos el 2026-11-22)
- **Decisión**: el **clúster Kubernetes propio** de Carlos, con el mismo esquema que sus otros
  proyectos, publicado por **Cloudflare Tunnel** (sin abrir puertos). Un namespace propio
  (`gym`) con:
  - `web`: Caddy sirviendo la PWA e imágenes del catálogo y haciendo proxy de `/api` a `api`
    (mismo origen ⇒ sin CORS y cookies simples).
  - `api` (Deployment, con sondas `/api/health`) y `worker` (Deployment, mismo imagen, otro
    comando).
  - `postgres` (StatefulSet con volumen persistente, o la instancia PostgreSQL que ya exista en
    el clúster si es lo habitual).
  - `migrate` (Job que corre las migraciones antes de cada versión).
  - `backup` (CronJob con `pg_dump` diario y rotación) + prueba de restauración documentada.
  - Secretos (`Secret` de Kubernetes): `DATABASE_URL`, `BETTER_AUTH_SECRET`,
    `APP_ENCRYPTION_KEY`, credenciales de Google y SMTP, claves VAPID.
  - La ruta de Cloudflare Tunnel apunta al Service de `web`.
- Imágenes construidas con Docker; los manifiestos viven en `infra/k8s/` (Kustomize con
  `base/` y `overlays/prod`). Docker Compose se mantiene **sólo** para desarrollo local y el
  entorno de pruebas desechable.
- **Pendiente para la etapa 0** (no bloquea el plan): confirmar cómo se hace «como siempre» —
  registro de imágenes, cómo se despliega (manual, Argo CD, Flux…), si `cloudflared` corre en el
  clúster y si ya hay un PostgreSQL compartido.
- **Alternativas**: LXC con Docker Compose (descartado: Carlos ya opera Kubernetes y un túnel
  estándar), nube gestionada (para la etapa comercial; los manifiestos son portables).

## R13. Ajustes de administración y clave de la IA
- **Decisión**: tabla `app_settings` (una fila global) editable sólo por el rol `admin` desde la
  pantalla «Administración» de la PWA: IA activada sí/no, modelo, límite diario, tope mensual y la
  clave del servicio de IA.
  - **La clave se pega en la pantalla de administración** y se guarda **cifrada** (AES-256-GCM)
    con una llave maestra `APP_ENCRYPTION_KEY` que vive en un `Secret` de Kubernetes (nunca en la
    base ni en el repositorio). Así la base o sus copias por sí solas no revelan la clave.
  - La API nunca devuelve la clave: sólo `••••` + últimos 4 caracteres y la fecha de cambio.
  - Botón «Probar conexión»: llamada mínima al servicio con la clave nueva antes de guardarla.
  - El worker lee los ajustes en cada trabajo (caché de 30 s), así activar/desactivar o cambiar
    la clave rige sin reiniciar.
  - Respaldo opcional: si la base no tiene clave y existe `ANTHROPIC_API_KEY` en el `Secret`, se
    usa esa (útil para el primer arranque).
  - Toda modificación queda en una bitácora (`admin_audit`) sin el valor de la clave.
  - La IA arranca desactivada.
- **Rol admin**: campo `role` en el usuario (`user` | `admin`); el primer admin se asigna por
  comando (`pnpm admin:promote <email>`) ejecutado como Job o `kubectl exec`.
- **Alternativas**: sólo `Secret` de Kubernetes (cambiar la clave exige `kubectl` y reiniciar;
  Carlos pidió poder hacerlo desde la app), clave en texto plano en la base (inseguro),
  gestor de secretos externo como Vault (servicio extra; viola principio VI por ahora).

## R12. Pruebas
- **Decisión**: Vitest (unitarias: engine, sync, validaciones, importador), Testcontainers o
  Compose de pruebas con PostgreSQL desechable para integración de la API, Playwright para punta
  a punta (incluye modo sin conexión con `context.setOffline`, dos contextos para sincronización,
  permisos entre usuarios) y revisión en vivo en Chrome y en un iPhone/Android reales.
- **Razón**: cumple el principio III.
