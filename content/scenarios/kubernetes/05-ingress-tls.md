---
title: "🧩 Escenario: Ingress con TLS roto — 503 o certificado inválido"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "kubernetes"
  - label: "Herramientas"
    value: "`kubectl`, `curl`, `openssl`"
  - label: "Archivos"
    value: "`labs/k8s/manifests/broken/05-ingress-tls.yaml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/kubernetes"
        label: "Laboratorio Kubernetes"
---

# 🧩 Escenario: Ingress con TLS roto — 503 o certificado inválido

---

## 🎯 Problema

El dominio responde con `503 Service Temporarily Unavailable`, `404` o un error de certificado. El Ingress existe, pero el controller no encuentra el Secret TLS, el backend no existe o el host no coincide. El servicio queda inaccesible desde fuera del cluster.

---

## ⚡ Quick command (SRE)

```bash
kubectl -n k8s-lab get ingress
kubectl -n k8s-lab describe ingress web-broken
curl -kv --resolve broken.local:8443:127.0.0.1 https://broken.local:8443/
```

---

## ✅ Salida esperada

- Ingress con `ADDRESS` vacía o el host del controller.
- `describe ingress` con eventos:
  - `secret "broken-tls" not found`;
  - `service "web-missing" not found`;
  - `ingress class "nginx" not found` si falta el controller.
- `curl` con certificado por defecto (`CN=ingress.local` o similar), no el de `broken.local`.
- `503` si el backend no tiene endpoints; `404` si el host/path no coincide.

---

## 🧠 Diagnóstico

El Ingress es una regla; el controller (ingress-nginx) es quien la aplica. Hay cuatro piezas que deben coincidir:

1. **Controller**: instalado y con pods `Ready`.
2. **IngressClass**: el Ingress referencia `nginx` y el controller la implementa.
3. **TLS Secret**: existe en el **mismo namespace** y tiene `tls.crt`/`tls.key` válidos para el host.
4. **Backend**: el Service existe, tiene endpoints y el puerto coincide.

En el laboratorio, el Ingress roto referencia el Secret `broken-tls` (no existe) y el Service `web-missing` (no existe).

---

## 🛠️ Procedimiento (runbook)

### 1. Verificar el controller

```bash
kubectl -n ingress-nginx get pods
kubectl -n ingress-nginx get svc
```

Si no está instalado, ejecuta `./scripts/ingress.sh` en el laboratorio.

### 2. Describir el Ingress

```bash
kubectl -n k8s-lab describe ingress web-broken
kubectl -n k8s-lab get ingress web-broken -o yaml
```

### 3. Comprobar el Secret TLS

```bash
kubectl -n k8s-lab get secret broken-tls
```

Si no existe, créalo con un certificado para el host:

```bash
cat > /tmp/broken-openssl.cnf <<'EOF'
[req]
distinguished_name = req_distinguished_name
x509_extensions = v3_req
prompt = no

[req_distinguished_name]
CN = broken.local

[v3_req]
subjectAltName = DNS:broken.local
EOF

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /tmp/broken.key -out /tmp/broken.crt \
  -config /tmp/broken-openssl.cnf

kubectl -n k8s-lab create secret tls broken-tls \
  --cert=/tmp/broken.crt --key=/tmp/broken.key
```

### 4. Comprobar el backend

```bash
kubectl -n k8s-lab get svc web-missing
kubectl -n k8s-lab get svc web
kubectl -n k8s-lab get endpoints web
```

Si el backend correcto es `web`, corrige el Ingress:

```bash
kubectl -n k8s-lab patch ingress web-broken --type=json \
  -p='[{"op":"replace","path":"/spec/rules/0/http/paths/0/backend/service/name","value":"web"}]'
```

### 5. Revisar los logs del controller

```bash
kubectl -n ingress-nginx logs -l app.kubernetes.io/component=controller --tail=100
```

Busca `ingress` con el namespace `k8s-lab`, `secret` o `backend`.

### 6. Probar el host correcto

```bash
# /etc/hosts: 127.0.0.1 broken.local
curl -kv --resolve broken.local:8443:127.0.0.1 https://broken.local:8443/
```

---

## 🧯 Mitigación

En un incidente real:

- Si falta el Secret, créalo o restaura el certificado; no desactives TLS.
- Si el backend no existe, corrige el nombre/puerto o restaura el Service.
- Si el controller está caído, restaura sus pods; revisa recursos y logs.
- Si el host no coincide, corrige la regla del Ingress o el DNS.
- Si el certificado está vencido, renueva y recarga; automatiza con cert-manager.

En el laboratorio, después de crear el Secret y corregir el backend, el Ingress debe responder `200`.

---

## ✅ Verificación

```bash
kubectl -n k8s-lab get ingress web-broken
kubectl -n k8s-lab get endpoints web
curl -kv --resolve broken.local:8443:127.0.0.1 https://broken.local:8443/
```

Criterios:

- El Ingress muestra el backend `web:80` y el Secret `broken-tls`.
- `curl` devuelve `200` y el certificado muestra `CN=broken.local`.
- No hay eventos nuevos de `secret not found` ni `service not found`.
- El controller no registra errores para el namespace.

---

## 🎓 Prevención

- Automatiza certificados con cert-manager y monitorea el vencimiento.
- Valida en CI que el Ingress referencia Secrets y Services existentes.
- Usa `kubectl diff` antes de aplicar cambios de ingress.
- Prueba el host real con `curl --resolve` en el pipeline.
- Alerta sobre 5xx del ingress y sobre certificados próximos a vencer.

---

## ⚠️ Qué no hacer

- Desactivar TLS o usar `curl -k` como solución permanente.
- Poner el Secret en otro namespace y esperar que el Ingress lo vea.
- Cambiar el host del Ingress sin actualizar DNS o `/etc/hosts`.
- Ignorar los eventos del Ingress y culpar al backend.
- Reiniciar el controller sin revisar logs y configuración.

---

## 🔗 Referencias internas

- [Laboratorio Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — setup, ingress y reset.
- [Manifiesto roto](/learning-sys-admin-guides-web/labs/k8s/manifests/broken/05-ingress-tls.yaml) — Ingress con Secret y backend inexistentes.
- [Service sin endpoints](/learning-sys-admin-guides-web/scenarios/kubernetes/04-service-no-endpoints/) — si el Ingress está bien pero el Service no enruta.
- [Certificado TLS vencido](/learning-sys-admin-guides-web/scenarios/infrastructure/04-tls-expired/) — renovación y automatización fuera de K8s.
