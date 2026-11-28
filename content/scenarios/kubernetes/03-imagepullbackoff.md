---
title: "🧩 Escenario: ImagePullBackOff — la imagen no se descarga"
level: "Básico"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "kubernetes"
  - label: "Herramientas"
    value: "`kubectl`, `kind`"
  - label: "Archivos"
    value: "`labs/k8s/manifests/broken/03-imagepull.yaml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/kubernetes"
        label: "Laboratorio Kubernetes"
---

# 🧩 Escenario: ImagePullBackOff — la imagen no se descarga

---

## 🎯 Problema

Un pod queda en `ImagePullBackOff` o `ErrImagePull`: kubelet no puede descargar la imagen. El servicio no arranca. Las causas típicas son un tag inexistente, un registry privado sin credenciales, un rate limit del registry o un problema de red/DNS del nodo.

---

## ⚡ Quick command (SRE)

```bash
kubectl -n k8s-lab get pods
kubectl -n k8s-lab describe pod <pod-bad-image> | grep -A8 "Events"
```

---

## ✅ Salida esperada

- `STATUS` `ImagePullBackOff` o `ErrImagePull`.
- `READY` `0/1`, `RESTARTS` `0` (no es un crash: nunca llegó a arrancar).
- Eventos con `Failed to pull image` y uno de estos mensajes:
  - `manifest unknown` → tag o imagen inexistente.
  - `unauthorized` / `authentication required` → faltan credenciales.
  - `toomanyrequests` → rate limit del registry.
  - `no such host` / `i/o timeout` → DNS o red del nodo.

---

## 🧠 Diagnóstico

`ImagePullBackOff` significa que el nodo no puede obtener la imagen. Kubernetes reintenta con backoff; no es un fallo de la aplicación. La clave está en el evento de `describe pod`:

1. **tag inexistente** → corrige la imagen o publica el tag.
2. **registry privado** → crea un Secret `docker-registry` y referencedlo en `imagePullSecrets` o en el ServiceAccount.
3. **rate limit** → autentica el pull o usa un mirror/registry interno.
4. **red/DNS** → revisa `kubelet`/nodo, proxy y resolución del registry.

En el laboratorio, el Deployment usa `nginx:1.99.0-no-existe`, un tag que no existe.

---

## 🛠️ Procedimiento (runbook)

### 1. Ver el evento exacto

```bash
kubectl -n k8s-lab describe pod <pod-bad-image> | sed -n '/Events/,$p'
```

### 2. Confirmar la imagen y el tag

```bash
kubectl -n k8s-lab get deploy web-bad-image -o jsonpath='{.spec.template.spec.containers[0].image}{"\n"}'
```

### 3. Probar el pull desde el host (orientativo)

```bash
docker pull nginx:1.99.0-no-existe
docker manifest inspect nginx:1.27-alpine >/dev/null && echo "tag OK"
```

### 4. Registry privado: crear el Secret

```bash
kubectl -n k8s-lab create secret docker-registry regcred \
  --docker-server=registry.example.com \
  --docker-username="$REGISTRY_USER" \
  --docker-password="$REGISTRY_PASSWORD" \
  --docker-email="$REGISTRY_EMAIL"

kubectl -n k8s-lab patch deploy web-bad-image \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"regcred"}]}}}}'
```

### 5. Comprobar el ServiceAccount

```bash
kubectl -n k8s-lab get sa default -o yaml
```

Si el Secret está en el ServiceAccount, todos los pods que lo usan lo heredan.

---

## 🧯 Mitigación

En el laboratorio, corrige el tag:

```bash
kubectl -n k8s-lab set image deploy/web-bad-image app=nginx:1.27-alpine
kubectl -n k8s-lab rollout status deploy/web-bad-image --timeout=120s
```

En producción:

- Si el tag se borró, vuelve a una versión conocida y buena.
- Si faltan credenciales, crea el Secret y referencia `imagePullSecrets`.
- Si es rate limit, autentica el pull o usa un registry espejo.
- Si es red, revisa DNS/proxy del nodo antes de tocar el Deployment.

---

## ✅ Verificación

```bash
kubectl -n k8s-lab get pods -l app=web-bad-image
kubectl -n k8s-lab get pod -l app=web-bad-image \
  -o jsonpath='{.items[0].status.containerStatuses[0].imageID}{"\n"}'
```

Criterios:

- `STATUS` `Running` y `READY` `1/1`.
- `imageID` muestra el digest resuelto.
- No hay eventos nuevos de `Failed to pull image`.

---

## 🎓 Prevención

- Usa tags inmutables o digests (`nginx@sha256:...`), no `latest` en producción.
- Autentica el registry en CI y en el cluster; rota credenciales.
- Pre-descarga imágenes críticas en los nodos o usa un registry interno.
- Alerta sobre `ImagePullBackOff` y sobre fallos de pull en el nodo.
- Valida en CI que la imagen existe y se puede descargar.

---

## ⚠️ Qué no hacer

- Poner `imagePullPolicy: Always` con `latest` y esperar reproducibilidad.
- Hardcodear credenciales en el manifiesto o en el repositorio.
- Ignorar el evento y reiniciar el pod: el pull va a fallar igual.
- Cambiar a una imagen “parecida” sin verificar el contenido.
- Asumir que el problema es del cluster cuando el tag no existe.

---

## 🔗 Referencias internas

- [Laboratorio Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — setup, comando y reset.
- [Manifiesto roto](/learning-sys-admin-guides-web/labs/k8s/manifests/broken/03-imagepull.yaml) — Deployment con un tag inexistente.
- [CrashLoopBackOff](/learning-sys-admin-guides-web/scenarios/kubernetes/01-crashloopbackoff/) — si la imagen sí descarga pero el contenedor falla.
- [kubectl](/learning-sys-admin-guides-web/guides/kubectl/) — `describe`, `set image`, `rollout`.
