---
title: "🧪 Laboratorio de IaC — Terraform y Docker"
section: "labs"
meta:
  - label: "Requisitos"
    value: "Terraform 1.5+, Docker, `curl`"
  - label: "Herramientas"
    value: "Terraform, provider Docker, `docker`"
  - label: "Escenarios relacionados"
    links:
      - id: "scenarios/iac/01-terraform-drift"
        label: "IaC/01 Drift"
      - id: "scenarios/iac/02-terraform-state-lost"
        label: "IaC/02 State perdido"
      - id: "scenarios/iac/03-terraform-state-corrupt"
        label: "IaC/03 State corrupto"
      - id: "scenarios/iac/04-terraform-port-conflict"
        label: "IaC/04 Conflicto de puerto"
---

# 🧪 Laboratorio de IaC — Terraform y Docker

---

## 🎯 Cuándo usar esta sección

Para practicar el ciclo real de infraestructura como código: `init`, `plan`, `apply`, estado, drift e importación. El laboratorio usa Terraform y el provider de Docker para gestionar un contenedor nginx local.

No necesitas una nube: el “proveedor” es Docker Desktop o el daemon local. Los conceptos —estado, plan, drift, import, locks y conflictos— son los mismos que verás con AWS, GCP o un clúster.

---

## 🔄 Flujo recomendado

1. **Preparar** con `./scripts/setup.sh` (`init` + `apply`).
2. **Romper** el incidente con `./scripts/break.sh <id>`.
3. **Diagnosticar** con `terraform plan`, `state list` y `docker`.
4. **Reparar** con `apply`, `import` o restaurando el state.
5. **Resetear** con `./scripts/reset.sh`.

---

## 📋 Requisitos

- Terraform 1.5 o superior en el `PATH`.
- Docker en marcha y accesible por el socket (`/var/run/docker.sock`).
- `curl` para verificar el servicio.
- Puerto `8088` libre.

```bash
terraform version
docker version --format '{{.Server.Version}}'
curl --version | head -1
```

---

## 🧩 Incidentes disponibles

| # | Escenario | Síntoma | Guía |
|---|---|---|---|
| 01 | Drift | El contenedor se borró fuera de Terraform | [IaC/01](/learning-sys-admin-guides-web/scenarios/iac/01-terraform-drift/) |
| 02 | State perdido | Terraform no conoce un recurso que existe | [IaC/02](/learning-sys-admin-guides-web/scenarios/iac/02-terraform-state-lost/) |
| 03 | State corrupto | `terraform plan` no puede leer el estado | [IaC/03](/learning-sys-admin-guides-web/scenarios/iac/03-terraform-state-corrupt/) |
| 04 | Conflicto de puerto | `apply` falla al publicar el puerto | [IaC/04](/learning-sys-admin-guides-web/scenarios/iac/04-terraform-port-conflict/) |

---

## 🛠️ Preparación

```bash
cd public/labs/iac
./scripts/setup.sh
```

El setup:

1. ejecuta `terraform init -upgrade` y descarga `kreuzwerker/docker`;
2. aplica un contenedor `iac-web` con nginx en `http://localhost:8088/`;
3. verifica `terraform output`, `docker ps` y la respuesta HTTP;
4. deja el state local en `terraform/terraform.tfstate`.

---

## 🧪 Comandos de laboratorio

```bash
cd public/labs/iac

# Estado del laboratorio
./scripts/verify.sh

# Terraform directo
cd terraform
terraform state list
terraform plan
terraform output

# Romper un incidente
cd ..
./scripts/break.sh 01

# Restaurar todo (borra state y recrea)
./scripts/reset.sh

# Destruir la infraestructura
cd terraform && terraform destroy -auto-approve
```

---

## ⚠️ Notas

- El state es **local** (`terraform.tfstate`); en producción usa un backend remoto con locking (S3 + DynamoDB, GCS, Terraform Cloud, etc.).
- `.terraform/` y `*.tfstate` están en `.gitignore`; el lock del provider (`.terraform.lock.hcl`) sí se versiona.
- El provider usa el socket de Docker; en macOS es `/var/run/docker.sock` con Docker Desktop.
- El contenedor `iac-web` es desechable. `reset.sh` lo borra y vuelve a aplicar.
- Terraform no “arregla” drift automáticamente: hay que ejecutar `plan`/`apply`.

---

## 🔗 Referencias internas

- [Concepto de idempotencia](/learning-sys-admin-guides-web/concepts/idempotency/) — por qué `apply` converge.
- [Guía de Docker](/learning-sys-admin-guides-web/guides/docker/) — contenedores, puertos y logs.
- [Escenario: config drift](/learning-sys-admin-guides-web/scenarios/system/15-config-drift/) — el mismo problema sin Terraform.
- [Escenario: state perdido](/learning-sys-admin-guides-web/scenarios/iac/02-terraform-state-lost/) — importación de recursos.
