---
title: "🧩 Escenario: Pod en CrashLoopBackOff — la aplicación no arranca"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "kubernetes"
  - label: "Herramientas"
    value: "`kubectl`, `kind`"
  - label: "Archivos"
    value: "`labs/k8s/manifests/broken/01-crashloop.yaml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/kubernetes"
        label: "Laboratorio Kubernetes"
---

# 🧩 Escenario: Pod en CrashLoopBackOff — la aplicación no arranca

---

## 🎯 Problema

Un Deployment tiene pods que reinician en bucle y nunca llegan a `Running`. El usuario ve `CrashLoopBackOff` en `kubectl get pods` y el servicio no responde. Hay que distinguir si falla la aplicación, el comando de arranque, una variable de entorno, un ConfigMap/Secret o una probe mal configurada.

---

## ⚡ Quick command (SRE)

```bash
kubectl -n k8s-lab get pods -o wide
```

---

## ✅ Salida esperada

- `STATUS` `CrashLoopBackOff` y `RESTARTS` creciente.
- `READY` `0/1`: el contenedor nunca pasa a listo.
- En `kubectl describe pod`, `Last State: Terminated` con `Exit Code: 1`, `137` o `0`.
- Eventos con `Back-off restarting failed container`.

Interpretación rápida:

- `Exit Code 1` → error de aplicación o configuración.
- `Exit Code 137` → OOMKilled o SIGKILL (revisa memoria y límites).
- `Exit Code 0` → el proceso termina solo: entrypoint o comando mal armado.
- `Exit Code 143` → SIGTERM: alguien lo está parando o el liveness probe lo mata.

---

## 🧠 Diagnóstico

`CrashLoopBackOff` es un síntoma, no una causa. Kubernetes reinicia el contenedor con backoff exponencial, así que el estado actual puede ocultar el error original. La fuente de verdad está en:

1. el **exit code** y el motivo de la última terminación (`describe pod`);
2. los **logs del contenedor anterior** (`logs --previous`);
3. los **eventos** del pod (probes, mounts, secrets, imágenes);
4. la **spec del Deployment** (command, args, env, configmaps, secrets, resources).

En el laboratorio, el manifiesto roto arranca, imprime un error de configuración y termina con código 1. La app base `web` sigue sana: úsala como referencia de un pod que sí funciona.

---

## 🛠️ Procedimiento (runbook)

### 1. Identificar el pod y su estado

```bash
kubectl -n k8s-lab get pods -o wide
kubectl -n k8s-lab describe pod <pod-crash>
```

Busca `Last State`, `Exit Code`, `Reason` y la sección `Events`.

### 2. Leer los logs del intento anterior

```bash
kubectl -n k8s-lab logs <pod-crash> --previous
kubectl -n k8s-lab logs <pod-crash> --tail=50
```

El log actual puede estar vacío si el contenedor murió antes de escribir; `--previous` es clave.

### 3. Revisar la especificación del Deployment

```bash
kubectl -n k8s-lab get deploy web-crash -o yaml
kubectl -n k8s-lab describe deploy web-crash
```

Comprueba `command`, `args`, `env`, `envFrom`, `volumeMounts`, `readinessProbe` y `livenessProbe`.

### 4. Confirmar la causa en el laboratorio

```bash
kubectl -n k8s-lab logs <pod-crash> --previous
```

Deberías ver el mensaje `fallo de configuracion: falta APP_MODE`. El comando del Deployment termina con `exit 1` a propósito.

### 5. Comparar con un pod sano

```bash
kubectl -n k8s-lab get pods -l app=web
kubectl -n k8s-lab describe pod -l app=web
```

La app base tiene probes y recursos; el pod roto no. Esa diferencia también es parte del entrenamiento.

---

## 🧯 Mitigación

En un incidente real, primero se restaura el servicio y después se investiga:

```bash
# Si el último rollout introdujo el fallo, vuelve a la revisión anterior
kubectl -n k8s-lab rollout undo deploy/web-crash
kubectl -n k8s-lab rollout status deploy/web-crash
```

Si no hay historial (como en el laboratorio), corrige el comando:

```bash
kubectl -n k8s-lab patch deploy web-crash --type=json \
  -p='[{"op":"replace","path":"/spec/template/spec/containers/0/command","value":["sh","-c","sleep 3600"]}]'

kubectl -n k8s-lab rollout status deploy/web-crash --timeout=120s
```

En producción, la corrección real sería restaurar la variable `APP_MODE` o el ConfigMap que falta, no cambiar el comando por uno que no hace nada.

---

## ✅ Verificación

```bash
kubectl -n k8s-lab get pods -l app=web-crash
kubectl -n k8s-lab logs <pod-crash> --tail=20
```

Criterios:

- `STATUS` `Running` y `READY` `1/1`.
- `RESTARTS` estable durante varios minutos.
- Los logs muestran el arranque esperado.
- Si el Deployment tiene Service, `kubectl get endpoints` debe listar IPs.

---

## 🎓 Prevención

- Valida `command`, `args`, `env` y ConfigMaps/Secrets en CI antes de desplegar.
- Usa `readinessProbe` para no enviar tráfico a un pod que aún no está listo.
- No pongas `livenessProbe` agresivas que maten la app durante un arranque lento.
- Define `resources.requests` y `limits` realistas.
- En el pipeline, corre `kubectl rollout status` y falla el deploy si no llega a `Ready`.
- Alerta sobre `CrashLoopBackOff` y `RESTARTS` altos.

---

## ⚠️ Qué no hacer

- Borrar pods en bucle: el Deployment los recrea y el problema sigue.
- Subir el backoff o desactivar las probes para "que arranque": enmascara la causa.
- Ignorar `--previous`: el log actual puede no contener el error.
- Hacer `exec` en un contenedor que muere en segundos: no llegas a investigar.
- Cambiar la imagen a `latest` como “solución” sin entender el fallo.

---

## 🔗 Referencias internas

- [Laboratorio Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — setup, comando y reset.
- [Manifiesto roto](/learning-sys-admin-guides-web/labs/k8s/manifests/broken/01-crashloop.yaml) — Deployment que termina con exit 1.
- [kubectl](/learning-sys-admin-guides-web/guides/kubectl/) — `get`, `describe`, `logs`, `rollout`.
- [OOMKilled](/learning-sys-admin-guides-web/scenarios/kubernetes/02-oomkilled/) — si el exit code es 137, sigue por ahí.
