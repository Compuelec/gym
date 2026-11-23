# Análisis de mercado y fuentes de ejercicios

> Fecha: 2026-11-22 · Fase 1 del proyecto (antes de elegir tecnologías y arquitectura)

## 1. Qué hacen las apps que ya existen

Las apps se dividen en dos familias bien distintas. Casi ninguna cubre bien las dos.

### Familia A — Registro de entrenamiento en gimnasio («loggers»)

| App | Qué la distingue | Modelo de cobro | Lo que critican |
|---|---|---|---|
| **Hevy** | Registro rápido de series, rutinas, series de calentamiento/drop/fallo, temporizador de descanso, récords personales, 1RM estimado, gráficas, videos del ejercicio, red social, reloj (Apple Watch / WearOS). 4,9★ con ~94 mil reseñas en iOS. En 2026 sumó «Hevy Trainer» (programas por algoritmo). | Gratis con límites (4 rutinas, 3 meses de gráficas). Pro: 2,99–3,99 US$/mes, 23,99/año, 74,99 de por vida. | Límites del plan gratis. |
| **Strong** | Minimalista: sólo registrar, rápido y limpio. Exporta a CSV. | Gratis con límites + Pro. | No permite volver a importar tus datos. |
| **Fitbod** | Genera la sesión del día según tu historial y la recuperación de cada músculo. | Sin plan gratis (prueba de 3 entrenamientos). | Caro, todo detrás de suscripción. |
| **Jefit** | Plan de 12 semanas generado + el análisis de progreso más profundo. Biblioteca grande de ejercicios. | Gratis + Elite. | Interfaz cargada. |

### Familia B — Entrenamiento guiado en casa

| App | Qué la distingue | Modelo de cobro |
|---|---|---|
| **Freeletics** | «Coach» que arma cada sesión HIIT sin equipo; tras cada sesión calificas la dificultad y ajusta la siguiente. | Suscripción (≈35–80 US$ según duración). |
| **BetterMe** | +4.000 entrenamientos en casa (pilates, calistenia, fuerza, yoga, caminata). Plan creado con un cuestionario inicial. | Suscripción (≈10–15 US$/mes). |
| **Fitify** | Sesiones cortas en casa con coach por IA. | ≈70 US$/año. |
| **Nike Training Club** | Clases guiadas en video, gratis. | Gratis. |

### Funciones que se repiten en todas (lo mínimo esperable)

1. **Biblioteca de ejercicios** con imagen o animación, músculos trabajados, equipo e instrucciones.
2. **Rutinas**: crear, guardar, reutilizar; programas por semanas.
3. **Sesión en curso**: marcar series (peso × repeticiones), temporizador de descanso, notas.
4. **Progreso**: historial, récords personales, gráficas, 1RM estimado, medidas corporales.
5. **Filtro por equipo disponible** (clave para «casa vs. gimnasio»).
6. **Mapa del cuerpo** que muestra qué músculos trabaja un ejercicio o una semana.
7. Extras de las mejores: recomendación adaptativa (Fitbod/Freeletics), red social (Hevy), reloj inteligente.

### Huecos donde podemos destacar

- **Casa y gimnasio en la misma app.** Las de gimnasio no guían en casa y las de casa no sirven para registrar pesos. Propuesta: el usuario declara su equipo («casa: mancuernas y banda» / «gimnasio completo») y todo se filtra solo.
- **Español de verdad.** Casi todas están pensadas en inglés; la traducción suele ser parcial.
- **Funcionar sin internet.** En el gimnasio la señal suele ser mala. Una PWA con modo sin conexión resuelve eso sin pasar por las tiendas.
- **Gratis o barato sin límites artificiales.** Es la queja más repetida (Hevy, Fitbod, Strong).
- **Datos tuyos**: exportar *e* importar (la queja de Strong).

## 2. Fuentes de ejercicios, imágenes y referencias

Las dos primeras las **comprobé en vivo** hoy (números reales, no de blogs).

| Fuente | Cantidad | Imágenes / video | Español | Licencia | Costo | Veredicto |
|---|---|---|---|---|---|---|
| **free-exercise-db** (GitHub, yuhonas) | **876** ejercicios (JSON) | **873** con 2 fotos (posición inicial y final) | No (hay que traducir) | Unlicense (dominio público) — *ver advertencia* | Gratis | ⭐ **Base principal** |
| **wger** (API REST abierta) | **979** ejercicios | 395 imágenes (288 ejercicios) y 78 videos | **Sí: 650 traducidos** | Datos CC-BY-SA 4/3 (821+132) y CC0 (26). Software AGPL. | Gratis, sin clave | ⭐ **Complemento para español** |
| **ExerciseDB** v1 (exercisedb.dev) | ~1.500 | GIF animados | No | No está clara la licencia de los GIF | Gratis | ⚠️ Sólo si se aclara la licencia |
| **ExerciseDB** v2 (RapidAPI) | 11.000+ | 20.000 imágenes, 15.000 videos | No | Comercial | Gratis 10 consultas/día; pago | Caro para empezar |
| **MuscleWiki API** | Grande | Videos de calidad | Parcial | **Prohíbe guardar** imágenes/videos en tus servidores | Desde 10 US$/mes; el plan gratis no sirve desde tu app | ❌ Choca con el modo sin conexión |
| **API Ninjas – Exercises** | 3.000+ | Sin imágenes | No | Uso comercial prohibido en el plan gratis | Gratis/pago | ❌ Sin imágenes |
| **WorkoutX** | 1.300+ | GIF | No | Comercial | 500 consultas/mes gratis | Alternativa de pago |
| **ExRx.net** | Referencia técnica clásica | Sí | No | Licencia de pago | Pago | Sólo como referencia de consulta |

