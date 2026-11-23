# US4 · Recomendaciones inteligentes sin conexión — verificación en los tres niveles

Fecha: 2026-11-23

## Unitarias — 152 en verde (34 del motor)
- Progresión doble: primera vez, sube el escalón del equipo al completar el rango (barra 2,5 kg,
  mancuernas 2 kg, kettlebell 4 kg, 5 lb para libras), mantiene y suma una repetición dentro del
  rango, baja ~10 % tras dos sesiones bajo el rango (una sola no basta), consolida si llegó al
  fallo, ignora calentamientos, peso corporal +1 rep, tiempo +5 s; razón en español siempre.
- 1RM: Brzycki hasta 10 reps, Epley 11–12, nada fuera de 1–12. Récords: peso, reps, 1RM,
  volumen; nunca calentamientos ni la primera vez.
- Recuperación: fatiga por músculo con vida media por tamaño (24/36/48 h), secundarios a la mitad,
  series de la semana, umbrales fatigado/recuperándose/recuperado.
- Rutina de hoy: evita grupos fatigados, sólo equipo del lugar y nivel del usuario, sin
  isométricos, multiarticulares primero, cabe en el tiempo, esquema según objetivo, razones con
  redacción neutra (concuerda con «Abdominales» y «Pecho»).
- Formato numérico en español (16,8).

## Punta a punta — 110 por vuelta, 220/220 en dos vueltas
- Con historial sembrado por la API real y **sin conexión**: «Sugerencia: 14 kg × 8», «¿Por qué?»
  muestra «Completaste 3×12 con 12 kg: sube a 14 kg y vuelve a 8 repeticiones.», la serie viene
  rellenada, un toque la registra y avisa «¡Nuevo récord! peso máximo, 1RM estimado».
- Recuperación: cuádriceps fatigado tras el día de pierna, pecho recuperado; «Rutina de hoy» 30 min
  en Casa evita piernas, usa el equipo de Casa, muestra duración y empieza la sesión con objetivos.
- Ficha del ejercicio con «Tus récords» (16,8 kg de 1RM estimado).

## En vivo (Claude in Chrome)
- Recuperación con mapa y lista; se corrigió «hace 0 h» y «1 series».
- Rutina de hoy: se detectó que proponía dominadas en Casa sin barra (dato de origen «body only»)
  → corrección revisada de equipo en el importador (14 ejercicios de barra/paralelas), catálogo
  nuevo publicado y actualizado en el navegador; ahora propone remo con mancuernas.

## Errores encontrados y corregidos
- Botones dentro de enlaces (`<a><button>`): Safari en iPhone no navegaba en «Crear ejercicio»
  (detectado por la prueba de iPhone). Ahora son enlaces con estilo de botón.
- Decimales con punto → coma decimal.
- Versión del catálogo no cambiaba al cambiar el importador → ahora incluye la versión del
  importador y las correcciones.

## Sin probar
- Rendimiento del cálculo de recuperación con años de historial (se revisa en Polish, T142).
