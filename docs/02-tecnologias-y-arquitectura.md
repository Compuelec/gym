# Tecnologías y arquitectura

> ⚠️ **Documento superado.** La versión vigente y ratificable está en `specs/001-gym-pwa-mvp/` (Spec Kit). Cambios desde aquí: IA con Claude Haiku 5.5 configurable por el administrador, y despliegue en el clúster Kubernetes propio + Cloudflare Tunnel. Decisiones tomadas al implementar: cola de trabajos en Postgres (`FOR UPDATE SKIP LOCKED`) en lugar de pg-boss, catálogo servido como archivos estáticos por Caddy, y avance del coach por consulta periódica en lugar de SSE. Resumen actual en el `README.md`.

> Fecha: 2026-11-22 · Fase 2 · Propuesta pendiente de aprobación

## Requisitos que guían las decisiones

| Requisito | Consecuencia técnica |
|---|---|
| Uso personal, con proyección comercial | Cuentas multiusuario desde el día 1, licencias de datos limpias, poder salir del servidor casero sin reescribir. |
| Cuentas y sincronización | Backend con base de datos central + autenticación propia. |
| Funciona en el gimnasio sin señal | **Offline-first**: la app escribe primero en el teléfono y sincroniza después. |
| Funciones inteligentes desde el inicio | Motor propio de reglas (gratis, sin conexión) + coach con IA en el servidor. |
| Alojado en Proxmox | Todo en contenedores Docker; HTTPS obligatorio (una PWA no funciona sin HTTPS). |

## Lenguaje: TypeScript en todo

**Recomendado.** Un solo lenguaje para la app, el servidor y los tipos compartidos: el mismo esquema que valida un formulario valida la API y la base.

Alternativas descartadas:
- **Flutter/Dart**: excelente para apps de tienda, pero su versión web es pesada y floja como PWA.
- **Python o Go en el servidor**: buenos, pero obligan a mantener dos lenguajes y a duplicar los tipos. La IA se consume por API, así que Python no aporta ventaja.

## Stack propuesto

### Aplicación (PWA)
| Pieza | Elección | Por qué |
|---|---|---|
| Framework | **React 19 + Vite** | SPA rápida; el mejor ecosistema; el mapa de músculos (`react-body-highlighter`) es de React; camino a tiendas con Capacitor. |
| PWA | **vite-plugin-pwa (Workbox)** | Service worker, instalación, caché de imágenes y de la app. |
| Base local | **Dexie (IndexedDB)** | Catálogo de ejercicios, rutinas e historial disponibles sin conexión. |
| Rutas y datos | TanStack Router + TanStack Query | Tipado de punta a punta, caché y reintentos. |
| Interfaz | Tailwind CSS + shadcn/ui | Componentes accesibles, modo oscuro, rápido de construir. |
| Gráficas | Recharts | Progreso, volumen, récords. |

### Servidor
| Pieza | Elección | Por qué |
|---|---|---|
| API | **Hono** sobre Node.js | Liviano, tipado, cliente RPC tipado para la PWA. |
| Base de datos | **PostgreSQL 17** | Robusta; `pgvector` disponible si luego buscamos ejercicios similares. |
| ORM | **Drizzle** + migraciones | SQL claro, tipos generados, sin magia. |
| Validación | **Zod** (paquete compartido) | Un esquema para formulario, API y sincronización. |
| Autenticación | **Better Auth** | Autoalojada, correo+contraseña y Google, sesiones seguras, sin pagar a terceros. |
| Imágenes | Archivos servidos por Caddy (luego MinIO/S3 si crece) | Simple al inicio, migrable. |
| Tareas en segundo plano | pg-boss (cola sobre PostgreSQL) | Llamadas a la IA, recálculos; sin sumar Redis. |
| IA | API de Claude con salidas estructuradas | El coach sólo puede elegir ejercicios existentes del catálogo (por ID). |

### Pruebas (alineadas con la regla de los tres niveles)
- **Unitarias**: Vitest (motor inteligente, sincronización, validaciones).
- **De punta a punta**: Playwright contra un entorno de pruebas en Docker con base desechable.
- **En vivo**: Playwright + revisión manual en el navegador del teléfono (instalación, modo avión).

## Arquitectura

