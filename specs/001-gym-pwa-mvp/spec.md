# Feature Specification: PWA de entrenamiento casa/gimnasio (MVP)

**Feature Branch**: `001-gym-pwa-mvp`

**Created**: 2026-11-22

**Status**: Draft

**Input**: User description: "Aplicación web progresiva para hacer ejercicio en casa o en el gimnasio. Uso personal con cuentas y sincronización, con proyección a uso comercial si funciona bien. Funciones inteligentes desde el principio. Alojada en el servidor Proxmox propio. Catálogo de ejercicios propio en español a partir de fuentes abiertas (ver docs/01 y docs/02)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Cuenta e instalación (Priority: P1)

Carlos abre la dirección de la app en el teléfono, crea su cuenta (o entra con Google), la instala en
la pantalla de inicio y, desde otro dispositivo, entra con la misma cuenta y ve los mismos datos.
En el primer ingreso indica su objetivo, nivel, días por semana y **qué equipo tiene en cada lugar**
(por ejemplo «Casa: mancuernas y banda elástica» y «Gimnasio: completo»).

**Why this priority**: sin cuenta y sin perfil de equipo no hay sincronización ni recomendaciones;
es la base de todo lo demás.

**Independent Test**: crear cuenta, instalar la app, cerrar sesión, entrar desde otro navegador y
ver el mismo perfil y lugares.

**Acceptance Scenarios**:

1. **Given** una persona sin cuenta con una invitación válida, **When** se registra con correo y
   contraseña, **Then** queda dentro de la app y ve el asistente de primer ingreso.
2. **Given** una cuenta existente, **When** entra con Google o correo desde otro dispositivo,
   **Then** ve su perfil, lugares y equipo.
3. **Given** la app abierta en el teléfono, **When** elige «Instalar», **Then** queda un ícono en
   la pantalla de inicio que abre la app a pantalla completa.
4. **Given** una persona sin invitación, **When** intenta registrarse, **Then** el registro se
   rechaza con un mensaje claro.
5. **Given** un usuario con sesión, **When** intenta ver o cambiar datos de otro usuario,
   **Then** el sistema lo impide.

---

### User Story 2 - Catálogo de ejercicios en español (Priority: P1)

Carlos busca ejercicios por nombre, músculo, equipo o lugar. Cada ejercicio muestra su nombre en
español, imágenes del movimiento, músculos principales y secundarios marcados en un mapa del
cuerpo, nivel, instrucciones paso a paso y el autor/licencia del contenido. Puede marcar favoritos
y crear ejercicios propios. Al elegir «Casa», sólo ve lo que puede hacer con el equipo de casa.

**Why this priority**: es el contenido central; sin catálogo no se puede armar ni registrar nada.

**Independent Test**: buscar «sentadilla», filtrar por «Casa» y ver sólo ejercicios posibles con el
equipo declarado; abrir uno y ver imágenes, mapa de músculos e instrucciones en español; repetir en
modo avión.

**Acceptance Scenarios**:

1. **Given** el catálogo cargado, **When** filtra por músculo «pecho» y lugar «Casa», **Then** sólo
   aparecen ejercicios de pecho que usan equipo disponible en casa o ninguno.
2. **Given** el teléfono sin conexión, **When** abre un ejercicio ya visto o del catálogo base,
   **Then** se muestran sus textos e imágenes.
3. **Given** un ejercicio con licencia que exige atribución, **When** se muestra, **Then** aparece
   el autor y la licencia, y existe una página de créditos general.
4. **Given** un ejercicio que no existe en el catálogo, **When** el usuario crea uno propio,
   **Then** sólo él lo ve y puede usarlo en rutinas.

---

### User Story 3 - Entrenar y registrar sin conexión (Priority: P1)

Carlos crea rutinas (o usa una plantilla), inicia una sesión, registra cada serie (peso,
repeticiones, esfuerzo percibido), usa un temporizador de descanso con aviso, agrega notas, cambia
un ejercicio por otro equivalente y termina la sesión con un resumen. Todo funciona aunque el
gimnasio no tenga señal; al recuperar conexión, se sincroniza solo.

**Why this priority**: es el uso diario de la app; con P1-1 y P1-2 forma el MVP mínimo útil.

**Independent Test**: en modo avión, crear una rutina, hacer una sesión completa con temporizador y
cerrar la app a mitad; reabrir, terminar; volver a conectar y comprobar que la sesión aparece en
otro dispositivo.

