---
title: "🧩 Escenario: OOMKilled — el pod muere por memoria"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "kubernetes"
  - label: "Herramientas"
    value: "`kubectl`, `kind`"
  - label: "Archivos"
    value: "`labs/k8s/manifests/broken/02-oom.yaml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/kubernetes"
        label: "Laboratorio Kubernetes"
---

# 🧩 Escenario: OOMKilled — el pod muere por memoria

---

## 🎯 Problema

Un pod se reinicia con `Exit Code 137` y `Reason: OOMKilled`. El contenedor intenta usar más memoria que su `limits.memory` y el kernel lo mata. Puede ser un límite demasiado bajo, un memory leak, una carga inesperada o presión de memoria en el nodo.

---

## ⚡ Quick command (SRE)

```bash
kubectl -n k8s-lab get pods
kubectl -n k8s-lab describe pod <pod-memstress> | grep -A6 "Last State"
```

---

## ✅ Salida esperada

- `STATUS` `CrashLoopBackOff` o `Running` con reinicios.
- `Last State: Terminated`, `Reason: OOMKilled`, `Exit Code: 137`.
- Eventos con `Killing container` o `OOMKilled`.
- En el nodo, `kubectl describe node` puede mostrar `MemoryPressure`.

Interpretación:

- `137` + `OOMKilled` → el contenedor superó su límite de memoria.
- `137` sin `OOMKilled` → SIGKILL externo (kubelet, node pressure, liveness).
- `Pending` + eventos de recursos → no es OOM: el pod no se programa.

---

## 🧠 Diagnóstico

Kubernetes aplica el límite de memoria del contenedor (cgroup). Si el proceso pide más, el kernel lo mata; Kubernetes lo reinicia según la política del pod. El `requests.memory` influye en la programación; el `limits.memory` es el techo real.

En el laboratorio, `python` intenta reservar 200 MB con un límite de 32 MiB. El pod muere por OOM de forma reproducible.

Revisa:

1. `limits` y `requests` del contenedor.
2. El consumo real de la app (métricas, `kubectl top`, perfilado).
3. Si el nodo tiene presión de memoria (`describe node`).
4. Si el leak es de la app o de una dependencia.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar OOM

```bash
kubectl -n k8s-lab get pod <pod-memstress> -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}{"\n"}'
kubectl -n k8s-lab describe pod <pod-memstress>
```

### 2. Ver los límites actuales

```bash
kubectl -n k8s-lab get deploy memstress -o jsonpath='{.spec.template.spec.containers[0].resources}{"\n"}'
```

### 3. Mirar el consumo (si hay metrics-server)

```bash
kubectl -n k8s-lab top pod <pod-memstress>
kubectl -n k8s-lab top node
```

Si `kubectl top` falla con `Metrics API not available`, el cluster no tiene metrics-server; usa `describe` y los eventos, o instala metrics-server en el laboratorio.

### 4. Revisar presión del nodo

```bash
kubectl describe node | grep -A3 "Conditions"
kubectl describe node | grep -A5 "Allocated resources"
```

### 5. Distinguir límite bajo de leak

- Si el uso crece sin techo hasta el límite → leak o carga real.
- Si el uso pico está cerca del límite desde el arranque → límite demasiado bajo.
- Si el nodo está al límite → presión de memoria compartida.

---

## 🧯 Mitigación

Primero restaura el servicio; después investiga el consumo:

```bash
# Subir el límite para confirmar que el pod estabiliza
kubectl -n k8s-lab set resources deploy/memstress \
  --limits=memory=256Mi --requests=memory=128Mi

kubectl -n k8s-lab rollout status deploy/memstress --timeout=120s
```

En producción:

- Ajusta `limits` con margen sobre el pico real, no “a ojo”.
- Corrige el leak o reduce la carga.
- Si el nodo está presionado, mueve cargas o escala nodos.
- Considera HPA/VPA si la carga es variable.

---

## ✅ Verificación

```bash
kubectl -n k8s-lab get pods -l app=memstress
kubectl -n k8s-lab describe pod -l app=memstress | grep -A4 "Last State"
```

Criterios:

- `STATUS` `Running` y `READY` `1/1`.
- Sin nuevos `OOMKilled` durante varios minutos.
- `kubectl top pod` muestra uso por debajo del límite (si hay metrics-server).
- El servicio responde si el Deployment tiene Service.

---

## 🎓 Prevención

- Define `requests` y `limits` basados en mediciones, no en valores por defecto.
- Alerta sobre `OOMKilled` y sobre uso de memoria > 80% del límite.
- Perfila la app y corrige leaks; no solo subas el límite.
- Prueba de carga antes de producción; revisa el pico, no el promedio.
- Considera HPA/VPA y `PodDisruptionBudget` para cargas críticas.

---

## ⚠️ Qué no hacer

- Quitar todos los límites en producción: un leak puede tumbar el nodo.
- Subir el límite sin investigar el leak: compras tiempo, no arreglas la causa.
- Ignorar la presión del nodo: el pod puede morir aunque su límite sea alto.
- Confundir `Pending` con OOM: si no se programa, el problema es otro.
- Usar `kubectl top` sin metrics-server y asumir que no hay consumo.

---

## 🔗 Referencias internas

- [Laboratorio Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — setup, comando y reset.
- [Manifiesto roto](/learning-sys-admin-guides-web/labs/k8s/manifests/broken/02-oom.yaml) — Deployment que reserva 200 MB con límite de 32 MiB.
- [CrashLoopBackOff](/learning-sys-admin-guides-web/scenarios/kubernetes/01-crashloopbackoff/) — si el exit code no es 137.
- [kubectl](/learning-sys-admin-guides-web/guides/kubectl/) — `top`, `describe`, `set resources`.
