---
title: "🧩 Escenario: state perdido — importar un recurso existente"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "iac"
  - label: "Herramientas"
    value: "Terraform, `terraform import`, Docker"
  - label: "Archivos"
    value: "`labs/iac/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/iac"
        label: "Laboratorio de IaC"
---

# 🧩 Escenario: state perdido — importar un recurso existente

---

## 🎯 Problema

El contenedor `iac-web` está funcionando, pero Terraform ya no lo conoce:

```bash
terraform state rm docker_container.web
```

`terraform plan` quiere crear un contenedor nuevo con el mismo nombre y puerto, lo que fallará o duplicará la infraestructura. El recurso real existe; lo que falta es la entrada en el state.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/iac
./scripts/break.sh 02
cd terraform && terraform plan
```

---

## ✅ Salida esperada

- `terraform state list` no muestra `docker_container.web`.
- `docker ps` sigue mostrando `iac-web` arriba.
- `terraform plan` propone `docker_container.web will be created`.
- Si aplicas sin importar, Docker puede fallar por nombre/puerto duplicado.

---

## 🧠 Diagnóstico

El state es la **fuente de verdad de Terraform**, no del mundo. `state rm` elimina la asociación, pero no borra el objeto real. A partir de ahí:

- Terraform cree que el recurso no existe y quiere crearlo;
- el objeto real sigue ocupando el nombre y el puerto;
- el `apply` choca con la realidad.

La solución correcta es **importar** el recurso existente al state, usando el identificador que espera el provider. En el provider de Docker, el ID es el ID del contenedor (o el nombre, según la versión); el ID completo es más robusto.

```bash
docker inspect -f '{{.Id}}' iac-web
terraform import docker_container.web <id>
```

Importar no valida que la configuración coincida: después hay que ejecutar `plan` y ajustar.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar la pérdida

```bash
cd public/labs/iac
./scripts/break.sh 02
cd terraform
terraform state list
docker ps --filter name=iac-web
terraform plan
```

### 2. Obtener el ID real

```bash
docker inspect -f '{{.Id}}' iac-web
```

### 3. Importar

```bash
terraform import docker_container.web "$(docker inspect -f '{{.Id}}' iac-web)"
```

Debe responder `Import successful!`.

### 4. Revisar el plan

```bash
terraform plan -detailed-exitcode
```

Puede aparecer un reemplazo si el estado importado no coincide con la configuración (por ejemplo, labels o nombre). Revisa el diff antes de aplicar:

```bash
terraform plan -out=tfplan
terraform show tfplan
```

### 5. Aplicar y verificar

```bash
terraform apply -auto-approve
curl -fsS http://localhost:8088/ | head
terraform plan -detailed-exitcode   # 0
```

---

## 🧯 Mitigación

- Si el recurso es crítico, no lo borres para “recrearlo”: impórtalo.
- Si el state se perdió por completo, importa los recursos uno a uno y valida el plan.
- Si el recurso tiene dependencias, importa en orden (red, imagen, contenedor, etc.).
- Si el plan propone reemplazo, decide si es aceptable o si hay que ajustar la configuración.
- Mantén un backup del state antes de operaciones destructivas.

---

## ✅ Verificación

- `terraform state list` incluye `docker_container.web`.
- `terraform plan -detailed-exitcode` devuelve `0` o un diff revisado.
- `curl` responde.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Usa un backend remoto con versionado y locking.
- Haz backups del state antes de `state rm`, `import` o migraciones.
- Restringe quién puede ejecutar `terraform state`.
- Documenta los IDs de importación por tipo de recurso.
- Automatiza la importación en el pipeline cuando adoptes recursos existentes.
- No copies states entre entornos sin revisar.

---

## ⚠️ Qué no hacer

- **No borres el contenedor real** para que coincida con el state.
- **No edites el state a mano** para añadir el recurso.
- **No importes sin revisar el plan**: el state importado puede no coincidir.
- **No uses `terraform state rm` como “reset”**; elimina la gestión, no el recurso.
- **No compartas un state local** entre personas o pipelines.

---

## 🔗 Referencias internas

- [Laboratorio de IaC](/learning-sys-admin-guides-web/labs/iac/) — setup y reset.
- [Escenario: drift](/learning-sys-admin-guides-web/scenarios/iac/01-terraform-drift/) — cuando el recurso desaparece.
- [Escenario: state corrupto](/learning-sys-admin-guides-web/scenarios/iac/03-terraform-state-corrupt/) — cuando el archivo no se puede leer.
