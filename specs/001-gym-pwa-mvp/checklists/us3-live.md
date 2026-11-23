# US3 · Entrenar y registrar sin conexión — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias e integración — 128 en verde
- Series: valores exigidos según cómo se mide (peso×reps, reps, tiempo, distancia) con mensajes en
  español; rangos; kg↔lb con ida y vuelta exacta; rango de repeticiones; superseries agrupadas.
- Sustitutos: mismo músculo principal, equipo del lugar, nunca el mismo ni retirados, orden por
  similitud, explicación en español («Trabaja pecho con mancuernas, disponible en Casa.»).
- Temporizador: hora de término absoluta, sobrevive a recargas, tiempo excedido, +15 s.
- Servidor: sesión completa sin conexión en un lote (sesión → ejercicio → series), referencias
  inexistentes o ajenas rechazadas, rutinas con ítems validados, último cambio gana.
- Push: requiere sesión, reprograma y cancela, rechaza horas pasadas o > 1 h, el worker envía una
  sola vez y sólo al dueño, elimina suscripciones vencidas (410), nadie borra suscripciones ajenas.

## Punta a punta — 100 por vuelta, 200/200 en dos vueltas
- Sesión completa sin conexión: rutina creada, entrenamiento iniciado en modo avión, primera serie
  con peso + un toque, segunda serie con **un solo toque** (SC-001), recarga a mitad sin perder
  nada y con el descanso vivo, ejercicio por repeticiones, cierre con esfuerzo, al reconectar llega
  todo una sola vez en menos de 60 s (SC-002), la siguiente vez muestra «Última vez…» y rellena.
- Cambiar ejercicio: equivalentes posibles en Casa con su explicación.
- Misma rutina editada en dos dispositivos: queda la más reciente.

## En vivo (Claude in Chrome)
- Actualización aplicada desde el aviso; entrenamiento libre; selector filtrado por Casa;
  16 kg × 10 registrado y segunda serie con un toque; descanso 1:29 visible; cierre con esfuerzo 6;
  resumen 1 min · 2 series · 320 kg; comprobado en la base.

## Errores encontrados y corregidos
- Las repeticiones se rellenaban con 10 en vez del objetivo de la rutina cuando la rutina cargaba
  después de la fila (detectado por la prueba de punta a punta).
- La imagen web no incluía el paquete del motor (detectado al construir).
- El disco virtual de Docker se llenó: se liberó sólo caché de compilación e imágenes sin etiqueta.

## Sin probar
- Aviso push real con el teléfono bloqueado: requiere teléfono real con la app instalada (etapa 0,
  T039). El envío está probado en integración con un emisor simulado; el entorno de pruebas ya
  tiene worker y claves VAPID de prueba.
- Bloqueo de actualización durante un entrenamiento: probado en unitarias, no de punta a punta.