### Advertencias importantes de licencia

- **free-exercise-db**: el repositorio es dominio público, pero hay una pregunta abierta (issue #12) sobre si **las fotos** se pueden usar comercialmente. Para uso personal no hay problema; si la app va a cobrar, hay que revisarlo o reemplazar fotos con el tiempo.
- **wger (CC-BY-SA)**: obliga a **citar al autor** de cada ejercicio/imagen y a que los textos derivados se compartan con la misma licencia. Es manejable: una página de «Créditos» y guardar el autor de cada elemento.
- **MuscleWiki y ExerciseDB v2**: no permiten copiar el contenido; la app dependería de su servicio en cada consulta. Para una PWA sin conexión no conviene.

### Recursos visuales complementarios

- **Mapa de músculos**: `react-body-highlighter` (y forks sin framework como `body-highlighter`, o `body-muscles` con 70+ músculos). Dibuja el cuerpo en SVG y colorea los músculos de cada ejercicio. Hay que confirmar la licencia exacta antes de usarlo.
- **Animación barata**: las 2 fotos (inicio/fin) de free-exercise-db se pueden alternar para simular el movimiento, sin necesidad de GIF.

## 3. Recomendación de estrategia de datos

**No depender de una API externa en tiempo real.** Armar **nuestro propio catálogo** dentro de la app, alimentado una sola vez (y actualizable) desde las fuentes abiertas:

1. **Importar free-exercise-db** como base (876 ejercicios con fotos y campos limpios: músculo principal/secundario, equipo, nivel, mecánica, categoría).
2. **Cruzar con wger** para traer los nombres y descripciones en español que ya existen (650) y sus videos, guardando la licencia y el autor de cada uno.
3. **Traducir el resto** al español (asistido por IA y revisado), y normalizar un vocabulario propio de músculos y equipo en español.
4. **Etiquetar cada ejercicio por lugar**: «casa sin equipo», «casa con equipo básico», «gimnasio».
5. **Servir las imágenes desde nuestro propio almacenamiento** (y cachearlas en el teléfono para el modo sin conexión).

Ventajas: gratis, en español, funciona sin internet, no se rompe si un tercero cambia precios o cierra.

## 4. Preguntas para la siguiente fase (tecnologías y arquitectura)

Las respuestas cambian la arquitectura:

1. **¿Uso personal/familiar o producto para vender** (suscripción, publicidad, gimnasios)? → define licencias de imágenes y si hace falta cobro.
2. **¿Cuentas de usuario y sincronización entre dispositivos**, o basta con que los datos vivan en el teléfono?
3. **¿Funciones «inteligentes»** desde el inicio (rutina generada/adaptativa, coach por IA) o primero un buen registro y rutinas?
4. **¿Social** (compartir entrenamientos, amigos) o individual?
5. **¿Habrá entrenadores** que asignen rutinas a alumnos?
6. **¿Dónde quieres alojarla** (tu servidor Proxmox, un servicio en la nube) y con qué lenguajes te sientes más cómodo?

## Fuentes

- free-exercise-db: https://github.com/yuhonas/free-exercise-db (issue sobre imágenes: https://github.com/yuhonas/free-exercise-db/issues/12)
- wger: https://wger.de/api/v2/ · https://github.com/wger-project/wger
- ExerciseDB: https://exercisedb.dev/ · https://github.com/exercisedb/exercisedb-api
- MuscleWiki API: https://api.musclewiki.com/pricing · https://api.musclewiki.com/api-terms
- API Ninjas: https://www.api-ninjas.com/api/exercises
- WorkoutX: https://www.producthunt.com/p/workoutx/workoutx
- react-body-highlighter: https://github.com/giavinh79/react-body-highlighter
- Comparativas de apps: https://www.jefit.com/blog/fitbod-vs-strong-vs-jefit-vs-hevy · https://aitoolsbakery.com/blog/hevy-review/ · https://www.sensai.fit/blog/freeletics-vs-betterme-vs-fitify-2026 · https://www.fortune.com/article/best-workout-apps/