**Acceptance Scenarios**:

1. **Given** sin conexión, **When** registra 4 series y cierra la app, **Then** al reabrir siguen
   las 4 series y la sesión continúa donde quedó.
2. **Given** una serie registrada, **When** termina el descanso configurado, **Then** recibe un
   aviso (sonido/vibración/notificación) aunque la pantalla esté en otra app o bloqueada, cuando el
   dispositivo lo permita.
3. **Given** sesiones registradas sin conexión en el teléfono, **When** vuelve la conexión,
   **Then** se sincronizan sin duplicarse y aparecen en otro dispositivo.
4. **Given** la misma rutina editada en dos dispositivos sin conexión, **When** ambos sincronizan,
   **Then** queda la versión más reciente y no se pierde ninguna sesión registrada.
5. **Given** un ejercicio de la rutina sin el equipo del lugar actual, **When** pide sustituirlo,
   **Then** se le ofrecen alternativas que trabajan los mismos músculos con el equipo disponible.

---

### User Story 4 - Recomendaciones inteligentes sin conexión (Priority: P2)

Al empezar cada ejercicio, la app sugiere peso y repeticiones según su historial (sobrecarga
progresiva) y explica por qué. Muestra un mapa del cuerpo con qué músculos están recuperados y
cuáles fatigados. Con un toque genera la «rutina de hoy» según objetivo, tiempo disponible, lugar y
recuperación. Detecta récords personales y estima el máximo de una repetición.

**Why this priority**: es el diferencial «inteligente» pedido desde el inicio, y funciona sin costo
ni conexión.

**Independent Test**: con un historial de prueba conocido, verificar que la sugerencia sube la carga
tras completar todas las series, la mantiene si no se completaron, y que la rutina de hoy evita los
músculos trabajados ayer y respeta el equipo de casa.

**Acceptance Scenarios**:

1. **Given** completó 3×10 con 20 kg en la última sesión, **When** inicia ese ejercicio,
   **Then** se sugiere una progresión (más peso o más repeticiones) con su explicación.
2. **Given** falló repeticiones dos sesiones seguidas, **When** inicia el ejercicio, **Then** se
   sugiere mantener o bajar la carga, con su explicación.
3. **Given** trabajó piernas ayer con alto volumen, **When** pide «rutina de hoy» de 30 minutos en
   casa, **Then** la rutina no incluye piernas como foco y sólo usa equipo de casa.
4. **Given** levanta más que nunca en un ejercicio, **When** registra la serie, **Then** se le avisa
   del nuevo récord personal.

---

### User Story 5 - Progreso y datos propios (Priority: P2)

Carlos ve gráficas de progreso por ejercicio (carga, volumen, máximo estimado), frecuencia semanal,
volumen por músculo, racha y su peso/medidas corporales a lo largo del tiempo. Puede exportar todos
sus datos y volver a importarlos, y puede borrar su cuenta.

**Why this priority**: la motivación depende de ver avances; exportar/importar resuelve la queja más
frecuente de otras apps.

**Independent Test**: con historial de prueba, ver las gráficas; exportar, borrar la cuenta, crear
una nueva, importar y comprobar que todo vuelve.

**Acceptance Scenarios**:

1. **Given** 8 semanas de historial, **When** abre un ejercicio, **Then** ve la evolución de su
   máximo estimado y volumen.
2. **Given** una cuenta con datos, **When** exporta e importa en una cuenta nueva, **Then** quedan
   las mismas rutinas, sesiones, medidas y ejercicios propios.
3. **Given** que pide borrar su cuenta y lo confirma, **When** termina, **Then** sus datos dejan de
   existir en el servidor.

---

### User Story 6 - Coach con IA (Priority: P3)

Carlos conversa con un coach en español («quiero ganar fuerza, 3 días, en casa tengo
mancuernas») y recibe un programa de varias semanas que puede revisar, ajustar y aceptar; queda
como rutinas normales. Cada semana puede pedir una revisión de su entrenamiento con sugerencias
explicadas. Requiere conexión.

**Why this priority**: aporta mucho valor pero depende de las capas anteriores y tiene costo por
uso; se construye al final del MVP.

**Independent Test**: pedir un programa, verificar que sólo usa ejercicios del catálogo con el
equipo declarado, aceptarlo y empezar a entrenarlo; superar el límite diario y ver el aviso.

