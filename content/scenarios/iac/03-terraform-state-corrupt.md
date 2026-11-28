---
title: "🧩 Escenario: state corrupto — Terraform no puede leer el estado"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "iac"
  - label: "Herramientas"
    value: "Terraform, backups, Docker"
  - label: "Archivos"
    value: "`labs/iac/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/iac"
        label: "Laboratorio de IaC"
---

# 🧩 Escenario: state corrupto — Terraform no puede leer el estado

---

## 🎯 Problema

Cualquier comando de Terraform falla antes de mostrar el plan:

```text
Error: Error acquiring the state lock
Unsupported state file format: The state file could not be parsed as JSON
Unsupported state file format: The state file does not have a "version" key
```

El archivo `terraform.tfstate` quedó truncado o con JSON inválido. La infraestructura sigue funcionando, pero Terraform no puede gestionarla hasta recuperar un estado válido.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/iac
./scripts/break.sh 03
cd terraform && terraform plan
```

---

## ✅ Salida esperada

- `terraform plan` falla con `Unsupported state file format`.
- `terraform state list` también falla.
- `docker ps` sigue mostrando `iac-web` arriba.
- `terraform.tfstate` es un archivo truncado o inválido; el `.backup` o una copia previa puede servir.

---

## 🧠 Diagnóstico

Terraform lee el state al inicio de cada operación. Si el JSON no es válido, no hay plan posible: no es un problema del provider ni de Docker, sino del archivo de estado.

Causas típicas:

- escritura concurrente sin locking;
- copia/restauración interrumpida;
- edición manual del state;
- disco lleno o proceso terminado a mitad de escritura;
- merge incorrecto de estados.

Antes de tocar nada:

1. **No ejecutes `apply`** con un state inválido.
2. Copia el archivo actual para evidencia.
3. Busca `.backup`, snapshots del backend o versiones anteriores.
4. Comprueba el backend remoto si no es local.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar la corrupción

```bash
cd public/labs/iac
./scripts/break.sh 03
cd terraform
terraform plan
head -c 80 terraform.tfstate
```

### 2. Preservar evidencia

```bash
cp terraform.tfstate terraform.tfstate.corrupt
```

### 3. Restaurar una copia válida

El laboratorio dejó `terraform.tfstate.valid` antes de corromper:

```bash
cp terraform.tfstate.valid terraform.tfstate
```

Si no existe, usa `terraform.tfstate.backup` o la versión del backend:

```bash
cp terraform.tfstate.backup terraform.tfstate
```

### 4. Validar

```bash
terraform state list
terraform plan -detailed-exitcode
```

Si el plan muestra drift, revisa antes de aplicar. Si el state restaurado no incluye algún recurso, impórtalo.

### 5. Aplicar y verificar

```bash
terraform apply -auto-approve
curl -fsS http://localhost:8088/ | head
```

---

## 🧯 Mitigación

- Restaura el state desde el backend o un backup validado.
- Si no hay backup, reconstruye el state importando los recursos existentes.
- Si el backend está corrupto, usa el versionado del almacenamiento (S3 versioning, GCS generations).
- Si hay un lock obsoleto, `terraform force-unlock <id>` después de confirmar que no hay otro proceso.
- Documenta el incidente y revisa el pipeline que escribió el state.

---

## ✅ Verificación

- `terraform state list` funciona.
- `terraform plan -detailed-exitcode` devuelve 0 o un diff revisado.
- `curl` responde.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Usa un backend remoto con locking y versionado.
- No edites `*.tfstate` a mano.
- Haz backups antes de migraciones o `state rm`.
- Evita ejecutar Terraform en paralelo sobre el mismo state.
- Configura alertas de errores de state en CI.
- Prueba la restauración del state, no solo la creación.

---

## ⚠️ Qué no hacer

- **No ejecutes `apply`** con un state inválido.
- **No borres el state corrupto** sin copiarlo: perderás evidencia.
- **No edites JSON a mano** para “arreglarlo”.
- **No importes todo a ciegas** sin revisar el plan.
- **No uses un state local compartido** en un equipo.

---

## 🔗 Referencias internas

- [Laboratorio de IaC](/learning-sys-admin-guides-web/labs/iac/) — setup, state y reset.
- [Escenario: state perdido](/learning-sys-admin-guides-web/scenarios/iac/02-terraform-state-lost/) — importación.
- [Escenario: drift](/learning-sys-admin-guides-web/scenarios/iac/01-terraform-drift/) — diferencias entre state y realidad.
