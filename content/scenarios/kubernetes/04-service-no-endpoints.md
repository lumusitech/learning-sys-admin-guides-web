---
title: "🧩 Escenario: Service sin endpoints — el tráfico no llega"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "kubernetes"
  - label: "Herramientas"
    value: "`kubectl`, `kind`"
  - label: "Archivos"
    value: "`labs/k8s/manifests/broken/04-service-selector.yaml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/kubernetes"
        label: "Laboratorio Kubernetes"
---

# 🧩 Escenario: Service sin endpoints — el tráfico no llega

---

## 🎯 Problema

Un Service existe y tiene una IP, pero el tráfico no llega a los pods. `kubectl get endpoints` muestra `<none>` o el Service resuelve por DNS pero la conexión falla. Las causas típicas son un selector que no coincide, pods no listos, un `targetPort` incorrecto o una NetworkPolicy que bloquea.

---

## ⚡ Quick command (SRE)

```bash
kubectl -n k8s-lab get svc,endpoints
kubectl -n k8s-lab get endpoints web-broken
```

---

## ✅ Salida esperada

- El Service `web-broken` tiene `CLUSTER-IP` asignada.
- `ENDPOINTS` muestra `<none>`: no hay pods seleccionados o no están listos.
- El Deployment `web-svc` puede estar `Running`, pero sus labels no coinciden con el selector.

Interpretación:

- `<none>` + pods `Running` → selector o labels no coinciden.
- `<none>` + pods `0/1` → readiness probe fallando.
- Endpoints con IPs pero conexión rechazada → `targetPort` o puerto del contenedor incorrecto.
- DNS resuelve pero timeout → NetworkPolicy, kube-proxy o el backend no escucha.

---

## 🧠 Diagnóstico

Un Service no “apunta” a pods por nombre: selecciona pods por labels. Los endpoints se generan a partir de pods que coinciden con el selector y están `Ready`. Si el selector está mal, el Service existe pero no tiene a quién enviar tráfico.

En el laboratorio, el Service usa `selector.app: web-wrong` mientras el Deployment tiene `app: web-svc`. La app está sana; el Service está mal.

Revisa en este orden:

1. selector del Service vs. labels de los pods;
2. readiness de los pods;
3. `targetPort` vs. `containerPort` (y nombres de puerto);
4. NetworkPolicy en el namespace;
5. que el Service y los pods estén en el mismo namespace.

---

## 🛠️ Procedimiento (runbook)

### 1. Ver el selector del Service

```bash
kubectl -n k8s-lab get svc web-broken -o yaml
```

### 2. Ver los labels de los pods

```bash
kubectl -n k8s-lab get pods --show-labels
kubectl -n k8s-lab get pods -l app=web-svc
kubectl -n k8s-lab get pods -l app=web-wrong
```

### 3. Revisar EndpointSlices

```bash
kubectl -n k8s-lab get endpointslices \
  -l kubernetes.io/service-name=web-broken -o wide
```

### 4. Verificar readiness

```bash
kubectl -n k8s-lab describe pod -l app=web-svc
```

Si `READY` es `0/1`, el problema puede ser la probe, no el selector.

### 5. Probar DNS y conectividad desde un pod

```bash
kubectl -n k8s-lab run tmp --rm -it --restart=Never \
  --image=busybox:1.36 -- \
  nslookup web-broken.k8s-lab.svc.cluster.local

kubectl -n k8s-lab run tmp --rm -it --restart=Never \
  --image=busybox:1.36 -- \
  wget -qO- http://web-broken.k8s-lab.svc.cluster.local
```

### 6. Corregir el selector

```bash
kubectl -n k8s-lab patch svc web-broken \
  -p '{"spec":{"selector":{"app":"web-svc"}}}'
```

### 7. Si el puerto está mal

```bash
kubectl -n k8s-lab patch svc web-broken \
  -p '{"spec":{"ports":[{"name":"http","port":80,"targetPort":80}]}}'
```

---

## 🧯 Mitigación

En un incidente real, el objetivo es restaurar el enrutamiento sin romper otras cosas:

- Corrige el selector o el `targetPort` del Service.
- Si el problema es readiness, corrige la probe o la app; no fuerces `Ready`.
- Si hay NetworkPolicy, abre solo el puerto/origen necesario.
- Si el Service es de otro namespace, crea el Service/EndpointSlice correcto.

En el laboratorio, después del patch:

```bash
kubectl -n k8s-lab get endpoints web-broken
```

Debe listar las IPs de los pods de `web-svc`.

---

## ✅ Verificación

```bash
kubectl -n k8s-lab get endpoints web-broken
kubectl -n k8s-lab run tmp --rm -it --restart=Never \
  --image=busybox:1.36 -- \
  wget -qO- http://web-broken.k8s-lab.svc.cluster.local
```

Criterios:

- `ENDPOINTS` muestra al menos una IP.
- El `wget` devuelve el HTML de nginx (o un 200).
- `kubectl get endpointslices` muestra los pods listos.
- No hay timeouts ni `connection refused`.

---

## 🎓 Prevención

- Estandariza labels (`app.kubernetes.io/name`, `app.kubernetes.io/instance`).
- Usa `readinessProbe` y no envíes tráfico antes de estar listo.
- Prueba el Service en CI/e2e con un pod cliente, no solo el Deployment.
- Revisa `kubectl diff` antes de aplicar cambios de selector.
- Monitorea endpoints vacíos y errores 5xx del ingress/Service.

---

## ⚠️ Qué no hacer

- Reiniciar pods sin revisar el selector: no cambia nada.
- Cambiar el Service a `NodePort` o `LoadBalancer` como parche: no arregla el enrutamiento interno.
- Ignorar la readiness y forzar el pod a `Ready`: enmascara el fallo.
- Abrir toda la NetworkPolicy “para probar”: amplía el riesgo.
- Confundir `ClusterIP` con un balanceador externo.

---

## 🔗 Referencias internas

- [Laboratorio Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — setup, comando y reset.
- [Manifiesto roto](/learning-sys-admin-guides-web/labs/k8s/manifests/broken/04-service-selector.yaml) — Service con selector incorrecto.
- [Ingress/TLS](/learning-sys-admin-guides-web/scenarios/kubernetes/05-ingress-tls/) — si el Service está bien pero el ingress falla.
- [kubectl](/learning-sys-admin-guides-web/guides/kubectl/) — `get`, `describe`, `run`, `patch`.
