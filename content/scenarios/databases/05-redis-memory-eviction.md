---
title: "🧩 Escenario: Redis expulsa claves y el cache falla"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`redis-cli`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/redis/redis.conf`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: Redis expulsa claves y el cache falla

---

## 🎯 Problema

La aplicación usa Redis como cache, pero el hit rate cae y las consultas llegan a la base de datos. Redis está sano y responde `PONG`, aunque `evicted_keys` no deja de crecer: el dataset supera `maxmemory` y la política de expulsión está borrando claves que la aplicación esperaba encontrar. Hay que decidir si el límite es correcto, si faltan TTL o si el patrón de uso es el equivocado.

---

## ⚡ Quick command (SRE)

```bash
docker compose exec -T redis redis-cli INFO memory
docker compose exec -T redis redis-cli INFO stats \
  | grep -E "evicted_keys|expired_keys|keyspace_hits|keyspace_misses"
```

---

## ✅ Salida esperada

- `used_memory` pegado a `maxmemory` (32 MB en el laboratorio).
- `evicted_keys` mayor que cero y creciendo.
- `keyspace_misses` alto respecto a `keyspace_hits`.
- `DBSIZE` deja de crecer aunque la aplicación siga escribiendo claves.
- `maxmemory_policy: allkeys-lru` en `INFO memory`.

Con el laboratorio recién preparado, `evicted_keys` es `0` y `DBSIZE` es `0`. Después de `break.sh 05`, el script crea unos 200 MB de claves contra un límite de 32 MB.

---

## 🧠 Diagnóstico

Redis es un almacén en memoria: si el dataset crece más que `maxmemory`, solo hay tres salidas:

1. **expulsar claves** según `maxmemory-policy`;
2. **rechazar escrituras** con `OOM command not allowed` si la política es `noeviction`;
3. **usar swap**, que degrada la latencia y no es una solución para un cache.

Las políticas más comunes:

- `noeviction`: no expulsa; las escrituras fallan cuando se llena.
- `allkeys-lru`: expulsa la clave menos usada recientemente, sea cual sea.
- `volatile-lru`: expulsa solo claves con TTL, entre las menos usadas.
- `allkeys-random` / `volatile-random`: expulsan al azar; rara vez son la elección correcta.
- `volatile-ttl`: expulsa primero las claves con TTL más cercano.

`allkeys-lru` es razonable para un cache puro. Si Redis mezcla cache, colas y sesiones, una sola política puede borrar datos que no son desechables.

En el laboratorio, el script crea 200.000 claves de ~1 KB con `SET`, sin TTL, contra 32 MB. Redis empieza a expulsar en cuanto se llena; la aplicación sigue escribiendo, pero las claves antiguas desaparecen.

---

## 🛠️ Procedimiento (runbook)

### 1. Reproducir el incidente

```bash
./scripts/break.sh 05
sleep 5
docker compose exec -T redis redis-cli INFO memory \
  | grep -E "used_memory_human|maxmemory_human|maxmemory_policy"
docker compose exec -T redis redis-cli INFO stats \
  | grep -E "evicted_keys|keyspace_hits|keyspace_misses"
```

### 2. Medir el dataset

```bash
docker compose exec -T redis redis-cli DBSIZE
docker compose exec -T redis redis-cli INFO keyspace
docker compose exec -T redis redis-cli --bigkeys
```

`--bigkeys` recorre la base y muestra las claves más grandes por tipo. En un incidente real, úsalo con cuidado: puede añadir carga.

### 3. Inspeccionar claves concretas

```bash
docker compose exec -T redis redis-cli --scan --pattern 'key:*' | head
docker compose exec -T redis redis-cli TTL key:1
docker compose exec -T redis redis-cli MEMORY USAGE key:1
```

Si `TTL` devuelve `-1`, la clave no expira. Si devuelve `-2`, ya no existe (puede haber sido expulsada).

### 4. Confirmar la política y el límite

```bash
docker compose exec -T redis redis-cli CONFIG GET maxmemory
docker compose exec -T redis redis-cli CONFIG GET maxmemory-policy
docker compose exec -T redis redis-cli CONFIG GET maxmemory-samples
```

### 5. Mitigar en el laboratorio

```bash
# Subir el límite en caliente (se pierde al reiniciar el contenedor)
docker compose exec -T redis redis-cli CONFIG SET maxmemory 128mb

# O vaciar el laboratorio y volver a empezar
./scripts/reset.sh 05
```

Para que el cambio sea permanente, edita `redis.conf` y reinicia el servicio; `CONFIG SET` no modifica el archivo.

### 6. Verificar

```bash
docker compose exec -T redis redis-cli INFO stats \
  | grep -E "evicted_keys|keyspace_hits|keyspace_misses"
docker compose exec -T redis redis-cli DBSIZE
```

Con más memoria, `evicted_keys` deja de crecer. Si el dataset sigue creciendo, el problema vuelve: el límite no reemplaza una estrategia de TTL y de tamaño.

---

## 🧯 Mitigación

1. **Sube `maxmemory`** si el host tiene RAM y el dataset es legítimo.
2. **Elige la política correcta** según el contenido: `allkeys-lru` para cache puro, `volatile-lru` si todo lo cacheado tiene TTL.
3. **Añade TTL** a las claves que no lo tienen; una cache sin expiración crece hasta el límite.
4. **Separa workloads**: cache, colas y sesiones no deberían competir por el mismo `maxmemory`.
5. **Revisa claves grandes**: una sola clave de decenas de MB puede consumir el presupuesto de miles de claves pequeñas.
6. **No confundas Redis con una base de datos principal** si no tienes persistencia, réplicas y un plan de recuperación.

---

## ✅ Verificación

- `evicted_keys` deja de crecer con la carga normal.
- `used_memory` queda por debajo de `maxmemory` con margen.
- `DBSIZE` es estable y coherente con el número de claves esperadas.
- El hit rate (`keyspace_hits / (keyspace_hits + keyspace_misses)`) se recupera.
- La aplicación deja de ir a la base de datos por claves que deberían estar cacheadas.

---

## 🎓 Prevención

- Define `maxmemory` y `maxmemory-policy` desde el primer día; no dejes el valor por defecto sin revisarlo.
- Aplica TTL a todo lo que sea cache; una clave sin TTL es una fuga lenta.
- Monitoriza `used_memory`, `evicted_keys`, `keyspace_hits` y `keyspace_misses`.
- Alerta si `evicted_keys` crece de forma sostenida o si el hit rate cae.
- Revisa `--bigkeys` periódicamente y pon límites a las estructuras que crecen sin control.
- Prueba el comportamiento al llenar el cache en un entorno desechable, no en producción.

---

## 🚫 Qué no hacer

- Ejecutar `FLUSHALL` en producción para “liberar memoria”: borras datos y puedes tumbar el cache de todos.
- Poner `maxmemory 0` (sin límite) en un host compartido: Redis puede consumir toda la RAM.
- Usar `allkeys-random` sin entender el impacto: expulsa claves calientes al azar.
- Ignorar las claves sin TTL: son las que hacen crecer el dataset sin control.
- Usar Redis como única fuente de verdad de datos que no puedes perder.
- Aumentar memoria sin revisar qué claves ocupan el espacio.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — qué pasa cuando la demanda supera la capacidad.
- [Stateful vs stateless](/learning-sys-admin-guides-web/concepts/stateful-vs-stateless/) — cache frente a fuente de verdad.
- [Docker](/learning-sys-admin-guides-web/guides/docker/) — límites de recursos y volúmenes.