**Acceptance Scenarios**:

1. **Given** conexión y perfil completo, **When** pide un programa, **Then** recibe uno que sólo usa
   ejercicios existentes, respeta días y equipo, y lo puede aceptar como rutinas.
2. **Given** sin conexión, **When** abre el coach, **Then** ve un aviso claro y el resto de la app
   sigue funcionando.
3. **Given** alcanzó su límite de consultas, **When** pide otra, **Then** se le informa cuándo
   podrá volver a usarlo.
4. **Given** un mensaje que pide algo médico o peligroso, **When** el coach responde, **Then**
   recomienda consultar a un profesional y no prescribe.
5. **Given** el administrador desactivó la IA, **When** un usuario abre el coach, **Then** ve
   «El coach no está disponible por ahora» y el resto de la app (incluida la inteligencia local)
   funciona igual.

---

### User Story 7 - Administración de la IA (Priority: P3)

Carlos, como administrador, entra a una pantalla de ajustes que sólo él ve. Ahí activa o desactiva
la IA para todos, pega o cambia la clave del servicio de IA (después sólo ve los últimos 4
caracteres), prueba la conexión con un botón, elige el modelo (por defecto el más económico),
ajusta el límite diario por usuario y el tope de gasto mensual, y ve cuánto se ha gastado en el
mes. También gestiona las invitaciones.

**Why this priority**: controla costo y riesgo de la IA sin tocar el servidor ni desplegar de
nuevo; va junto con el coach.

**Independent Test**: como administrador, guardar una clave, probar conexión, desactivar la IA y
comprobar que el coach muestra el aviso; como usuario normal, intentar entrar a ajustes y ser
rechazado.

**Acceptance Scenarios**:

1. **Given** el administrador sin clave configurada, **When** pega una clave y pulsa «Probar
   conexión», **Then** ve si la clave funciona y queda guardada; al volver sólo ve `••••abcd`.
2. **Given** la IA activada, **When** el administrador la desactiva, **Then** desde la siguiente
   solicitud el coach queda no disponible para todos, sin desplegar de nuevo.
3. **Given** el gasto del mes alcanza el tope configurado, **When** alguien pide otra consulta,
   **Then** la IA se pausa sola y el administrador ve el motivo.
4. **Given** un usuario sin rol de administrador, **When** intenta abrir o usar los ajustes de
   administración, **Then** el sistema lo impide.
5. **Given** una clave guardada, **When** se revisan respuestas de la API, registros o copias de
   seguridad legibles, **Then** la clave completa no aparece en ninguno.

---

### Edge Cases

- Reloj del teléfono adelantado o atrasado al sincronizar.
- Almacenamiento del navegador lleno o borrado por el sistema (iOS borra datos de sitios no
  instalados tras días sin uso).
- Sesión olvidada abierta durante horas: se ofrece terminarla o descartarla.
- Sesión que expira mientras hay cambios sin sincronizar: no se pierden; se envían tras volver a
  entrar.
- Importar un archivo dañado o de otra versión: se rechaza sin tocar los datos existentes.
- Actualización de la app mientras hay una sesión en curso: no interrumpe la sesión.
- Ejercicio del catálogo retirado o renombrado en una actualización: el historial lo conserva.
- Peso con decimales y unidades kg/lb; ejercicios por tiempo (plancha) o por distancia.
- El servicio de IA no responde o devuelve un ejercicio inexistente: se descarta y se informa.

## Requirements *(mandatory)*

### Functional Requirements

**Cuentas y perfil**
- **FR-001**: El sistema MUST permitir registro con correo y contraseña y con Google, sólo mediante
  invitación mientras la app sea de uso personal.
- **FR-002**: El sistema MUST permitir recuperar la contraseña por correo.
- **FR-003**: El usuario MUST poder definir objetivo, nivel, días por semana, unidades (kg/lb) y uno
  o más lugares, cada uno con su lista de equipo disponible.
- **FR-004**: Cada usuario MUST ver y modificar únicamente sus propios datos.
- **FR-005**: La app MUST poder instalarse en la pantalla de inicio de Android, iOS y escritorio.

**Catálogo**
- **FR-006**: El sistema MUST ofrecer un catálogo base de al menos 800 ejercicios con nombre e
  instrucciones en español, imágenes, músculos principales/secundarios, equipo, nivel y categoría.
