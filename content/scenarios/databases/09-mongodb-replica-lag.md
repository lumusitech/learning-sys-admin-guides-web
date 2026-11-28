---
title: "🧩 Escenario: réplica de MongoDB retrasada o caída"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`mongosh`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/mongo/init.sh`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: réplica de MongoDB retrasada o caída

---

## 🎯 Problema

Un secundario del replica set dejó de responder. Las lecturas configuradas con `readPreference=secondary` fallan o devuelven datos viejos, mientras el primario sigue aceptando escrituras porque conserva la mayoría. `rs.status()` muestra el miembro como `(not reachable/healthy)`. Si el secundario se queda atrás más allá de la ventana del oplog, necesitará un initial sync al volver.

---

## ⚡ Quick command (SRE)

```bash
./scripts/mongo.sh --quiet --eval '
  print(rs.status().members.map((m) => `${m.name}:${m.stateStr}`).join("\n"))
'
```

---

## ✅ Salida esperada

Con el replica set sano:

- `mongo1:27017:PRIMARY`.
- `mongo2:27017:SECONDARY`.
- `mongo3:27017:SECONDARY`.
- `rs.status().ok` es `1`.
- `rs.printSecondaryReplicationInfo()` muestra ambos secundarios con lag bajo.

Con `mongo2` caído:

- `mongo2:27017:(not reachable/healthy)`.
- `mongo1` sigue `PRIMARY` y `mongo3` sigue `SECONDARY`.
- Las escrituras siguen funcionando: quedan 2 de 3 votos.
- Las lecturas con `readPreference=secondary` pueden seguir por `mongo3`, pero las que exigen un secundario concreto fallan.
- Si el secundario se queda atrás más allá de la ventana del oplog, necesitará un initial sync completo.

---

## 🧠 Diagnóstico

Un replica set de MongoDB mantiene un primario y varios secundarios. El primario escribe el oplog; los secundarios lo replican y aplican. La mayoría (2 de 3 en el laboratorio) elige al primario y confirma escrituras con `writeConcern: majority`.

Si un secundario se cae:

1. El primario sigue siendo primario mientras tenga mayoría.
2. Las escrituras con `majority` siguen funcionando con los dos nodos vivos.
3. Las lecturas con `readPreference=secondary` pueden seguir usando el secundario sano.
4. El secundario caído se queda atrás; al volver, intenta recuperar el oplog.

Si el retraso supera la ventana del oplog, el secundario no puede ponerse al día y necesita un **initial sync** completo. Si el primario no tiene mayoría, se degrada y las escrituras fallan.

En el laboratorio, `break.sh 09` detiene `mongo2`; `mongo1` y `mongo3` conservan la mayoría y el servicio sigue escribiendo.

---

## 🛠️ Procedimiento (runbook)

### 1. Reproducir la caída

```bash
./scripts/break.sh 09
sleep 3
```

### 2. Ver el estado del replica set

```bash
./scripts/mongo.sh --quiet --eval '
  printjson(rs.status().members.map((m) => ({
    name: m.name,
    state: m.stateStr,
    health: m.health,
    lag: m.optimeDate
  })))
'
```

`health: 0` o `stateStr: (not reachable/healthy)` confirma que el nodo no responde.

### 3. Confirmar que el primario sigue escribiendo

```bash
./scripts/mongo.sh --quiet --eval '
  db.orders.insertOne({
    _id: "replica-probe",
    customer_email: "probe@example.com",
    status: "pending",
    total: 0,
    created_at: new Date()
  });
  print("write ok");
'
```

### 4. Medir el retraso de los secundarios

```bash
./scripts/mongo.sh --quiet --eval 'rs.printSecondaryReplicationInfo()'
```

La salida muestra el retraso de cada secundario respecto al primario. Si `mongo2` no aparece, está caído; si aparece con un retraso enorme, revisa el oplog y el disco.

### 5. Leer desde el secundario sano

```bash
docker compose exec -T mongo3 mongosh "mongodb://mongo3:27017/app?directConnection=true" \
  --quiet --eval 'print(db.orders.countDocuments())'
```

La lectura directa al secundario debe devolver 200.000. Si devuelve menos, el secundario está retrasado.

### 6. Recuperar el nodo

```bash
./scripts/reset.sh 09
```

El reset arranca `mongo2` y espera a que vuelva como `SECONDARY`. Si el nodo no puede alcanzar el oplog, necesitará un initial sync; en el laboratorio, el volumen conserva los datos y el retraso es pequeño.

---

## 🧯 Mitigación

1. **Comprueba el nodo**: disco, memoria, red y logs de `mongod` antes de reiniciar.
2. **Reinicia el secundario** si el proceso murió; el replica set lo reincorpora.
3. **Si el retraso es grande**, evalúa un initial sync: borra el `dbPath` del secundario y deja que se resincronice.
4. **No fuerces una reconfiguración** del replica set sin mayoría; puedes crear un split-brain.
5. **Ajusta la lectura**: si la aplicación no tolera datos viejos, usa `readPreference=primary` mientras se recupera.
6. **Vigila el oplog**: un secundario caído mucho tiempo puede quedar fuera de la ventana y necesitar un resync completo.

---

## ✅ Verificación

- `rs.status()` muestra `mongo2` como `SECONDARY`.
- `rs.printSecondaryReplicationInfo()` muestra un lag bajo y estable.
- `db.orders.countDocuments()` coincide en primario y secundario.
- Las escrituras con `writeConcern: majority` funcionan.
- Las lecturas con `readPreference=secondary` devuelven datos actuales.
- El secundario recupera el lag y la ventana del oplog sigue sana.

---

## 🎓 Prevención

- Alerta si un miembro del replica set deja de estar `PRIMARY`/`SECONDARY` o si `health` es 0.
- Monitoriza el lag de los secundarios y la ventana del oplog.
- Usa `writeConcern: { w: "majority" }` para datos que no puedes perder.
- Revisa el disco de cada nodo: un secundario sin espacio se cae y no puede resincronizar.
- Prueba failover y recuperación de un secundario en un entorno desechable.
- Documenta qué lecturas toleran datos viejos y cuáles deben ir al primario.

---

## 🚫 Qué no hacer

- Borrar el oplog o los archivos de `local` a mano para “arreglar” el retraso.
- Forzar `rs.reconfig()` sin mayoría: puedes dividir el replica set.
- Leer de un secundario sin tolerancia a la staleness y asumir que es el primario.
- Ignorar un secundario caído “porque el primario funciona”: reduces la redundancia y el margen de fallo.
- Reiniciar todos los nodos a la vez: pierdes la mayoría y el servicio.
- Promocionar un secundario manualmente sin coordinación.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Réplica de PostgreSQL retrasada](/learning-sys-admin-guides-web/scenarios/databases/02-postgres-replication-lag/) — el mismo problema en otro motor.
- [Consulta lenta en MongoDB](/learning-sys-admin-guides-web/scenarios/databases/07-mongodb-slow-query/) — el retraso también se nota en las lecturas.
- [Stateful vs stateless](/learning-sys-admin-guides-web/concepts/stateful-vs-stateless/) — por qué una réplica no es un contenedor desechable.
