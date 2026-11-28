---
title: "🧩 Escenario: conflicto de puerto — apply falla al publicar el servicio"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "iac"
  - label: "Herramientas"
    value: "Terraform, Docker, `ss`/`docker ps`"
  - label: "Archivos"
    value: "`labs/iac/scripts/break.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/iac"
        label: "Laboratorio de IaC"
---

# 🧩 Escenario: conflicto de puerto — apply falla al publicar el servicio

---

## 🎯 Problema

`terraform apply` falla al crear el contenedor:

```text
Error: Unable to start container: Error response from daemon:
driver failed programming external connectivity on endpoint iac-web:
Bind for 0.0.0.0:8088 failed: port is already allocated
```

El plan era válido, pero otro proceso ocupa el puerto `8088`. Terraform no puede completar la creación y el servicio queda caído o a medias.

---

## ⚡ Quick command (SRE)

```bash
cd public/labs/iac
./scripts/break.sh 04
cd terraform && terraform apply -auto-approve
```

---

## ✅ Salida esperada

- `apply` falla con `port is already allocated`.
- `docker ps` muestra un contenedor `iac-conflict` publicando `8088`.
- `terraform state list` puede tener el recurso en estado `tainted` o parcial.
- `curl http://localhost:8088/` responde desde el contenedor conflictivo, no desde `iac-web`.

---

## 🧠 Diagnóstico

Un `apply` puede fallar después de crear parte de la infraestructura. Terraform registra el recurso como **tainted** o deja un state parcial; el siguiente plan intentará recrearlo. El error de Docker es de **conflicto de recurso del host**, no de Terraform.

Diagnóstico:

```bash
docker ps --filter publish=8088
docker ps -a --filter name=iac
ss -lntp | grep ':8088'       # en Linux
lsof -nP -iTCP:8088 -sTCP:LISTEN  # en macOS
```

Preguntas clave:

- ¿Quién ocupa el puerto? ¿Un contenedor, un proceso local o otro stack?
- ¿El puerto está fijado en una variable o hardcodeado?
- ¿El fallo dejó un contenedor a medias con el mismo nombre?

En el laboratorio, `break.sh 04` arranca `iac-conflict` en `8088` y borra `iac-web`; el `apply` intenta recrearlo y choca.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el conflicto

```bash
cd public/labs/iac
./scripts/break.sh 04
docker ps --filter publish=8088
cd terraform
terraform apply -auto-approve
```

### 2. Identificar al ocupante

```bash
docker ps --filter publish=8088 --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
```

Si no es un contenedor:

```bash
sudo lsof -nP -iTCP:8088 -sTCP:LISTEN
```

### 3. Liberar el puerto

Para el laboratorio:

```bash
docker rm -f iac-conflict
```

En producción, coordina con el dueño del servicio; no mates procesos a ciegas.

### 4. Reintentar

```bash
terraform apply -auto-approve
terraform plan -detailed-exitcode   # 0
curl -fsS http://localhost:8088/ | head
```

Si el recurso quedó `tainted`:

```bash
terraform apply -replace=docker_container.web -auto-approve
```

### 5. Revisar el diseño

Si el puerto es fijo, conviértelo en variable o usa un puerto dinámico. Si el host aloja varios stacks, define un rango y valida disponibilidad antes del apply.

---

## 🧯 Mitigación

- Libera el puerto o cambia el puerto externo en la configuración.
- Si el contenedor conflictivo es legítimo, no lo borres: reubica `iac-web`.
- Si el `apply` dejó un contenedor a medias, revisa `docker ps -a` y `terraform state`.
- Si el state quedó inconsistente, importa o reemplaza el recurso según corresponda.
- Si el servicio está caído, restaura el contenedor anterior o el balanceador.

---

## ✅ Verificación

- `docker ps --filter publish=8088` muestra solo `iac-web`.
- `terraform plan -detailed-exitcode` devuelve 0.
- `curl` responde `Welcome to nginx!`.
- `./scripts/reset.sh` restaura el laboratorio.

---

## 🎓 Prevención

- Parametriza puertos y valida que estén libres antes del apply.
- Usa un puerto por entorno/servicio y documenta el mapa.
- Evita `--network host` y publicaciones fijas en hosts compartidos.
- Añade un preflight en CI: `docker ps`, `ss -lntp`, `terraform plan`.
- Usa un reverse proxy para no exponer puertos de aplicación directamente.
- Prueba el `apply` en staging con la misma topología de puertos.

---

## ⚠️ Qué no hacer

- **No mates el proceso que ocupa el puerto** sin saber qué es.
- **No cambies el puerto a ciegas** sin actualizar DNS, proxy o clientes.
- **No ignores un apply parcial**: el state y el contenedor pueden quedar inconsistentes.
- **No uses `-auto-approve`** en producción sin revisar el plan.
- **No publiques el mismo puerto en dos stacks** “a ver cuál gana”.

---

## 🔗 Referencias internas

- [Laboratorio de IaC](/learning-sys-admin-guides-web/labs/iac/) — setup, puerto y reset.
- [Guía de Docker](/learning-sys-admin-guides-web/guides/docker/) — puertos y contenedores.
- [Escenario: drift](/learning-sys-admin-guides-web/scenarios/iac/01-terraform-drift/) — cuando la realidad cambia.
- [Escenario: state corrupto](/learning-sys-admin-guides-web/scenarios/iac/03-terraform-state-corrupt/) — cuando el state no se puede leer.