- **FR-007**: El usuario MUST poder buscar por texto y filtrar por músculo, equipo, lugar, nivel y
  categoría.
- **FR-008**: Cada ejercicio MUST mostrar sus músculos sobre un mapa del cuerpo.
- **FR-009**: El sistema MUST conservar y mostrar autor y licencia de cada contenido, y una página
  de créditos.
- **FR-010**: El usuario MUST poder marcar favoritos y crear ejercicios propios privados.
- **FR-011**: El catálogo base completo (textos e imágenes) MUST estar disponible sin conexión
  después de la primera carga en una app instalada.

**Entrenamiento**
- **FR-012**: El usuario MUST poder crear, editar, duplicar y borrar rutinas, con ejercicios
  ordenados, series objetivo, repeticiones/tiempo, descanso y superseries.
- **FR-013**: El usuario MUST poder iniciar una sesión desde una rutina o vacía, registrar series
  (peso, repeticiones o tiempo/distancia, esfuerzo percibido, tipo: calentamiento/normal/fallo/drop)
  y notas.
- **FR-014**: La app MUST ofrecer temporizador de descanso con aviso al terminar.
- **FR-015**: La app MUST sugerir sustitutos de un ejercicio que trabajen los mismos músculos con el
  equipo del lugar elegido.
- **FR-016**: Todo lo de FR-012 a FR-015 MUST funcionar sin conexión.
- **FR-017**: Los cambios hechos sin conexión MUST sincronizarse automáticamente al recuperarla,
  sin duplicados ni pérdidas; ante ediciones simultáneas de un mismo registro prevalece la más
  reciente.

**Inteligencia local**
- **FR-018**: La app MUST sugerir peso/repeticiones por ejercicio a partir del historial, con una
  explicación en lenguaje simple.
- **FR-019**: La app MUST estimar la recuperación por grupo muscular y mostrarla en el mapa del
  cuerpo.
- **FR-020**: La app MUST generar una «rutina de hoy» según objetivo, tiempo, lugar/equipo y
  recuperación.
- **FR-021**: La app MUST detectar récords personales y estimar el máximo de una repetición.
- **FR-022**: FR-018 a FR-021 MUST funcionar sin conexión.

**Progreso y datos**
- **FR-023**: La app MUST mostrar gráficas por ejercicio, frecuencia, volumen por músculo, racha y
  peso/medidas corporales.
- **FR-024**: El usuario MUST poder exportar e importar todos sus datos en un formato abierto.
- **FR-025**: El usuario MUST poder borrar su cuenta y todos sus datos.

**Coach con IA**
- **FR-026**: El usuario MUST poder pedir en conversación un programa de varias semanas, revisarlo y
  aceptarlo como rutinas.
- **FR-027**: Las propuestas del coach MUST usar sólo ejercicios existentes del catálogo (base o
  propios) compatibles con el equipo declarado; las que no cumplan se descartan.
- **FR-028**: El usuario MUST poder pedir una revisión semanal con sugerencias explicadas.
- **FR-029**: El sistema MUST limitar las consultas al coach por usuario y registrar su costo.
- **FR-030**: La app MUST mostrar un aviso de que no reemplaza consejo médico, y el coach MUST
  derivar a un profesional ante temas de salud.

**Operación**
- **FR-031**: El sistema MUST hacer copias de seguridad diarias de los datos del servidor y permitir
  restaurarlas.
- **FR-032**: Toda la interfaz MUST estar en español.

**Administración**
- **FR-033**: El sistema MUST distinguir el rol administrador; sólo el administrador accede a los
  ajustes de administración y a las invitaciones.
- **FR-034**: El administrador MUST poder activar y desactivar la IA para todos; el cambio rige
  desde la siguiente solicitud, sin desplegar de nuevo.
- **FR-035**: El administrador MUST poder guardar, reemplazar y borrar la clave del servicio de IA
  desde la app; la clave se guarda cifrada, nunca se devuelve completa (sólo los últimos 4
  caracteres) y nunca aparece en registros.
- **FR-036**: El administrador MUST poder probar la conexión con el servicio de IA antes de
  activarla.
- **FR-037**: El administrador MUST poder elegir el modelo de IA de una lista permitida (por
  defecto el más económico), y ajustar el límite diario por usuario y el tope de gasto mensual.
- **FR-038**: El sistema MUST pausar la IA automáticamente al alcanzar el tope de gasto mensual y
  mostrar al administrador el gasto acumulado del mes.

