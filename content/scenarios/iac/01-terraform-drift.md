---
title: "🧩 Escenario: drift en Terraform — la realidad no coincide con el state"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "iac"
  - label: "Herramientas"
    value: "Terraform, Docker, `terraform plan`"
  - label: "Archivos"
    value: "`labs/iac/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/iac"
        label: "Laboratorio de IaC"
---

# 🧩 Escenario: drift en Terraform — la realidad no coincide con el state

---

## 🎯 Problema

Terraform aplicó la infraestructura correctamente, pero alguien borró el contenedor a mano:

```bash
docker rm -f iac-web
```

El sitio deja de responder. `terraform plan` detecta que el recurso del state ya no existe y propone recrearlo. Ese es **drift**: la realidad cambió fuera de Terraform.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/iac
./scripts/break.sh 01
cd terraform && terraform plan -detailed-exitcode
```

---

## ✅ Salida esperada

- `terraform plan` termina con código `2` (`-detailed-exitcode`).
- El plan muestra:
  ```text
  # docker_container.web will be created
  Plan: 1 to add, 0 to change, 0 to destroy.
  ```
- `docker ps` no muestra `iac-web`.
- `curl http://localhost:8088/` falla.
- `terraform state list` sigue mostrando `docker_container.web`: el state no se actualizó solo.

---

## 🧠 Diagnóstico

Terraform guarda en el **state** la relación entre tu configuración y los objetos reales. En cada `plan`:

1. refresca el estado real de los recursos (por defecto);
2. compara con la configuración deseada;
3. calcula el diff.

Si el objeto desapareció, el plan propone crearlo. Si cambió un atributo (puerto, imagen, label), propone actualizarlo o reemplazarlo. Si alguien creó un recurso fuera del state, Terraform no lo adopta automáticamente: hay que importarlo.

`-detailed-exitcode` es útil en CI:

- `0`: sin cambios;
- `2`: hay cambios pendientes (drift o config nueva);
- `1`: error.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el drift

```bash
cd public/labs/iac
./scripts/break.sh 01
docker ps -a --filter name=iac-web
cd terraform
terraform plan -detailed-exitcode
```

### 2. Aplicar la convergencia

```bash
terraform apply -auto-approve
```

Terraform recrea `iac-web` porque el state dice que debe existir.

### 3. Verificar

```bash
terraform plan -detailed-exitcode   # debe devolver 0
curl -fsS http://localhost:8088/ | head
docker ps --filter name=iac-web
```

### 4. Investigar el origen del drift

```bash
docker events --since 1h --filter container=iac-web
```

Pregunta quién o qué borró el contenedor: una persona, un script, un `docker system prune`, un agente de limpieza.

---

## 🧯 Mitigación

- Si el drift es intencional, actualiza la configuración para reflejarlo y aplica.
- Si es accidental, `terraform apply` converge al estado deseado.
- Si el recurso existe pero no está en el state, no lo borres: impórtalo.
- Si el drift es masivo, revisa el pipeline y los permisos de escritura directa.
- Si el servicio está caído, restaura primero y documenta después.

---

## ✅ Verificación

- `terraform plan -detailed-exitcode` devuelve `0`.
- `curl` responde `Welcome to nginx!`.
- `docker ps` muestra `iac-web` arriba.
- `./scripts/reset.sh` deja el laboratorio limpio.

---

## 🎓 Prevención

- Prohíbe cambios manuales en recursos gestionados (política, IAM, revisión).
- Ejecuta `terraform plan` en CI y alerta si hay drift.
- Usa `prevent_destroy` en recursos críticos.
- Bloquea `docker rm`/consola equivalente para el equipo de aplicación.
- Documenta el runbook de drift y el canal de emergencia.
- Revisa los eventos del proveedor para detectar cambios fuera de código.

---

## ⚠️ Qué no hacer

- **No edites el state a mano** para “arreglar” un drift.
- **No hagas `terraform apply` sin leer el plan** si el recurso es crítico.
- **No borres el state** para que Terraform “vea” la realidad; perderás el control.
- **No ignores el drift**: el próximo apply puede destruir o duplicar recursos.
- **No uses `-auto-approve` en producción** sin revisar el plan.

---

## 🔗 Referencias internas

- [Laboratorio de IaC](/learning-sys-admin-guides-web/labs/iac/) — setup y reset.
- [Concepto de idempotencia](/learning-sys-admin-guides-web/concepts/idempotency/) — convergencia.
- [Escenario: config drift](/learning-sys-admin-guides-web/scenarios/system/15-config-drift/) — versión sin Terraform.
- [Escenario: state perdido](/learning-sys-admin-guides-web/scenarios/iac/02-terraform-state-lost/) — cuando el state no conoce el recurso.
