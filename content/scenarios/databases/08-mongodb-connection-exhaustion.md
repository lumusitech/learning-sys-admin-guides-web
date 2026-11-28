---
title: "🧩 Escenario: MongoDB sin conexiones — maxConns agotado"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`mongosh`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/docker-compose.yml`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: MongoDB sin conexiones — maxConns agotado

---

## 🎯 Problema

La aplicación no puede escribir en MongoDB y recibe `MongoServerSelectionError: connection ... closed` o `MongoNetworkError`. El primario sigue vivo, pero `--maxConns` está agotado por conexiones de replicación y clientes que no se cierran. Las lecturas pueden seguir funcionando si se sirven desde un secundario; las escrituras, que necesitan al primario, fallan.

---

## ⚡ Quick command (SRE)

```bash
./scripts/mongo.sh --quiet --eval 'db.serverStatus().connections'
```

Si el primario ya no acepta conexiones, revisa los logs del contenedor:

```bash
docker compose logs --tail=40 mongo1 | grep -i "too many open connections"
```

---

## ✅ Salida esperada

- `current` pegado a `maxConns` (40 en el laboratorio).
- `available` en 0.
- `rejected` creciendo.
- En el log de `mongod`: `Connection refused because there are too many open connections`.
- Una escritura de la aplicación falla con un error de selección de servidor o de red.
- Una lectura con `readPreference=secondary` puede seguir funcionando: no demuestra que el primario esté sano.

---

## 🧠 Diagnóstico

MongoDB cuenta las conexiones entrantes contra `net.maxIncomingConnections`, que en el laboratorio se configura con `--maxConns 40`. En esa cuenta entran:

1. las conexiones de replicación de los secundarios;
2. los clientes de la aplicación;
3. los `mongosh` de operación;
4. cualquier monitor o exporter.

Cuando el contador llega al límite, el listener rechaza conexiones nuevas. El primario no está caído: está saturado. La diferencia entre lectura y escritura es clave:

- **Lectura** con `readPreference=primary` necesita al primario; con `secondary`/`nearest` puede ir a otro miembro.
- **Escritura** siempre va al primario; si el primario no acepta conexiones, falla.

En el laboratorio, `break.sh 08` lanza 30 clientes `mongosh` contra un límite de 40. Las conexiones internas del replica set ya ocupan parte del presupuesto; los clientes llenan el resto y la escritura de prueba falla.

---

## 🛠️ Procedimiento (runbook)

### 1. Reproducir el incidente

```bash
./scripts/break.sh 08
sleep 5
```

### 2. Confirmar que el primario rechaza conexiones

```bash
docker compose logs --tail=40 mongo1 | grep -i "too many open connections"
```

Si `mongosh` todavía conecta, mira el contador:

```bash
./scripts/mongo.sh --quiet --eval 'db.serverStatus().connections'
```

### 3. Distinguir lectura de escritura

```bash
# Escritura: necesita al primario
./scripts/mongo.sh --quiet --eval '
  db.orders.insertOne({
    _id: "connection-probe",
    customer_email: "probe@example.com",
    status: "pending",
    total: 0,
    created_at: new Date()
  })
'

# Lectura desde secundario: puede seguir funcionando
./scripts/mongo.sh --quiet --eval '
  db.getMongo().setReadPref("secondary");
  print(db.orders.countDocuments());
'
```

La primera orden falla; la segunda puede responder. Eso confirma que el problema es el primario saturado, no la base completa.

### 4. Liberar las conexiones de prueba

```bash
./scripts/reset.sh 08
```

El reset mata los `mongosh` de prueba dentro de `mongo1` y elimina el documento `connection-probe`:

```bash
docker compose exec -T mongo1 pkill -f '[m]ongosh mongodb://'
```

Es una acción de contenedor, no un comando de MongoDB: sirve cuando ya no puedes entrar por el primario.

### 5. Verificar que el primario acepta escrituras

```bash
./scripts/mongo.sh --quiet --eval 'db.orders.insertOne({_id:"health-probe"}); db.orders.deleteOne({_id:"health-probe"}); print("write ok")'
```

---

## 🧯 Mitigación

1. **Libera clientes** que no deberían estar conectados: jobs colgados, sesiones de operación, pools con fugas.
2. **Baja el pool de la aplicación** si `maxPoolSize` es mayor que la capacidad del primario.
3. **Sube `maxConns`** solo si el host tiene RAM y file descriptors suficientes; cada conexión consume recursos.
4. **Reinicia el primario como último recurso**: pierdes conexiones y puedes provocar una elección.
5. **Separa workloads**: reportería o exports no deberían competir con la aplicación por el primario.

En el laboratorio, `./scripts/reset.sh 08` es suficiente. No hace falta reiniciar el nodo.

---

## ✅ Verificación

- `db.serverStatus().connections.current` queda por debajo de `maxConns`.
- `rejected` deja de crecer con la carga normal.
- La escritura de prueba responde.
- La aplicación vuelve a escribir sin `MongoServerSelectionError`.
- Los logs dejan de mostrar `too many open connections`.

---

## 🎓 Prevención

- Dimensiona `maxPoolSize` por instancia y suma todos los pools, jobs y exporters.
- Configura `maxIdleTimeMS` y timeouts de selección para no retener conexiones para siempre.
- Alerta sobre `connections.current / maxConns` y sobre `rejected` creciendo.
- Etiqueta los clientes con `appName` para saber quién consume las conexiones.
- Revisa fugas: una conexión que se abre por request y no se cierra agota cualquier límite.
- Prueba la carga con el pool real, no con un `mongosh` interactivo.

---

## 🚫 Qué no hacer

- Subir `maxConns` a 10.000 sin RAM ni file descriptors: mueves el fallo al sistema operativo.
- Reiniciar el primario como primera acción: cortas a todos los clientes y puedes forzar una elección.
- Concluir que MongoDB está caído porque una lectura funciona: las lecturas pueden ir a un secundario.
- Ignorar las conexiones de replicación al calcular el límite.
- Usar un pool sin máximo o sin timeout de selección.
- Matar procesos `mongod` en lugar de clientes.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Conexiones agotadas en PostgreSQL](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) — el mismo patrón con slots reservados.
- [Consulta lenta en MongoDB](/learning-sys-admin-guides-web/scenarios/databases/07-mongodb-slow-query/) — las consultas lentas también retienen conexiones.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — capacidad, concurrencia y saturación.
