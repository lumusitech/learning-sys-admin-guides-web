---
title: "🧩 Escenario: PVC en Pending — el pod no arranca por almacenamiento"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "kubernetes"
  - label: "Herramientas"
    value: "`kubectl`, `kind`"
  - label: "Archivos"
    value: "`labs/k8s/manifests/broken/06-pvc-pending.yaml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/kubernetes"
        label: "Laboratorio Kubernetes"
---

# 🧩 Escenario: PVC en Pending — el pod no arranca por almacenamiento

---

## 🎯 Problema

Un pod queda en `Pending` porque su PersistentVolumeClaim (PVC) no se vincula. El PVC está en `Pending` y el evento dice `storageclass ... not found` o `no persistent volumes available`. El servicio no arranca aunque la imagen y la configuración estén bien.

---

## ⚡ Quick command (SRE)

```bash
kubectl -n k8s-lab get pods,pvc
kubectl -n k8s-lab describe pvc data-broken
```

---

## ✅ Salida esperada

- PVC `data-broken` en `STATUS Pending`.
- Pod `pvc-user` en `Pending`, `READY 0/1`.
- Eventos del PVC:
  - `storageclass.storage.k8s.io "does-not-exist" not found`;
  - `no persistent volumes available for this claim`.
- El pod no tiene eventos de imagen ni de recursos: el bloqueo es el volumen.

---

## 🧠 Diagnóstico

Un PVC se vincula a un PV (o a un provisioner) según:

1. `storageClassName` existente y compatible;
2. capacidad y `accessModes` del PV;
3. `volumeMode` y selectores;
4. que el provisioner dinámico esté instalado si la clase lo requiere.

Si el PVC queda `Pending`, el pod que lo monta también queda `Pending`: el scheduler no puede asignarlo hasta que el volumen esté disponible.

En el laboratorio, el PVC pide la clase `does-not-exist`. El cluster tiene un PV `local-pv` con `storageClassName: manual`, así que la corrección es recrear el PVC con esa clase.

---

## 🛠️ Procedimiento (runbook)

### 1. Ver PVC y pod

```bash
kubectl -n k8s-lab get pvc,pods
kubectl -n k8s-lab describe pvc data-broken
kubectl -n k8s-lab describe pod pvc-user
```

### 2. Ver StorageClasses y PVs

```bash
kubectl get storageclass
kubectl get pv
```

En `kind` no hay StorageClass por defecto; el laboratorio incluye `local-pv` como PV manual.

### 3. Confirmar la clase que pide el PVC

```bash
kubectl -n k8s-lab get pvc data-broken -o jsonpath='{.spec.storageClassName}{"\n"}'
```

### 4. Recrear el PVC con una clase válida

`spec.storageClassName` es inmutable: hay que borrar y recrear el PVC. Primero borra el pod que lo usa:

```bash
kubectl -n k8s-lab delete pod pvc-user --ignore-not-found
kubectl -n k8s-lab delete pvc data-broken --ignore-not-found

kubectl apply -f - <<'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data-broken
  namespace: k8s-lab
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: manual
  resources:
    requests:
      storage: 1Gi
EOF
```

### 5. Recrear el pod

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pvc-user
  namespace: k8s-lab
  labels:
    app: pvc-user
spec:
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data-broken
EOF
```

### 6. Si el pod sigue Pending sin PVC

```bash
kubectl -n k8s-lab describe pod pvc-user | sed -n '/Events/,$p'
```

Revisa recursos (`requests` demasiado altos), taints/tolerations o `nodeSelector`.

---

## 🧯 Mitigación

En producción:

- Si falta la StorageClass, instala/crea el provisioner o usa una clase existente.
- Si es un PV manual, verifica capacidad, `accessModes` y nodo.
- Si el PVC está atascado en `Terminating`, revisa pods/finalizers antes de forzar.
- Si el problema es scheduling (no storage), ajusta requests, taints o afinidad.
- No borres el PVC de un volumen con datos sin confirmar el respaldo.

En el laboratorio, recrear el PVC con `manual` y el pod lo vincula al PV `local-pv`.

---

## ✅ Verificación

```bash
kubectl -n k8s-lab get pvc data-broken
kubectl -n k8s-lab get pod pvc-user
kubectl -n k8s-lab exec pvc-user -- df -h /data
```

Criterios:

- PVC en `STATUS Bound`.
- Pod `Running` y `READY 1/1`.
- `/data` montado y escribible.
- No hay eventos nuevos de `FailedMount` ni `Pending`.

---

## 🎓 Prevención

- Define una StorageClass por defecto y documenta las disponibles.
- Alerta sobre PVCs en `Pending` y capacidad de volumen.
- Usa plantillas de PVC con `storageClassName` explícita.
- Prueba el binding en staging antes de producción.
- Ten un plan de backup/restore para volúmenes persistentes.

---

## ⚠️ Qué no hacer

- Borrar solo el pod: el PVC sigue `Pending` y el nuevo pod también.
- Cambiar `storageClassName` con `kubectl edit`: es inmutable; hay que recrear.
- Usar `hostPath` en producción como atajo.
- Ignorar `accessModes` y capacidad del PV.
- Borrar un PVC con datos sin backup.

---

## 🔗 Referencias internas

- [Laboratorio Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — setup, PV local y reset.
- [Manifiesto roto](/learning-sys-admin-guides-web/labs/k8s/manifests/broken/06-pvc-pending.yaml) — PVC con clase inexistente.
- [Disco lleno e inodes](/learning-sys-admin-guides-web/scenarios/system/06-disk-full-inodes/) — presión de almacenamiento en el host.
- [kubectl](/learning-sys-admin-guides-web/guides/kubectl/) — `get`, `describe`, `exec`.
