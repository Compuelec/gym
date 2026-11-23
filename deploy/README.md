# Instalar Gym en el servidor (Kubernetes)

Gym corre en el clúster del servidor (k8s v1.30, Longhorn, Calico), namespace **`gym`**, igual que
Al Día y Agendas. Se publica sólo por el túnel de Cloudflare: no abre puertos.

| Recurso | Detalle |
|---|---|
| `statefulset/postgres` | PostgreSQL 17 (misma imagen fija que Al Día), volumen Longhorn de 10 GiB |
| `deployment/gym-web` | Caddy: entrega la PWA y las imágenes, y pasa `/api` a `gym-api` |
| `deployment/gym-api` | API (Hono). Salud: `/api/health/live` (vida) y `/api/health` (lista, consulta la base) |
| `deployment/gym-worker` | Trabajos en segundo plano (misma imagen que la API) |
| `job/gym-migrate` | Respaldo previo obligatorio + migraciones de la base |
| `service/gym` | **`http://gym.gym.svc.cluster.local:80`** ← destino del túnel de Cloudflare |
| `pvc/gym-backups` | Respaldos (previos a cada migración y diarios) |
| `secret/gym-secrets` | Secretos de la app (ver `k8s/secret.example.yaml`, nunca con valores reales en git) |
| `secret/gym-registry` | Credencial de descarga del registro de Forgejo |

Los datos reales del servidor (host SSH, registro de imágenes y dominio) no están en git: se
copian de `deploy/site.env.example` a `deploy/site.env` (ignorado) y se cargan antes de empezar.
Los manifiestos usan `registry.example.com/owner` y `gym.example.com`; `apply` los reemplaza por
los valores reales al aplicarlos. Todos los comandos `kubectl` se ejecutan por SSH:

```bash
source deploy/site.env
K="ssh root@$K8S_HOST"
apply() { sed -e "s#registry.example.com/owner#$REGISTRY/$REGISTRY_OWNER#g" -e "s#gym.example.com#$DOMAIN#g" "$1" | $K 'kubectl apply -f -'; }
```

## 1. Primera instalación

```bash
# 1) Namespace
apply deploy/k8s/namespace.yaml

# 2) Credencial del registro de Forgejo (token con alcance read:package)
$K "kubectl -n gym create secret docker-registry gym-registry \
  --docker-server=$REGISTRY --docker-username=$REGISTRY_OWNER --docker-password='<token>'"

# 3) Secretos de la app (no se muestran en pantalla). Generar valores:
#    openssl rand -base64 24  → POSTGRES_PASSWORD
#    openssl rand -base64 32  → BETTER_AUTH_SECRET y APP_ENCRYPTION_KEY
$K "kubectl -n gym create secret generic gym-secrets \
  --from-literal=POSTGRES_PASSWORD='<pg>' \
  --from-literal=DATABASE_URL='postgres://gym:<pg>@postgres:5432/gym' \
  --from-literal=BETTER_AUTH_SECRET='<auth>' \
  --from-literal=BETTER_AUTH_URL=\"https://$DOMAIN\" \
  --from-literal=APP_ENCRYPTION_KEY='<enc>' \
  --from-literal=MAIL_FROM=\"$MAIL_FROM\" \
  --from-literal=VAPID_SUBJECT=\"$VAPID_SUBJECT\""

# 4) Base de datos y volumen de respaldos
apply deploy/k8s/postgres.yaml
apply deploy/k8s/backups-pvc.yaml
apply deploy/k8s/backup-scripts.yaml   # scripts que usa la migración (respaldo previo)
apply deploy/k8s/backup.yaml           # respaldo diario y verificación mensual
$K 'kubectl -n gym rollout status statefulset/postgres'
```

Luego seguir con **«Nueva versión»** (imágenes, migración y app) y, al final, las reglas de red:

```bash
apply deploy/k8s/network-policy.yaml
```

