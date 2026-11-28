---
title: "🧩 Escenario: pérdida de datos en PostgreSQL y restore"
level: "Avanzado"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`pg_dump`, `pg_restore`, `psql`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/scripts/setup.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: pérdida de datos en PostgreSQL y restore

---

## 🎯 Problema

Un `TRUNCATE` o un `DELETE` sin `WHERE` vació la tabla `orders`. La aplicación no falla al arrancar, pero devuelve cero resultados y los usuarios reportan datos perdidos. La pregunta ya no es cómo prevenir el borrado: es cuánto se perdió, qué backup existe y cuánto tarda el restore. El objetivo es recuperar los datos sin convertir el incidente en una segunda pérdida.

---

## ⚡ Quick command (SRE)

```bash
docker compose exec -T postgres-primary psql -U app -d app \
  -c "SELECT count(*) FROM orders;"
docker compose exec -T postgres-primary ls -lh /tmp/app.dump
```

---

## ✅ Salida esperada

- `count(*)` devuelve `0` (o menos filas de las esperadas).
- El backup existe en `/tmp/app.dump` con un tamaño razonable.
- `pg_restore --list /tmp/app.dump` muestra la tabla `orders`.
- La réplica también refleja el borrado: es física, no una copia histórica.
- Después del restore, `count(*)` vuelve a `5000`.

---

## 🧠 Diagnóstico

Antes de tocar nada, define dos números:

- **RPO** (Recovery Point Objective): cuántos datos puedes perder como máximo.
- **RTO** (Recovery Time Objective): cuánto puede tardar el servicio en volver.

Tipos de backup:

1. **Lógico** (`pg_dump`): exporta SQL o un formato custom (`-Fc`). Sirve para restaurar una tabla o una base completa, pero no para un point-in-time exacto.
2. **Físico** (`pg_basebackup`): copia el cluster completo. Es la base para PITR con WAL archivado.
3. **PITR** (Point-In-Time Recovery): backup base + WAL archivado; permite restaurar hasta un instante concreto.

El laboratorio usa un backup lógico de la tabla `orders`:

```bash
pg_dump -U app -d app -Fc -t orders -f /tmp/app.dump
```

`-Fc` es el formato custom, comprimido y restaurable con `pg_restore`. `-t orders` limita el backup a esa tabla; un backup completo de la base sería sin `-t`.

Un detalle importante: la réplica no te salva de un `TRUNCATE`. Replica el mismo WAL y aplica el mismo borrado. Para recuperar datos necesitas un backup o PITR.

---

## 🛠️ Procedimiento (runbook)

### 1. Confirmar el alcance

```bash
docker compose exec -T postgres-primary psql -U app -d app -c \
  "SELECT count(*) AS filas, min(created_at) AS desde, max(created_at) AS hasta FROM orders;"
```

Si la tabla está vacía, `min` y `max` serán `NULL`. Comprueba también si el borrado afectó a otras tablas.

### 2. Inspeccionar el backup antes de restaurar

```bash
docker compose exec -T postgres-primary pg_restore --list /tmp/app.dump
docker compose exec -T postgres-primary ls -lh /tmp/app.dump
```

`pg_restore --list` muestra los objetos incluidos. Si el backup está vacío o corrupto, no lo uses: busca otra copia.

### 3. Restaurar en una base nueva (recomendado)

```bash
docker compose exec -T postgres-primary dropdb -U postgres --if-exists app_restore
docker compose exec -T postgres-primary createdb -U postgres -O app app_restore
docker compose exec -T postgres-primary pg_restore -U app -d app_restore /tmp/app.dump

docker compose exec -T postgres-primary psql -U app -d app_restore -c \
  "SELECT count(*) AS filas FROM orders;"
```

Restaurar en `app_restore` te permite verificar los datos sin tocar la base rota. Si el restore falla, la producción sigue igual.

### 4. Restaurar en la base original (laboratorio)

```bash
./scripts/reset.sh 06
```

El reset ejecuta:

```bash
pg_restore -U app -d app --clean --if-exists /tmp/app.dump
```

`--clean` elimina los objetos antes de recrearlos; `--if-exists` evita fallar si ya no están. En producción, esto requiere una ventana de mantenimiento o una estrategia de swap.

### 5. Verificar los datos

```bash
docker compose exec -T postgres-primary psql -U app -d app \
  -c "SELECT count(*) FROM orders;" \
  -c "SELECT * FROM orders ORDER BY id LIMIT 5;"
```

No basta con que el restore termine sin errores: valida el número de filas, una muestra de datos y las restricciones.

### 6. Reproducir el incidente

```bash
./scripts/break.sh 06
```

El script vacía `orders` con `TRUNCATE`. A partir de ahí, el restore es el ejercicio.

---

## 🧯 Mitigación

1. **Detén las escrituras** sobre la tabla afectada para no mezclar datos nuevos con el restore.
2. **No borres el backup** ni el volumen actual: pueden contener la única copia.
3. **Restaura primero en una base nueva** y verifica.
4. **Elige el punto de recuperación**: el último backup o un PITR anterior al borrado.
5. **Documenta el RPO real**: si el backup es diario, puedes perder hasta 24 horas.
6. **Comunica el estado** mientras el restore corre; un restore de una tabla grande no es instantáneo.

---

## ✅ Verificación

- `count(*)` coincide con el valor esperado (5.000 en el laboratorio).
- Una muestra de filas tiene los datos correctos.
- La aplicación puede leer y escribir de nuevo.
- `pg_restore` no reporta errores.
- El backup usado queda identificado y no se sobrescribe.
- Si hubo PITR, el timestamp de recuperación es anterior al borrado.

---

## 🎓 Prevención

- Ten backups automáticos y **prueba el restore** periódicamente; un backup que nunca se restauró es una hipótesis.
- Define RPO y RTO por servicio, no un “backup diario” genérico.
- Para PITR, configura archiving de WAL y prueba la recuperación a un instante concreto.
- Restringe `TRUNCATE`, `DROP` y `DELETE` masivo; usa transacciones y revisa el `WHERE`.
- Guarda los backups fuera del host y del volumen de la base.
- Alerta si el backup falla o si el tamaño cambia de forma anómala.
- Documenta el runbook de restore y quién puede ejecutarlo.

---

## 🚫 Qué no hacer

- Restaurar sobre producción sin una copia del estado actual.
- Asumir que la réplica sirve como backup histórico: replica el borrado.
- Ejecutar `pg_restore --clean` sin revisar qué objetos va a borrar.
- Probar el restore por primera vez durante el incidente.
- Ignorar el RPO: “tenemos backups” no dice cuántos datos se pierden.
- Sobrescribir el único backup con un dump de una base ya vacía.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Réplica retrasada](/learning-sys-admin-guides-web/scenarios/databases/02-postgres-replication-lag/) — por qué la réplica no es un backup.
- [Bloqueos y deadlocks](/learning-sys-admin-guides-web/scenarios/databases/03-postgres-lock-contention/) — transacciones que retienen datos.
- [Docker](/learning-sys-admin-guides-web/guides/docker/) — volúmenes y ciclo de vida de los datos.