```
 Teléfono / navegador (PWA)                       Servidor Proxmox (LXC o VM con Docker)
┌──────────────────────────────┐                 ┌───────────────────────────────────────┐
│ React UI                     │                 │ Caddy  (HTTPS, archivos, imágenes)    │
│   │                          │                 │   │                                   │
│ Motor inteligente local      │                 │ API Hono                              │
│ (sobrecarga, recuperación)   │   HTTPS / JSON  │   ├─ Auth (Better Auth)               │
│   │                          │ ◄─────────────► │   ├─ /sync  push · pull               │
│ Dexie (IndexedDB)            │                 │   ├─ /catalog (versión del catálogo)  │
│   ├─ catálogo                │                 │   └─ /coach  → cola → API de Claude   │
│   ├─ rutinas / sesiones      │                 │ PostgreSQL   ·   pg-boss               │
│   └─ bandeja de cambios      │                 │ Copias de seguridad diarias (pg_dump) │
│ Service worker (Workbox)     │                 └───────────────────────────────────────┘
└──────────────────────────────┘                        ▲
                                                        │ Cloudflare Tunnel o puerto 443 + dominio
                                                   Internet (acceso desde el gimnasio)
```

### Sincronización (offline-first)
1. Toda acción (marcar una serie, crear rutina) se guarda **primero en Dexie** y se anota en una **bandeja de cambios**.
2. Con conexión, la app **envía** la bandeja (`/sync/push`) y **pide** lo nuevo desde su último punto (`/sync/pull?since=…`).
3. Cada registro tiene `id` generado en el cliente (UUID v7), `updatedAt` y borrado lógico. Conflictos: gana el último cambio por registro; en la práctica casi no hay, porque cada usuario edita sólo lo suyo y las series son de «sólo agregar».
4. El catálogo de ejercicios se descarga por versión: sólo se baja de nuevo cuando cambia.

Se eligió sincronización propia (simple, sin dependencias) en lugar de PowerSync/ElectricSQL/RxDB: los datos son pocos, por usuario y casi sin conflictos.

### Funciones inteligentes en dos capas
**Capa 1 — Motor de reglas propio (en el teléfono, gratis, sin conexión):**
- Sugerencia de peso/repeticiones de la próxima serie (sobrecarga progresiva, RPE/RIR).
- Estado de recuperación por músculo (tiempo desde el último trabajo y volumen) → mapa de calor del cuerpo.
- Generador de rutina del día: objetivo + tiempo disponible + **equipo del lugar** (casa / gimnasio) + músculos recuperados.
- Récords personales y 1RM estimado; sustitución de ejercicio por otro equivalente con el equipo disponible.

**Capa 2 — Coach con IA (en el servidor, requiere conexión):**
- Crear un programa de varias semanas a partir de una conversación («quiero ganar fuerza, 3 días, tengo mancuernas en casa»).
- Revisión semanal: lee tu historial y propone ajustes, explicados en español.
- La IA devuelve JSON validado con Zod que **sólo puede usar IDs del catálogo**; el motor de la capa 1 ejecuta el plan.
- Límite de uso por usuario y registro de costos (pensando en el futuro comercial).

### Despliegue en Proxmox
- Un contenedor LXC (o VM) con Docker Compose: `caddy`, `api`, `postgres`, `worker`.
- **HTTPS real es obligatorio** para instalar la PWA y usar el service worker. Opciones: **Cloudflare Tunnel** (no abre puertos en tu red, recomendado) o dominio propio + puerto 443 con certificado automático de Caddy.
- Copias de seguridad diarias de PostgreSQL fuera del contenedor (snapshot de Proxmox + `pg_dump`).
- Entornos: `dev` (tu Mac), `test` (Docker desechable para las pruebas de punta a punta), `prod` (Proxmox).

### Estructura del repositorio (monorepo con pnpm)
```
gym/
├─ apps/
│  ├─ web/        PWA React
│  └─ api/        Hono + Drizzle + Better Auth + worker
├─ packages/
│  ├─ shared/     esquemas Zod, tipos, vocabulario (músculos, equipo)
│  ├─ engine/     motor inteligente (puro, testeable, usado por web y api)
│  └─ catalog/    scripts de importación free-exercise-db + wger, traducción
├─ infra/         docker-compose, Caddyfile, backups
└─ docs/
```

### Camino a lo comercial (sin reescribir)
- Multiusuario ya resuelto con las cuentas.
- Mover de Proxmox a la nube = el mismo Docker Compose.
- Apps en tiendas: envolver la PWA con **Capacitor**.
- Cobros: Stripe cuando haga falta; los límites de IA por usuario ya existen.
- Revisar licencia de las fotos de free-exercise-db antes de cobrar (ver doc 01).

## Plan por etapas (propuesta)
1. **Base**: monorepo, Docker, PostgreSQL, autenticación, PWA instalable con HTTPS en Proxmox.
2. **Catálogo**: importación + español + filtros por equipo/lugar + mapa de músculos.
3. **Entrenar**: rutinas, sesión en curso, temporizador, historial — sin conexión y sincronizado.
4. **Inteligencia capa 1**: sugerencias, recuperación, generador de rutina del día.
5. **Progreso**: gráficas, récords, medidas corporales, exportar/importar.
6. **Inteligencia capa 2**: coach con IA y revisión semanal.
