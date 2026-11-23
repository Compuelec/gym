# US1 · Cuenta e instalación — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias e integración — 85 en verde
- Invitaciones: sin código → 403 `INVITE_REQUIRED` en español; uso único (también con dos
  registros simultáneos); guiones/espacios/mayúsculas; vencidas y revocadas; ligadas a un correo;
  sólo se guarda el hash; cookie firmada para Google (alterada o vencida → rechazada).
- Perfil y lugares: id del perfil = id del usuario; dos dispositivos convergen; rangos; equipo
  desconocido; el rol no cambia por sincronización; aislamiento entre usuarios.
- **Error encontrado y corregido**: el servidor devolvía fechas en formato de PostgreSQL y el
  segundo dispositivo no podía reenviar el perfil (rechazo silencioso). Prueba de ida y vuelta que
  falla sin el arreglo. Además, ahora se avisa en pantalla si un cambio es rechazado.
- **Error encontrado y corregido**: el perfil inexistente dejaba la app en «Cargando…» para siempre.
  Prueba que falla sin el arreglo.

## Punta a punta (imágenes reales + Mailpit) — 72 en verde, estable en 3 repeticiones (204/204)
- Registro con enlace de invitación → asistente (objetivo, días, Casa + Gimnasio con equipo,
  aviso médico obligatorio) → inicio → perfil → segundo dispositivo entra sin asistente y ve lo
  mismo → cambio en el segundo llega al primero. Menos de 3 minutos (SC-007).
- Sin conexión tras recargar: sigue dentro de la app; cambios guardados y sincronizados al volver.
- Cerrar sesión sincroniza y borra la base local del dispositivo.
- Lo que no se debe poder hacer: invitación inválida o reutilizada, usuario B contra datos de A por
  HTTP, pantallas sin sesión → ingreso, contraseña incorrecta con mensaje en español.
- Recuperar contraseña: correo en español llega a Mailpit, el enlace cambia la contraseña, funciona
  una sola vez.
- Página 404 en español.

## En vivo (Claude in Chrome)
- Aviso «Hay una versión nueva» con la versión anterior cacheada → «Actualizar» aplicó la nueva.
- Registro real con el enlace de invitación, asistente completo (se agregó «Banco» a Casa), saludo,
  perfil con el equipo en orden. Comprobado en la base: rol `user`, perfil, lugar principal y la
  invitación marcada como usada.
- Se detectó «Not Found» en inglés en rutas desconocidas → corregido (página 404 en español).

## Sin probar
- Ingreso con Google en vivo: falta configurar el cliente de Google (el camino de la invitación
  por cookie está probado en integración).
- Instalación en teléfonos reales (Android/iPhone): pendiente de la etapa 0 (T039).