**Exponerla:** Cloudflare Zero Trust → Networks → Tunnels → (túnel del clúster) → Public
Hostnames → agregar tu dominio (`$DOMAIN`) → tipo HTTP → `gym.gym.svc.cluster.local:80`.
Si usas otro dominio, cambia `BETTER_AUTH_URL` en `secret/gym-secrets` y reinicia la API.

## 2. Nueva versión

```bash
V=0.2.0
docker buildx build --platform linux/amd64 -f infra/docker/api.Dockerfile \
  -t $REGISTRY/$REGISTRY_OWNER/gym-api:$V --push .
docker buildx build --platform linux/amd64 -f infra/docker/web.Dockerfile \
  -t $REGISTRY/$REGISTRY_OWNER/gym-web:$V --push .
# Obtener los digests y fijarlos (versión@sha256:…) en app.yaml y migrate-job.yaml:
docker buildx imagetools inspect $REGISTRY/$REGISTRY_OWNER/gym-api:$V
docker buildx imagetools inspect $REGISTRY/$REGISTRY_OWNER/gym-web:$V

# Migración: primero respalda la base (si el respaldo falla, no migra)
$K 'kubectl -n gym delete job gym-migrate --ignore-not-found'
apply deploy/k8s/migrate-job.yaml
$K 'kubectl -n gym wait --for=condition=complete job/gym-migrate --timeout=300s'
$K 'kubectl -n gym logs job/gym-migrate --all-containers'

# App
apply deploy/k8s/app.yaml
$K 'kubectl -n gym rollout status deploy/gym-api deploy/gym-web deploy/gym-worker'
```

## 3. Invitaciones y administrador

```bash
$K 'kubectl -n gym exec deploy/gym-api -- node dist/admin.mjs invite --days 14'   # imprime el enlace
$K 'kubectl -n gym exec deploy/gym-api -- node dist/admin.mjs promote <correo>'   # tras registrarse
```

El servidor de correo y las invitaciones también se manejan desde la app (Perfil →
Administración → Correo / Invitaciones / Usuarios). La regla de red sólo deja salir correo por los
puertos 465 y 587.

## 4. Comprobar después de publicar

```bash
curl -s https://$DOMAIN/api/health          # {"status":"ok"}
# Desde otro namespace la app NO debe responder (reglas de red):
$K 'kubectl run -n default prueba-red --rm -i --restart=Never --image=curlimages/curl:8.10.1 -- curl -sS -m 5 http://gym.gym.svc.cluster.local/api/health/live'   # debe fallar por tiempo
```

Y en el teléfono: abrir `https://$DOMAIN`, instalar en la pantalla de inicio y abrirla en
modo avión.

## 5. Respaldos

- Antes de cada migración el job `gym-migrate` deja un respaldo `gym-premigrate-AAAAMMDD-HHMMSS.dump`
  en el volumen `gym-backups` y comprueba que se pueda leer.
- Los respaldos diarios y la prueba mensual de restauración se agregan con la historia de usuario 5
  (mismo esquema que Al Día: 03:30 hora de Chile, 30 días, mínimo 7).

Respaldo manual:

```bash
$K "kubectl -n gym exec postgres-0 -- pg_dump -U gym --clean --if-exists gym" | gzip > gym-$(date +%F).sql.gz
```

## 6. Problemas comunes

| Síntoma | Qué revisar |
|---|---|
| La página no carga | `$K 'kubectl -n gym get pods'` y `$K 'kubectl -n gym logs deploy/gym-web'` |
| `ImagePullBackOff` | `secret/gym-registry` y que la imagen exista en Forgejo |
| La API no queda lista | `$K 'kubectl -n gym logs deploy/gym-api'` (¿`DATABASE_URL`? ¿migración aplicada?) |
| La migración falló | `$K 'kubectl -n gym logs job/gym-migrate --all-containers'`: si falló el respaldo, no se tocó la base |
| No puedo iniciar sesión tras varios intentos | Es el límite de intentos: espera un minuto |
