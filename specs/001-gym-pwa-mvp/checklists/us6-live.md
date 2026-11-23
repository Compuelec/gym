# US6 · Coach con IA — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias e integración — 197 en verde (97 del servidor)
- Validación: ejercicios inventados y con equipo que no hay se descartan con el motivo en español;
  día vacío, más de 20 % inválido, más días que el perfil o sesión más larga que el tiempo (±15 %)
  → un reintento enviándole al modelo los errores; lugar desconocido → uno del usuario.
- Revisión semanal: sólo ajustes sobre rutinas y ejercicios del usuario.
- Temas de salud (dolor, lesión, embarazo…) → siempre lleva la nota de consultar a un profesional,
  aunque el modelo la olvide.
- Flujo completo contra un servidor de IA falso: programa válido con Haiku 5.5, tokens y costo
  registrados (< 0,01 US$); al modelo sólo se le ofrecen ejercicios posibles en ese lugar; aceptar
  crea el programa y sus rutinas, que llegan por sincronización; aceptar dos veces → 409;
  negativa del modelo → mensaje claro; errores 5xx/429 → 3 intentos y no gastan la cuota diaria;
  clave revocada → pausa «KEY_REJECTED»; límite diario → 429 con hora de reinicio; una consulta a
  la vez → 409; IA desactivada → 503 y el worker no llama al modelo; tope mensual → pausa
  «BUDGET_REACHED»; otro usuario no ve ni acepta consultas ajenas (404); sin perfil → aviso.

## Punta a punta (Chromium, servidor de IA falso)
- Pedir programa → «preparando» → programa por días con nombres en español → aceptar → aparecen
  las 3 rutinas → empezar una sesión con los objetivos del programa.
- Ejercicio inventado nunca llega a la pantalla; negativa explicada; tema de salud con nota;
  admin desactiva la IA → «no está disponible» y el resto de la app sigue funcionando.
- Límite diario con mensaje y fecha; sin conexión → aviso.
- Las pruebas de administración y del coach cambian ajustes globales: ahora corren juntas en serie
  (`ai-settings.spec.ts`). Suite completa: 131 pasan, 0 fallan.

## En vivo (Claude in Chrome, entorno local con IA falsa)
- Clave de prueba guardada y IA activada desde Administración; coach → «Te quedan 20 de 20»;
  programa recibido y aceptado; 3 rutinas «Fuerza en casa · Día N» en Rutinas.
- En la base: consulta «done», modelo `claude-haiku-5-5`, 4.000/1.500 tokens, costo 0,00115 US$,
  aceptada, rutinas del mismo dueño.

## Pendiente (necesita a Carlos)
- T139: el set de 10 pedidos y su script (`apps/api/evals/coach-eval.ts`) están listos; correrlo
  gasta dinero real (≈ 0,01–0,03 US$) → se ejecuta con tu aprobación y tu clave.
- T140: la prueba con Haiku 5.5 real se hace en el servidor ya publicado.

## Decisiones
- Progreso por consulta periódica cada 1,5 s en vez de SSE (`/stream`): la respuesta es una sola
  pieza estructurada y así no hay conexiones abiertas a través del túnel.
- La cuota diaria se calcula desde `coach_requests` (sin tabla `coach_quota`); las fallidas no
  cuentan.
- Cola en Postgres con `FOR UPDATE SKIP LOCKED` (igual que los avisos de descanso), sin pg-boss.
- El catálogo va dentro de la imagen de la API (el coach lo necesita en el servidor).
