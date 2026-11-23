# US2 · Catálogo de ejercicios — verificación en los tres niveles

Fecha: 2026-11-23

## Catálogo generado
- 876 ejercicios de free-exercise-db (commit fijado `f00c92c`), 1.746 imágenes WebP (23 MB),
  archivo del catálogo de 1,4 MB, versión por hash de las fuentes.
- 45 nombres en español tomados de wger (CC-BY-SA 4.0, con atribución en créditos).
- **Traducción pendiente**: `translations/es.json` está vacío. El script
  `pnpm --filter @gym/catalog translate:catalog` (Claude Haiku 5.5, costo estimado < 1 US$)
  necesita `ANTHROPIC_API_KEY`. Mientras tanto la app muestra el texto original en inglés con el
  aviso «Traducción al español pendiente». SC-004 (≥ 800 en español) queda **sin cumplir** hasta
  correrlo y revisar los 100 más usados (T075).

## Unitarias e integración — 105 en verde
- Importador: mapeo al esquema compartido, músculos sin duplicar, pasos vacíos eliminados,
  prioridad traducción propia → nombre de wger (atribuido) → inglés marcado, valores
  desconocidos rechazados, tipo de registro inferido.
- Filtros: acentos y mayúsculas, lugar (todo el equipo requerido, peso corporal siempre),
  músculo principal/secundario, nivel, equipo, tipo, nunca retirados, orden en español.
- Cargador: primera descarga, no repite si no cambió, retirados se conservan, sin conexión usa lo
  guardado, el catálogo no se sincroniza, imágenes una vez por versión y sólo en la app instalada.
- Servidor: ejercicios propios privados y validados; favoritos sincronizados.

## Punta a punta — 90 por vuelta, 180/180 en dos vueltas (Chrome, Safari, Android, iPhone)
- Catálogo completo; «Casa» + «Pecho» muestra exactamente los ejercicios posibles con su equipo.
- Búsqueda sin acentos («SENTADILLA AL CAJON»), ficha con imagen cargada, mapa del cuerpo, pasos y
  licencia.
- Favorito y ejercicio propio llegan a otro dispositivo; otro usuario no ve el ejercicio propio.
- Ficha e imagen ya vistas funcionan sin conexión.
- Página de créditos con fuentes y licencias.

## En vivo (Claude in Chrome)
- Aviso de versión nueva → actualización aplicada; 876 ejercicios con miniaturas; filtro Casa +
  Pecho = 34; ficha con imágenes alternadas, mapa del cuerpo y aviso de traducción pendiente;
  favorito guardado y comprobado en la base.

## Decisiones
- El catálogo se sirve como archivo estático por Caddy (`/catalog/…`, `/media/…`), no por la API.
- La descarga completa de imágenes (FR-011) ocurre sólo en la app instalada y en reposo; en una
  pestaña del navegador cada imagen se guarda al verla (evita bajar 23 MB en una visita casual).

## Sin probar
- Precarga completa de imágenes en un teléfono con la app instalada (etapa 0, T039).
- Revisión manual de traducciones (T075).
