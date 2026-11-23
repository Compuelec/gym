# Cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones según
[SemVer](https://semver.org/lang/es/). `main` siempre es la última versión publicada.

## [0.2.0] — 2026-11-23

### Agregado
- Botón «Volver» en todas las pantallas secundarias; al volver a Ejercicios se mantienen los
  filtros y la posición en la lista.
- Elegir varios ejercicios del catálogo para crear una rutina, agregarlos a una existente o
  entrenar al tiro; «Agregar a una rutina» en la ficha de cada ejercicio.
- «Rutina de hoy» editable: foto de cada ejercicio, series, repeticiones y descanso ajustables,
  cambiar, quitar, reordenar y agregar ejercicios; duración en vivo frente al tiempo elegido con
  «Ajustar al tiempo»; guardar como rutina.

### Cambiado
- La rutina de hoy prioriza piernas, espalda y pecho cuando todo está recuperado y aprovecha el
  tiempo disponible.
- Filtros de Ejercicios plegados en el celular; avisos de carga en vez de pantallas en blanco.
- En el inicio, accesos para crear la primera rutina; el enlace del coach sólo aparece si la IA
  está activa.

### Corregido
- «Cambiar» ya no ofrece un ejercicio que ya está en el plan o la sesión.

## [0.1.1] — 2026-11-23

### Cambiado
- La imagen del servidor se empaqueta en pocos archivos y ya no lleva dependencias de desarrollo:
  pasa de 420 MB a 180 MB y se puede subir al registro detrás de Cloudflare. Los comandos del
  contenedor cambian a `node dist/index.mjs`, `dist/worker.mjs`, `dist/migrate.mjs` y
  `dist/admin.mjs`.

## [0.1.0] — 2026-11-23

Primera versión.

### Cuentas y sincronización
- Registro sólo con invitación, ingreso con correo y contraseña (o Google), recuperación de
  contraseña por correo.
- Funciona sin conexión: cada cambio se guarda en el teléfono y se sincroniza al volver la red,
  sin duplicados; varios dispositivos con la misma cuenta.
- Se instala como app (PWA) y avisa cuando hay una versión nueva; nunca se actualiza en medio de
  un entrenamiento.

### Ejercicios
- Catálogo de 876 ejercicios en español con imágenes, pasos, músculos y mapa del cuerpo.
- Búsqueda sin importar tildes ni mayúsculas; filtros por músculo, equipo, nivel y lugar.
- Favoritos y ejercicios propios.
- Equipo específico por lugar (pesas, bancos y barras, máquinas, cardio, accesorios): sólo se
  proponen ejercicios que se pueden hacer con lo que hay.

### Entrenar
- Rutinas con series, repeticiones o tiempo, descanso y superseries.
- Sesión guiada: foto animada y «Cómo se hace» en la misma tarjeta, meta del día ajustable
  (series, repeticiones, descanso), botones − / +, cambio por ejercicios equivalentes.
- Temporizador de descanso que sobrevive a recargas, con aviso en el teléfono aunque esté
  bloqueado (+15 s / −15 s).

### Sugerencias inteligentes
- Progresión de peso y repeticiones explicada («¿Por qué?»), récords personales.
- Mapa de recuperación muscular.
- «Rutina de hoy»: según recuperación, tiempo disponible y equipo del lugar; fuerza primero y
  cardio al final en la máquina que haya.

### Progreso y datos
- Gráficos con tablas, racha e historial; medidas corporales.
- Exportar e importar todos los datos; borrar la cuenta.

### Coach con IA (opcional)
- Programas de varias semanas y revisión semanal con Claude Haiku 5.5, validados contra el
  catálogo y el equipo; el administrador la activa, carga la clave (cifrada) y fija límites y
  tope de gasto.

### Seguridad y operación
- Cada consulta filtrada por dueño, protección de origen, límites de tamaño, política de
  seguridad de contenido, reglas de red en Kubernetes, respaldos antes de cada migración y
  diarios.
- Licencia GNU AGPL-3.0.

### Pendiente de verificar
- Ingreso con Google y avisos push en teléfonos reales: se prueban al instalar en el servidor.
- Coach con el modelo real (las pruebas usan un servidor de IA simulado).
- Traducción del catálogo hecha automáticamente, aún sin revisión humana.

[0.2.0]: https://github.com/Compuelec/gym/releases/tag/v0.2.0
[0.1.1]: https://github.com/Compuelec/gym/releases/tag/v0.1.1
[0.1.0]: https://github.com/Compuelec/gym/releases/tag/v0.1.0
