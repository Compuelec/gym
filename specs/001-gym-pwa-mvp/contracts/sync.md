# Sync Protocol

Entidades sincronizables: `profile`, `location`, `exercise` (propios), `favorite`, `program`,
`routine`, `workoutSession`, `sessionExercise`, `setEntry`, `bodyMeasurement`.

## Cliente
1. Cada cambio local se escribe en Dexie **y** en `outbox` en la misma transacción.
2. Disparadores de sincronización: al volver la red (`online`), al abrir la app, al terminar una
   serie/sesión, cada 60 s con la app abierta, y `Background Sync` donde exista.
3. Orden: `push` de toda la outbox (lotes ≤ 200) → `pull` desde el último `cursor` guardado.
4. Errores de red: reintento exponencial (1 s → 5 min). 401: se conserva la outbox y se pide
   volver a entrar; nunca se descarta.

## POST /sync/push
Petición:
```json
{
  "clientId": "uuid-del-dispositivo",
  "mutations": [
    {
      "mutationId": "uuid-v7",
      "entity": "setEntry",
      "op": "upsert",
      "id": "uuid-v7",
      "data": { "...campos según esquema Zod...": "" },
      "clientUpdatedAt": "2026-11-22T10:00:00.000Z"
    }
  ]
}
```
Respuesta 200:
```json
{
  "results": [
    { "mutationId": "…", "status": "applied", "serverVersion": 1234 },
    { "mutationId": "…", "status": "duplicate", "serverVersion": 1200 },
    { "mutationId": "…", "status": "rejected", "error": { "code": "VALIDATION", "message": "…" } }
  ]
}
```
Reglas del servidor:
- `mutationId` ya aplicado → `duplicate` con el mismo resultado (idempotencia).
- `id` existente de **otro** usuario → `rejected` `NOT_FOUND` (sin revelar).
- Conflicto: **gana el último cambio aplicado en el servidor** para ese registro (se sobrescribe
  el registro completo y recibe un `serverVersion` nuevo); el otro dispositivo recibe la versión
  ganadora en su siguiente `pull`. `setEntry` nunca entra en conflicto (sólo-agregar por `id`
  único). `profile` usa como `id` el id del usuario, así dos dispositivos convergen en un único
  perfil.
- `delete` = fija `deletedAt`; el registro se sigue entregando en `pull` para propagar el borrado.
- Referencias (p. ej. `setEntry → sessionExercise`) se validan dentro del mismo lote o ya
  existentes del mismo dueño.

## GET /sync/pull?cursor=n&limit=500
Respuesta 200:
```json
{
  "changes": [
    { "entity": "routine", "id": "…", "serverVersion": 1301, "deleted": false, "data": { } }
  ],
  "cursor": 1301,
  "hasMore": false
}
```
- `cursor` es el mayor `serverVersion` entregado (secuencia de PostgreSQL global, no hora del
  cliente ⇒ inmune a relojes desfasados).
- Sólo cambios del usuario de la sesión.
- Cliente aplica los cambios en una transacción Dexie y luego guarda el `cursor`.
- Primer ingreso o base local perdida: `cursor=0` ⇒ descarga completa.

## Catálogo
Independiente de `/sync`: el cliente compara `catalog/manifest.version` con la versión local y,
si cambió, descarga el paquete nuevo y lo reemplaza en Dexie en una transacción; las imágenes se
precachean en segundo plano.
