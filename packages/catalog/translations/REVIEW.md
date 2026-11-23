# Revisión de traducciones del catálogo

- `es.json` guarda la traducción al español de cada ejercicio de free-exercise-db (clave = id).
- `source: "ai"` la generó Claude (`pnpm --filter @gym/catalog translate:catalog`);
  `reviewed: true` significa que una persona la revisó y **nunca** se vuelve a sobrescribir.
- Después de traducir o revisar: `pnpm catalog:build` genera una versión nueva del catálogo.

## Estado

- Pendiente: correr la traducción (requiere `ANTHROPIC_API_KEY`) y revisar a mano los 100
  ejercicios más usados (T075).
