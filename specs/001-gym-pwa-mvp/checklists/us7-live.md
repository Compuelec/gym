# US7 · Administración de la IA — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias e integración — 178 en verde
- Cifrado AES-256-GCM: ida y vuelta, IV nuevo cada vez, falla con otra llave maestra o texto
  alterado, exige llave de 32 bytes, sólo se muestran 4 caracteres.
- Ajustes: sólo administradores (403 para usuarios, 401 sin sesión); arranca desactivada con Haiku
  5.5, 20 consultas/día y US$ 5/mes; no se activa sin clave (409); clave inválida probada y no
  guardada (422); clave válida cifrada, nunca devuelta; activar/desactivar cambia la
  disponibilidad del coach en la siguiente petición; probar conexión; modelo y límites; gasto del
  mes; reanudar una pausa; borrar la clave desactiva; bitácora completa y sin secretos.
- Invitaciones desde administración: código mostrado una sola vez, la lista no lo incluye,
  revocar invalida.

## Punta a punta (contra un servidor de IA falso que imita la API de Claude) — en Chromium
- Administrador real (comando `admin promote`): clave incorrecta rechazada, clave correcta
  guardada y mostrada como ••••wxyz, campo vacío después, «Probar conexión» correcto; activar y
  desactivar se refleja al instante para otro usuario (SC-010); un usuario normal recibe 403 en la
  API y ve «sólo para administradores»; la clave no aparece en los registros de la API; historial.
- Invitación creada desde la pantalla funciona y queda «Usada».
- Suite completa estable (estas pruebas corren una vez porque los ajustes son globales).

## En vivo (Claude in Chrome)
- El enlace «Administración» aparece tras dar el rol; clave guardada (••••wxyz), IA activada,
  «Disponible para los usuarios». En la base la clave está cifrada (el texto no aparece) y en los
  registros de la API hay 0 apariciones.

## Errores encontrados y corregidos
- El SDK actual envía la clave como `Authorization: Bearer` (el servidor falso sólo aceptaba
  `x-api-key`).
- El interruptor esperaba al servidor para marcarse → ahora es optimista.
- La barra «Sincronizando…» empujaba el contenido y hacía fallar toques en Safari → ahora es un
  indicador flotante que no mueve la pantalla.

## Decisiones
- Los ajustes se leen en cada petición (sin caché de 30 s): el cambio rige al instante.
- La tabla `coach_requests` se creó aquí porque el gasto del mes se calcula desde ella.