### Key Entities

- **Usuario**: cuenta, método de ingreso, preferencias (unidades, idioma), perfil (objetivo, nivel,
  días/semana, peso corporal opcional).
- **Invitación**: código para registrarse, quién la creó, si fue usada.
- **Lugar**: nombre («Casa», «Gimnasio») y lista de equipo disponible; pertenece a un usuario.
- **Equipo**: vocabulario fijo (mancuernas, barra, banda, máquina de poleas, barra de dominadas…).
- **Músculo**: vocabulario fijo con su zona en el mapa del cuerpo.
- **Ejercicio**: nombre, instrucciones, imágenes/video, músculos principales/secundarios, equipo
  requerido, nivel, categoría, tipo de medida (peso×reps, tiempo, distancia), fuente, autor y
  licencia; base (compartido) o propio (de un usuario).
- **Rutina**: nombre, lista ordenada de ejercicios con series objetivo, descanso y agrupación en
  superseries; puede pertenecer a un programa.
- **Programa**: conjunto de rutinas por semanas, creado por el usuario o por el coach.
- **Sesión**: entrenamiento realizado con fecha, duración, lugar, notas; contiene ejercicios
  realizados y series.
- **Serie**: peso, repeticiones o tiempo/distancia, esfuerzo percibido, tipo, completada.
- **Récord personal**: mejor marca por ejercicio y tipo (peso, reps, máximo estimado).
- **Medida corporal**: fecha, peso y medidas opcionales.
- **Conversación con el coach**: mensajes, propuesta resultante, costo y fecha.
- **Ajustes de la IA** (globales): activada sí/no, clave cifrada y sus últimos 4 caracteres,
  modelo elegido, límite diario por usuario, tope de gasto mensual, motivo de pausa, quién y
  cuándo los cambió.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Registrar una serie toma como máximo 2 toques desde la pantalla de la sesión.
- **SC-002**: Una sesión completa de 60 minutos registrada sin conexión llega intacta a otro
  dispositivo dentro de 1 minuto después de recuperar la conexión, en el 100 % de las pruebas.
- **SC-003**: La app instalada abre y muestra la sesión en curso en menos de 2 segundos en un
  teléfono de gama media, con o sin conexión.
- **SC-004**: Al menos 800 ejercicios del catálogo tienen nombre e instrucciones en español e
  imagen.
- **SC-005**: Encontrar un ejercicio por nombre o filtro toma menos de 10 segundos.
- **SC-006**: El 100 % de los ejercicios propuestos por el coach existen en el catálogo y son
  compatibles con el equipo del usuario.
- **SC-007**: Crear la cuenta y completar el primer ingreso toma menos de 3 minutos.
- **SC-008**: Exportar y reimportar conserva el 100 % de rutinas, sesiones, medidas y ejercicios
  propios.
- **SC-009**: Tras 4 semanas de uso personal, Carlos registra todos sus entrenamientos en la app sin
  volver a otra app o a papel.
- **SC-010**: Desactivar la IA o cambiar su clave toma menos de 1 minuto y no requiere desplegar
  de nuevo.
- **SC-011**: Una consulta típica al coach cuesta menos de 0,01 US$ con el modelo por defecto.

## Assumptions

- Usuarios iniciales: Carlos y pocas personas invitadas (menos de 20); el diseño no impide crecer.
- El registro es por invitación hasta decidir abrirlo comercialmente.
- Social (amigos, feed), entrenadores con alumnos, nutrición, pagos y apps en tiendas quedan fuera
  del MVP.
- El contenido del catálogo sale de free-exercise-db y wger (ver docs/01); los textos que falten en
  español se traducen con ayuda de IA y revisión.
- Integración con relojes inteligentes y salud del teléfono queda fuera del MVP.
- El coach usa un servicio de IA externo de pago por uso, con el modelo más económico por defecto;
  límite inicial de 20 consultas diarias por usuario y tope mensual, ambos ajustables por el
  administrador. La IA arranca **desactivada** hasta que el administrador cargue la clave.
- El único administrador inicial es Carlos (se asigna al desplegar).
- El aviso del temporizador con la pantalla bloqueada depende de lo que permita cada navegador; en
  iOS requiere la app instalada.
- El servidor es el clúster Kubernetes propio, accesible por HTTPS desde internet mediante
  Cloudflare Tunnel, igual que los demás proyectos de Carlos.
