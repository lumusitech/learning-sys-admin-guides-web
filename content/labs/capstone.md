---
title: "🧪 Capstone de guardia — incidente multi-dominio"
section: "labs"
meta:
  - label: "Requisitos"
    value: "Docker, Terraform, `kind`/`kubectl` opcional"
  - label: "Herramientas"
    value: "Postfix, Dovecot, chrony, PostgreSQL, Terraform, Kubernetes"
  - label: "Escenario"
    links:
      - id: "scenarios/capstone/01-night-shift"
        label: "Capstone/01 Guardia nocturna"
---

# 🧪 Capstone de guardia — incidente multi-dominio

---

## 🎯 Cuándo usar esta sección

Para entrenar una guardia realista: varias alertas a la vez, dominios distintos y la tentación de reiniciar todo. El capstone no añade un servicio nuevo; **orquesta los labs existentes** y te obliga a priorizar, correlacionar y cerrar con evidencia.

No hay una única causa raíz. Hay fallos independientes que coinciden en el tiempo; el objetivo es no confundirlos y no empeorar el estado.

---

## 🗺️ Topología del incidente

| Dominio | Lab | Síntoma |
|---|---|---|
| Datos | `public/labs/db` | PostgreSQL sin conexiones libres |
| Correo | `public/labs/email` | Cola de correo diferida |
| Identidad | `public/labs/identity` | Cuenta bloqueada por PAM |
| Tiempo | `public/labs/time` | Cliente NTP sin sincronizar |
| IaC | `public/labs/iac` | Drift de Terraform |
| Kubernetes (opcional) | `public/labs/k8s` | Service sin endpoints |
| Boot (opcional) | `public/labs/boot` | Recuperación de arranque |

---

## 📋 Requisitos

- Docker y Docker Compose.
- Terraform en `PATH` para el lab de IaC.
- `kind` y `kubectl` solo si quieres la fase de Kubernetes.
- Los labs deben estar preparados; el script `stage.sh` los levanta.

```bash
cd public/labs/capstone
./scripts/stage.sh
```

Si quieres incluir Kubernetes:

```bash
./scripts/stage.sh --with-k8s
```

---

## 🗺️ Cómo se juega

```bash
# 1. Lee el briefing
./scripts/briefing.sh

# 2. Prepara los labs
./scripts/stage.sh

# 3. Inyecta el incidente
./scripts/break.sh all
# o por fases: 1 (datos/correo), 2 (acceso/tiempo), 3 (IaC/K8s)

# 4. Diagnostica y repara siguiendo el escenario
# 5. Cierra con las verificaciones
./scripts/verify.sh

# 6. Restaura todo
./scripts/reset.sh
```

`break.sh` no es destructivo para tus datos: los labs son desechables. `reset.sh` sí elimina y recrea los entornos.

---

## 🧭 Reglas de la guardia

1. **Primero el alcance:** confirma qué está afectado y qué no.
2. **Evidencia antes de tocar:** guarda logs, `mailq`, `terraform plan`, `faillock`.
3. **Un cambio a la vez:** anota qué haces y qué esperas.
4. **No reinicies todo** al primer síntoma; pierdes la causa y el aprendizaje.
5. **Cierra con verificación:** no basta con que “parezca” que funciona.
6. **Postmortem sin culpables:** causas, factores contribuyentes y acciones.

---

## 📊 Criterios de cierre

- `./scripts/verify.sh` termina en verde.
- La web responde y el servicio tiene endpoints (si hay K8s).
- PostgreSQL acepta conexiones de `app`.
- `mailq` está vacía y el correo de prueba se entrega.
- `learner` puede entrar y `admin` puede usar sudo.
- `chronyc tracking` muestra `Leap status: Normal`.
- `terraform plan -detailed-exitcode` devuelve `0`.
- El postmortem está escrito con timeline y acciones.

---

## 📝 Plantilla de postmortem

```markdown
# Incidente: <título>
- Fecha/hora:
- Duración:
- Impacto:
- Detección:

## Timeline
| Hora | Evento | Acción |
|---|---|---|

## Causas
- Causa raíz 1:
- Causa raíz 2:

## Factores contribuyentes
- ...

## Qué funcionó
- ...

## Qué falló
- ...

## Acciones
| Acción | Responsable | Fecha | Ticket |
|---|---|---|---|
```

---

## ⚠️ Notas

- Es un entorno local y desechable; no lo expongas a Internet.
- Kubernetes y boot recovery son opcionales; el capstone funciona con los labs Docker.
- Los fallos son independientes a propósito: no busques una sola causa.
- Si algo tarda, usa `status.sh` para ver qué está arriba antes de reiniciar.

---

## 🔗 Referencias internas

- [Escenario: guardia nocturna](/learning-sys-admin-guides-web/scenarios/capstone/01-night-shift/) — el incidente completo.
- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — conexiones y réplica.
- [Laboratorio de correo](/learning-sys-admin-guides-web/labs/email/) — cola y entrega.
- [Laboratorio de identidad](/learning-sys-admin-guides-web/labs/identity-access/) — PAM y sudo.
- [Laboratorio de tiempo](/learning-sys-admin-guides-web/labs/time/) — NTP.
- [Laboratorio de IaC](/learning-sys-admin-guides-web/labs/iac/) — drift y state.
- [Laboratorio de Kubernetes](/learning-sys-admin-guides-web/labs/kubernetes/) — servicios y endpoints.
