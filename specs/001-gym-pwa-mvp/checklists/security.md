# Pulido · Revisión de seguridad (T143)

Fecha: 2026-11-23 · Revisión independiente del código (agente aparte) + arreglos verificados en
los tres niveles. Sin hallazgos críticos; ningún camino para leer o aceptar datos de otra persona.

## Hallazgos y arreglos
| # | Hallazgo | Arreglo | Prueba que falla al revertir |
|---|---|---|---|
| M1 | Avisos push: aceptaba cualquier dirección → el worker podía usarse para sondear servicios internos | Sólo HTTPS de los servicios push reales (Google, Mozilla, Apple, Microsoft); máx. 10 dispositivos y 1 aviso pendiente por persona; regla de red de salida para API y worker (sólo DNS, la base e internet en 443/587/465/2525, nunca la red interna) | `push.test.ts` (2) |
| M2 | Sin límite de tamaño: un archivo enorme tumbaba la API | 2 MB en general, 20 MB para importar (413 con mensaje en español); tope en Caddy (25 MB); tope de filas en la importación | `security.test.ts` |
| M3 | Sin política de seguridad de contenido (CSP) | CSP estricta: todo desde el propio sitio, sin scripts en línea | En vivo (abajo) |
| L1 | Carrera teórica: dos usuarios con el mismo id simultáneo | La escritura repite el filtro de dueño | — (cubierto por pruebas existentes) |
| L2 | Referencias a lugares, rutinas o ejercicios propios de otra persona se aceptaban | Se exige mismo dueño (se aceptan los propios ya borrados, para no perder cambios sin conexión); la importación remapea todo id desconocido; `coachRequestId` sólo lo pone el servidor | `sync-references.test.ts` (2) |
| L3 | Ejercicios propios (texto del usuario) en las instrucciones del coach y sin tope | Van en el mensaje del usuario, máx. 50; nombres de lugares escapados | `coach.test.ts` |
| L4 | Pedidos o «Aceptar» simultáneos al coach se duplicaban | Índice único «una consulta en curso por persona» (migración 0007) y aceptación atómica | `coach.test.ts` |
| L5 | Un endpoint push pasa a quien lo registre último | Se mantiene (es el comportamiento correcto al cambiar de cuenta en el mismo navegador; los endpoints son secretos) | — |
| L6 | Claves de prueba en el compose de pruebas | Sólo pruebas; producción usa `secret/gym-secrets` | — |

## Verificado
- Unitarias e integración: 207 en verde.
- Punta a punta: suite completa 131/131 (dos veces seguidas). Se encontró y corrigió que las
  pruebas de IA, aun omitidas en otros navegadores, reiniciaban los ajustes a mitad de la prueba de
  Chromium (ahora el archivo sólo existe en Chromium).
- En vivo (Claude in Chrome): un script en línea inyectado queda bloqueado por la CSP, también
  cuando la página la sirve el service worker; catálogo con imágenes, gráficos, mapa muscular y
  coach funcionan sin ningún bloqueo en la consola.

## Pendiente
- Ingreso con Google no se pudo probar en local (no hay credenciales de Google): revisar en el
  servidor que la CSP no lo afecte (es una redirección, no debería).
- Intermitentes bajo carga, no relacionadas con estos cambios (pasan 6/6 y 8/8 solas): segundo
  dispositivo en WebKit tarda más de 20 s en la primera carga (US3) y cierre de sesión en iPhone
  (US1).
- Aplicar la nueva regla de red en el clúster y comprobar que el correo y la IA siguen saliendo.
