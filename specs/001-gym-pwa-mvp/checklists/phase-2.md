# Fase 2 (base) — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias e integración (Vitest) — 53 en verde
- Servidor (PostgreSQL real desechable): salud, seguridad (401, Origin, 404 en español, rol no
  asignable, límite de intentos por IP de Cloudflare), sincronización (idempotencia, aislamiento
  entre usuarios, validación, referencias, lotes ≤ 200, último cambio gana, cursor monótono,
  borrados, paginación, pushes simultáneos del mismo dueño).
- Cliente (IndexedDB simulada): registro + bandeja de cambios atómicos, push/pull, sin conexión,
  401 sin perder cambios, reintento con espera creciente, rechazados, edición local pendiente no se
  pisa, lotes de 200, escritura segura (cuelgue de iOS y almacenamiento lleno), aviso de
  actualización bloqueado durante un entrenamiento, textos en español completos.
- Prueba de mutación: quitar el control de dueño hace fallar la prueba de aislamiento.

## Punta a punta (Playwright contra las imágenes reales: Caddy + API + PostgreSQL) — 34 en verde
- Chrome, Safari, Android y iPhone simulados: estructura en español, navegación, enlaces directos,
  manifiesto instalable, abrir sin conexión (Chromium), salud por el proxy, 401, 403 sin Origin o
  con otro Origin, POST real del navegador aceptado con cookie `httpOnly` y `SameSite=Lax`.
- 2 omitidas: el motor WebKit de Playwright no ejecuta service workers (se prueba en iPhone real en
  la etapa 0).

## En vivo (Claude in Chrome, contra el stack de producción local)
- Inicio y Rutinas renderizados en español, navegación por la barra inferior, service worker
  activo controlando la página, caché precargada, manifiesto enlazado, consola sin errores.

## Sin probar todavía
- T039: publicación en el clúster, túnel de Cloudflare e instalación en teléfonos reales (falta
  dominio y repositorio en Forgejo).
