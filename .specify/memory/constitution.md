<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (MINOR: materially expanded guidance)
- Modified principles: IV. Inteligencia acotada y explicable (admin on/off switch, key handling,
  low-cost model by default)
- Modified sections: Restricciones técnicas y legales (hosting: Kubernetes cluster on Proxmox +
  Cloudflare Tunnel)
- Added/removed sections: none
- Templates: read the constitution at runtime; no edits needed
- Deferred TODOs: none
-->

# Gym PWA Constitution

## Core Principles

### I. Offline-first

- Toda acción de entrenamiento (registrar series, crear o editar rutinas, ver el catálogo y el
  historial) MUST funcionar sin conexión y guardarse primero en el dispositivo.
- La sincronización con el servidor MUST ser automática, idempotente y no perder datos ante
  cortes, cierres de la app o reintentos.
- Ninguna pantalla de uso en el gimnasio MAY depender de una llamada de red para mostrarse.

**Razón**: en los gimnasios la señal es mala; una app que se cuelga a mitad de una serie no sirve.

### II. Español primero

- Toda la interfaz, los mensajes, los nombres e instrucciones de ejercicios y las respuestas del
  coach MUST estar en español neutro.
- El código, los comentarios, los commits y los PRs van en inglés.
- La arquitectura SHOULD permitir agregar otros idiomas sin rehacer pantallas.

**Razón**: el hueco de mercado es una app pensada en español, no traducida a medias.

### III. Pruebas en tres niveles (NO NEGOCIABLE)

Nada se declara terminado sin:
1. **Unitarias**: suite completa en verde; cada arreglo trae una prueba que falla al revertirlo.
2. **De punta a punta**: el camino real por HTTP con sesión, permisos y lo que NO se debe poder
   hacer, contra un entorno de pruebas desechable, nunca contra datos reales.
3. **En vivo en el navegador**: clics reales en la pantalla renderizada, incluido el modo sin
   conexión y la instalación de la PWA.

Cada entrega MUST informar qué se probó en cada nivel y qué quedó sin probar.

**Razón**: un script no se comporta como un navegador; sólo la prueba en vivo encuentra ciertos
fallos (lección del 2026-10-05).

### IV. Inteligencia acotada y explicable

- Las recomendaciones básicas (peso sugerido, recuperación, rutina del día) MUST salir de un motor
  de reglas determinista que funcione sin conexión y sin costo.
- La IA generativa MUST devolver datos estructurados y validados que sólo referencien ejercicios
  existentes del catálogo; nunca texto libre que la app ejecute a ciegas.
- Toda recomendación MUST poder explicarse al usuario («subimos 2,5 kg porque completaste 3×10»).
- El uso de IA MUST tener límite por usuario y registro de costo.
- El administrador MUST poder activar o desactivar la IA en cualquier momento sin desplegar de
  nuevo; con la IA desactivada, todo lo demás sigue funcionando.
- La clave del servicio de IA MUST guardarse cifrada, nunca devolverse completa al navegador ni
  aparecer en registros, y sólo el administrador puede cambiarla.
- Por defecto se usa el modelo de menor costo que cumpla la calidad; subir de modelo es una
  decisión explícita del administrador.
- La app MUST mostrar un aviso de que no reemplaza consejo médico.

**Razón**: confianza, costo controlado y seguridad física del usuario.

### V. Los datos son del usuario

- El usuario MUST poder exportar e importar todos sus datos en un formato abierto.
- El usuario MUST poder borrar su cuenta y todos sus datos.
- Cada usuario sólo MAY ver y modificar sus propios datos; toda consulta del servidor MUST filtrar
  por el dueño.
- Datos de salud (peso corporal, medidas) MUST tratarse como sensibles: nunca en registros de
  depuración ni enviados a terceros sin necesidad.

**Razón**: privacidad desde el inicio, requisito para el futuro comercial.

### VI. Simplicidad

- Empezar con lo mínimo que cumpla los principios: un repositorio, un lenguaje, una base de datos.
- Cada servicio, dependencia o capa adicional MUST justificarse en el plan (tabla de complejidad).
- YAGNI: no construir para escenarios comerciales hasta que existan, pero no cerrarles la puerta.

**Razón**: un desarrollador, un servidor casero; la complejidad es el mayor riesgo.

## Restricciones técnicas y legales

- **Lenguaje**: TypeScript en cliente, servidor y paquetes compartidos.
- **Alojamiento**: clúster Kubernetes propio (sobre Proxmox), publicado a internet sólo mediante
  Cloudflare Tunnel, sin abrir puertos; el despliegue MUST ser portable a otro clúster o a la nube
  sin reescribir.
- **HTTPS** obligatorio en todo entorno accesible desde el teléfono.
- **Licencias de contenido**: sólo fuentes de ejercicios cuya licencia permita guardarlas y
  servirlas nosotros; MUST conservarse autor y licencia de cada ejercicio, imagen y video, y
  mostrarse una página de créditos. Antes de cobrar, revisar las licencias de imágenes.
- **Sin dependencia en tiempo real** de APIs de terceros para el catálogo.
- **Secretos** nunca en el repositorio.

## Flujo de trabajo

- Desarrollo guiado por especificación con Spec Kit: constitución → especificación → aclaración →
  plan → tareas → implementación.
- Cada funcionalidad en su rama; commits pequeños, en inglés, siguiendo Conventional Commits.
- El plan de cada funcionalidad MUST pasar el «Constitution Check» antes de implementar.
- Copias de seguridad automáticas de la base de producción antes de cada migración.

## Governance

- Esta constitución prevalece sobre cualquier otra práctica del proyecto.
- Enmiendas: se proponen por escrito, se aprueban por Carlos, y se versionan con SemVer
  (MAJOR: se quita o redefine un principio; MINOR: principio o sección nueva; PATCH: redacción).
- Cada plan y cada revisión de código MUST verificar el cumplimiento; las excepciones se
  justifican en la tabla de complejidad del plan.

**Version**: 1.1.0 | **Ratified**: 2026-11-22 | **Last Amended**: 2026-11-22
