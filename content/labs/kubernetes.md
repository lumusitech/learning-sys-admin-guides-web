---
title: "🧪 Laboratorio Kubernetes — Incidentes con kind"
section: "labs"
meta:
  - label: "Requisitos"
    value: "`docker`, `kind`, `kubectl`, `openssl`"
  - label: "Herramientas"
    value: "`kind`, `kubectl`, `curl`, `openssl`"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/kubernetes/01-crashloopbackoff"
        label: "K8s/01 CrashLoopBackOff"
      - id: "scenarios/kubernetes/02-oomkilled"
        label: "K8s/02 OOMKilled"
      - id: "scenarios/kubernetes/03-imagepullbackoff"
        label: "K8s/03 ImagePullBackOff"
      - id: "scenarios/kubernetes/04-service-no-endpoints"
        label: "K8s/04 Service sin endpoints"
      - id: "scenarios/kubernetes/05-ingress-tls"
        label: "K8s/05 Ingress/TLS"
      - id: "scenarios/kubernetes/06-pvc-pending"
        label: "K8s/06 PVC Pending"
---

# 🧪 Laboratorio Kubernetes — Incidentes con kind

---

## 🎯 Cuándo usar esta sección

Para practicar incidentes de Kubernetes en un cluster local y desechable, sin tocar staging ni producción. El laboratorio levanta un cluster con `kind`, despliega una aplicación sana y permite romperla de forma controlada para entrenar diagnóstico, mitigación y verificación.

Cada incidente tiene su escenario con runbook; el laboratorio aporta el estado roto y el reset.

---

## 🔄 Flujo recomendado

1. **Preparar** el cluster y la app base.
2. **Romper** el incidente elegido con `./scripts/break.sh <id>`.
3. **Diagnosticar** siguiendo el escenario (eventos, logs, endpoints, ingress).
4. **Mitigar** y **verificar** que la app vuelve a responder.
5. **Resetear** el laboratorio antes del siguiente incidente.

---

## 📋 Requisitos

- Docker en ejecución.
- `kind` y `kubectl` en el `PATH`.
- `openssl` para el certificado self-signed del ingress.
- 2 CPU y 4 GB de RAM libres; las imágenes (`nginx`, `python`, `busybox`, ingress-nginx) se descargan la primera vez.

```bash
docker info >/dev/null && echo "Docker OK"
kind version
kubectl version --client
openssl version
```

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | CrashLoopBackOff | El pod reinicia en bucle | [K8s/01](/learning-sys-admin-guides-web/scenarios/kubernetes/01-crashloopbackoff/) |
| 02 | OOMKilled | El pod muere por memoria (exit 137) | [K8s/02](/learning-sys-admin-guides-web/scenarios/kubernetes/02-oomkilled/) |
| 03 | ImagePullBackOff | La imagen no se descarga | [K8s/03](/learning-sys-admin-guides-web/scenarios/kubernetes/03-imagepullbackoff/) |
| 04 | Service sin endpoints | El Service existe pero no enruta | [K8s/04](/learning-sys-admin-guides-web/scenarios/kubernetes/04-service-no-endpoints/) |
| 05 | Ingress/TLS | 503, 404 o certificado inválido | [K8s/05](/learning-sys-admin-guides-web/scenarios/kubernetes/05-ingress-tls/) |
| 06 | PVC Pending | El pod no arranca por almacenamiento | [K8s/06](/learning-sys-admin-guides-web/scenarios/kubernetes/06-pvc-pending/) |

---

## 🛠️ Preparación

Descarga la carpeta del laboratorio desde el sitio o copia los assets a una carpeta local. Luego:

```bash
cd k8s
./scripts/setup.sh
```

Si el script no tiene permiso de ejecución:

```bash
bash scripts/setup.sh
```

El setup:

1. crea el cluster `sysadmin-lab` con `kind-config.yaml`;
2. aplica el namespace, el PV local y la app `web`;
3. instala ingress-nginx para kind;
4. genera el secreto TLS `app-tls` con un certificado self-signed;
5. aplica el Ingress `app.local` y verifica.

Para probar el ingress desde el host, agrega la entrada en `/etc/hosts`:

```text
127.0.0.1 app.local broken.local
```

Y prueba con `curl` (el certificado es self-signed):

```bash
curl -k --resolve app.local:8443:127.0.0.1 https://app.local:8443/
```

---

## 🧪 Comandos de laboratorio

```bash
# Romper un incidente (01..06)
./scripts/break.sh 01

# Ver el estado
kubectl -n k8s-lab get pods,svc,ingress,pvc

# Verificar la app base
./scripts/verify.sh

# Resetear los incidentes (mantiene el cluster y la app base)
./scripts/reset.sh

# Borrar el cluster completo
./scripts/reset.sh --all
```

Los manifiestos rotos crean recursos separados (`web-crash`, `memstress`, `web-bad-image`, etc.); la app base `web` sigue sana para comparar.

---

## 🧯 Reset y limpieza

- `./scripts/reset.sh`: borra todos los recursos de `manifests/broken/` y deja el cluster con la app base.
- `./scripts/reset.sh --all`: elimina el cluster `sysadmin-lab`.
- Si quedó un PVC en `Terminating`, revisa que no haya pods usándolo antes de borrar el namespace.

---

## ⚠️ Notas

- Es un entorno local y desechable: no uses estas imágenes ni credenciales en producción.
- El ingress controller se instala desde el manifiesto oficial de ingress-nginx para kind; requiere red.
- El certificado es self-signed: `curl -k` es esperado en el laboratorio, no una solución para producción.
- Para el PVC, el laboratorio incluye un PV `local-pv` con `storageClassName: manual`; el incidente usa una clase inexistente a propósito.

---

## 🔗 Referencias internas

- [kubectl](/learning-sys-admin-guides-web/guides/kubectl/) — comandos y patrones de inspección.
- [CrashLoopBackOff](/learning-sys-admin-guides-web/scenarios/kubernetes/01-crashloopbackoff/) — primer incidente del laboratorio.
- [Config drift](/learning-sys-admin-guides-web/scenarios/system/15-config-drift/) — cambios no autorizados, también aplicable a manifiestos.
