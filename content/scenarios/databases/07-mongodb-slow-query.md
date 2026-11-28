---
title: "🧩 Escenario: consulta lenta en MongoDB — COLLSCAN por falta de índice"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`mongosh`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/mongo/seed.js`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: consulta lenta en MongoDB — COLLSCAN por falta de índice

---

## 🎯 Problema

Una consulta por `customer_email` tarda decenas de milisegundos y examina 200.000 documentos para devolver uno. La colección `orders` solo tiene los índices `_id` y `created_at_1`, así que MongoDB recorre la colección completa con un `COLLSCAN`. Bajo concurrencia, ese trabajo se multiplica, llena la cache y presiona el pool de conexiones.

---

## ⚡ Quick command (SRE)

```bash
./scripts/mongo.sh --quiet --eval '
  const e = db.orders.find({ customer_email: "user199999@example.com" }).explain("executionStats");
  printjson({
    stage: e.queryPlanner.winningPlan.stage,
    docsExamined: e.executionStats.totalDocsExamined,
    nReturned: e.executionStats.nReturned,
    ms: e.executionStats.executionTimeMillis
  });
'
```

---

## ✅ Salida esperada

Sin índice:

- `stage: COLLSCAN`.
- `docsExamined` cercano a 200.000.
- `nReturned: 1`.
- `executionTimeMillis` de decenas de milisegundos en el laboratorio y mucho más con datos reales.
- `db.orders.getIndexes()` no muestra ningún índice sobre `customer_email`.

Con índice:

- El plan raíz puede ser `FETCH`, con `IXSCAN` como `inputStage`.
- `docsExamined` baja a 1 o a un número pequeño.
- La consulta deja de recorrer la colección completa.
- El índice se llama `customer_email_1`.

---

## 🧠 Diagnóstico

MongoDB usa índices B-tree para evitar recorrer todos los documentos. Sin un índice que cubra el filtro, el planner elige `COLLSCAN`: lee cada documento y comprueba la condición.

En `explain("executionStats")` importan tres números:

- **`nReturned`**: documentos que cumplen el filtro.
- **`totalDocsExamined`**: documentos leídos.
- **`totalKeysExamined`**: entradas de índice leídas.

La relación entre examinados y devueltos es la señal: 200.000 examinados para 1 devuelto es un full scan. El tiempo solo empeora cuando la colección crece o el disco está ocupado.

En el laboratorio, `seed.js` crea 200.000 documentos y un índice sobre `created_at`, pero deja `customer_email` sin índice a propósito. La consulta usa el mismo email que el documento `user199999`.

---

## 🛠️ Procedimiento (runbook)

### 1. Reproducir la consulta

```bash
./scripts/break.sh 07
```

El script ejecuta el `explain` y muestra `COLLSCAN` con los documentos examinados.

### 2. Confirmar los índices

```bash
./scripts/mongo.sh --quiet --eval 'printjson(db.orders.getIndexes())'
./scripts/mongo.sh --quiet --eval 'printjson(db.orders.aggregate([{ $indexStats: {} }]).toArray())'
```

`$indexStats` muestra el uso de cada índice. Si `customer_email` no aparece, no hay índice que pueda usar el planner.

### 3. Ver el plan completo

```bash
./scripts/mongo.sh --quiet --eval '
  printjson(db.orders.find({ customer_email: "user199999@example.com" }).explain("executionStats"))
'
```

Si el plan raíz es `FETCH`, mira `inputStage.stage`: ahí aparece el acceso real (`IXSCAN` o `COLLSCAN`).

### 4. Crear el índice

```bash
./scripts/mongo.sh --quiet --eval 'db.orders.createIndex({ customer_email: 1 })'
```

En un replica set, la creación del índice se propaga a los secundarios. En producción, revisa el impacto en escrituras y el espacio en disco antes de crearlo.

### 5. Verificar la mejora

```bash
./scripts/mongo.sh --quiet --eval '
  const e = db.orders.find({ customer_email: "user199999@example.com" }).explain("executionStats");
  printjson({
    root: e.queryPlanner.winningPlan.stage,
    input: e.queryPlanner.winningPlan.inputStage?.stage,
    docsExamined: e.executionStats.totalDocsExamined,
    nReturned: e.executionStats.nReturned
  });
'
```

Criterio: el acceso pasa a `IXSCAN`, `docsExamined` baja a 1 y la consulta deja de ser un full scan.

### 6. Resetear el laboratorio

```bash
./scripts/reset.sh 07
```

El reset elimina `customer_email_1` si existe.

---

## 🧯 Mitigación

1. **Confirma el plan** con `explain` antes de tocar índices.
2. **Crea el índice** sobre el campo del filtro, en el orden que use la consulta.
3. **Revisa el índice compuesto** si el filtro y el orden van juntos: `{ customer_email: 1, created_at: -1 }`.
4. **Mide el coste en escritura**: cada índice adicional encarece inserts y updates.
5. **Si la colección es enorme**, planifica la ventana de creación y vigila el espacio.
6. **Baja el impacto inmediato** limitando la concurrencia o cacheando el resultado mientras se corrige.

---

## ✅ Verificación

- `explain` muestra `IXSCAN` en el acceso.
- `docsExamined` es 1 para el email de prueba.
- `db.orders.getIndexes()` lista `customer_email_1`.
- La latencia baja y se mantiene estable con la misma carga.
- El profiler ya no registra la consulta con 200.000 documentos examinados.

---

## 🎓 Prevención

- Revisa los filtros y `sort` de las consultas nuevas con datos representativos.
- Activa el profiler con un umbral útil:
  ```js
  db.setProfilingLevel(1, { slowms: 100 });
  db.system.profile.find().sort({ ts: -1 }).limit(5);
  ```
- Ordena por `totalDocsExamined`, no solo por tiempo.
- Evita `$where` y expresiones JavaScript en el servidor: no usan índices y consumen CPU.
- Cuidado con `$regex` sin ancla: un `LIKE '%texto%'` de MongoDB tampoco usa el índice.
- Alerta sobre consultas que examinan muchos más documentos de los que devuelven.

---

## 🚫 Qué no hacer

- Crear índices sin mirar el `explain`: puedes no usarlos o encarecer las escrituras.
- Indexar todos los campos “por si acaso”: el coste de escritura y el espacio se acumulan.
- Usar `$where` para filtrar: se ejecuta JavaScript y no aprovecha índices.
- Ignorar `totalDocsExamined` porque el tiempo “a veces” es bajo.
- Reiniciar MongoDB como primera medida: el plan no cambia con un reinicio.
- Crear un índice en producción sin revisar espacio y ventana de mantenimiento.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Consulta lenta en MySQL](/learning-sys-admin-guides-web/scenarios/databases/04-mysql-slow-query/) — el mismo patrón en un motor relacional.
- [Conexiones agotadas en PostgreSQL](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) — qué pasa cuando las consultas lentas retienen conexiones.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — latencia, concurrencia y saturación.
