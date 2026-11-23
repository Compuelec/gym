# US5 · Progreso y datos propios — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias e integración — 163 en verde
- Progreso: semanas desde el lunes, frecuencia con semanas vacías, racha semanal (la semana en
  curso no la corta), series por grupo (principal 1, secundario 0,5, sin calentamientos, 7 días),
  serie por ejercicio (1RM, peso máximo, volumen).
- Exportar: todo anidado (sesión → ejercicios → series), formato abierto versionado, sin ownerId.
- Importar en otra cuenta: todo vuelve (SC-008), identificadores nuevos y referencias rehechas
  (rutina → ejercicio propio, serie → ejercicio de sesión, perfil → usuario actual), la cuenta de
  origen intacta; archivo inválido, versión desconocida o un registro malo → 422 y **nada**
  importado (transacción).
- Borrar cuenta: exige «BORRAR» y contraseña correcta (o ingreso reciente si es cuenta de Google),
  borra todo lo del usuario y nada de otros, la invitación queda sin datos personales, la sesión
  deja de valer.
- Plurales en español («1 cambio», «1 ejercicio», «1 entrenamiento»).

## Respaldos (`pnpm test:backup`, contra PostgreSQL real con la misma imagen del clúster)
- Respaldo diario restaurable; prueba de restauración en base temporal que luego se borra;
  respaldos previos a migración con su propio prefijo; un respaldo que falla termina con error y
  no deja archivos a medias (así la migración no corre); el ConfigMap coincide con los scripts.
- Manifiestos de respaldo validados en el clúster sin aplicar (`kubectl apply --dry-run=client`).

## Punta a punta — 126 por vuelta, 252/252 en dos vueltas
- Progreso con gráficas (con vista de tabla), racha, 1RM en tabla con coma decimal e historial.
- Medidas: error en español si está vacía, guardado con coma decimal, llega al servidor.
- Exportar desde la pantalla (descarga real) → contraseña incorrecta rechazada → cuenta borrada →
  ya no se puede entrar → cuenta nueva importa el archivo desde la pantalla → mismos datos.
- Archivo dañado rechazado sin cambios.

## En vivo (Claude in Chrome)
- Progreso con racha, frecuencia semanal, series por grupo y selector de ejercicio; se corrigió
  «1 entrenamientos». Medida 82,3 kg / 91 cm guardada y comprobada en la base.

## Sin probar
- Restauración de un respaldo en el clúster real y CronJobs corriendo allá (etapa 0, T039).
