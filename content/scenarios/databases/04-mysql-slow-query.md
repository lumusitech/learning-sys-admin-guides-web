---
title: "🧩 Escenario: consulta lenta en MySQL por falta de índice"
level: "Intermedio"
section: "scenarios"
meta:
  - label: "Dominio"
    value: "databases"
  - label: "Herramientas"
    value: "`mysql`, `docker compose`"
  - label: "Archivos"
    value: "`labs/db/mysql/01-init.sql`"
  - label: "Ver laboratorio"
    links:
      - id: "labs/databases"
        label: "Laboratorio de bases de datos"
---

# 🧩 Escenario: consulta lenta en MySQL por falta de índice

---

## 🎯 Problema

Una consulta que busca por `customer_email` tarda más de lo aceptable y aparece en el slow log con cientos de miles de filas examinadas. La tabla tiene 500.000 filas, pero no hay índice sobre esa columna. La aplicación funciona, solo que lenta; el riesgo es que bajo concurrencia el tiempo se multiplique y agote el pool de conexiones.

---

## ⚡ Quick command (SRE)

```bash
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_email = 'user499999@example.com' ORDER BY total DESC LIMIT 10;"
```

---

## ✅ Salida esperada

Sin índice:

- `EXPLAIN` muestra `type: ALL`, `key: NULL` y `rows` cercano a 500.000.
- `Extra` incluye `Using where` y `Using filesort`.
- `EXPLAIN ANALYZE` reporta un table scan y un tiempo alto.
- El slow log registra `Rows_examined` cercano a 500.000 para devolver una fila.

Con índice:

- `type: ref`, `key: idx_orders_customer_email`.
- `rows` baja a 1 o a un número pequeño.
- El table scan desaparece; el tiempo cae a milisegundos.
- `Rows_examined` en el slow log baja en la misma proporción.

---

## 🧠 Diagnóstico

MySQL elige un plan de ejecución según los índices disponibles y las estadísticas de la tabla. Si no hay un índice que cubra el `WHERE`, la única opción es recorrer la tabla completa: `type: ALL`.

La consulta del laboratorio busca una igualdad:

```sql
SELECT * FROM orders
WHERE customer_email = 'user499999@example.com'
ORDER BY total DESC
LIMIT 10;
```

Sin índice, MySQL:

1. lee las 500.000 filas de `orders`;
2. descarta las que no cumplen la igualdad;
3. ordena el resultado por `total`;
4. devuelve 10 filas.

El `LIMIT 10` no salva el trabajo: hay que leer y ordenar antes de saber cuáles son las 10 primeras.

Un índice sobre `customer_email` permite localizar directamente las filas que cumplen la igualdad. El `ORDER BY total` sigue necesitando un sort pequeño (una fila), pero el coste principal desaparece.

---

## 🛠️ Procedimiento (runbook)

### 1. Reproducir la consulta lenta

```bash
./scripts/break.sh 04
```

El script ejecuta `EXPLAIN ANALYZE` contra MySQL y deja la consulta en el slow log.

### 2. Confirmar el slow log

```bash
docker compose exec -T mysql sh -c "tail -n 40 /var/lib/mysql/slow.log"
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "SHOW VARIABLES LIKE 'slow_query_log%'; SELECT @@long_query_time;"
```

Busca `Query_time`, `Rows_sent` y `Rows_examined`. La relación entre filas examinadas y filas devueltas es la señal: examinar 500.000 para devolver 1 es un full scan.

### 3. Ver el plan clásico

```bash
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "EXPLAIN SELECT * FROM orders WHERE customer_email = 'user499999@example.com' ORDER BY total DESC LIMIT 10\G"
```

Lee, en este orden:

- `type`: `ALL` es full scan; `ref` o `eq_ref` usan índice.
- `possible_keys` y `key`: si `key` es `NULL`, no se usó ningún índice.
- `rows`: estimación de filas que MySQL cree que va a leer.
- `Extra`: `Using filesort`, `Using temporary`, `Using where`.

### 4. Ver el plan con detalle

```bash
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "EXPLAIN FORMAT=JSON SELECT * FROM orders WHERE customer_email = 'user499999@example.com' ORDER BY total DESC LIMIT 10\G"
```

El JSON incluye el coste estimado y las condiciones aplicadas. No necesitas memorizarlo: sirve para comparar antes y después.

### 5. Crear el índice

```bash
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "CREATE INDEX idx_orders_customer_email ON orders (customer_email); ANALYZE TABLE orders;"
```

En MySQL 8, InnoDB permite crear el índice online para muchas tablas; aun así, en producción revisa el impacto en escrituras y el espacio en disco.

### 6. Verificar la mejora

```bash
docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "EXPLAIN SELECT * FROM orders WHERE customer_email = 'user499999@example.com' ORDER BY total DESC LIMIT 10\G"

docker compose exec -T -e MYSQL_PWD=app mysql mysql -uapp app -e \
  "EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_email = 'user499999@example.com' ORDER BY total DESC LIMIT 10;"
```

### 7. Resetear el laboratorio

```bash
./scripts/reset.sh 04
```

El reset elimina `idx_orders_customer_email` si existe, para que puedas repetir el ejercicio.

---

## 🧯 Mitigación

1. **Confirma el plan** antes de crear el índice; no indexes por intuición.
2. **Crea el índice** sobre la columna del `WHERE`, no sobre todas las columnas de la consulta.
3. **Ejecuta `ANALYZE TABLE`** para actualizar estadísticas; el optimizador decide con ellas.
4. **Revisa el `ORDER BY`**: si es parte del dolor, valora un índice compuesto `(customer_email, total)`.
5. **Si no puedes crear el índice en caliente**, usa una ventana de mantenimiento o una réplica; en MySQL 8 muchas operaciones son online, pero no todas.
6. **Baja el riesgo inmediato** limitando la concurrencia o subiendo timeouts solo como parche temporal.

---

## ✅ Verificación

- `EXPLAIN` muestra `type: ref` y `key: idx_orders_customer_email`.
- `rows` es 1 para el email de prueba.
- `EXPLAIN ANALYZE` ya no reporta table scan.
- El slow log deja de registrar la consulta con 500.000 filas examinadas.
- La aplicación responde dentro del presupuesto de latencia.

---

## 🎓 Prevención

- Revisa los `WHERE`, `JOIN` y `ORDER BY` de las consultas nuevas y comprueba el plan con datos representativos.
- Activa el slow log con un umbral útil y revísalo periódicamente; no lo dejes como un archivo que nadie mira.
- Usa `performance_schema` para ordenar las consultas por filas examinadas, no solo por tiempo.
- Evita funciones sobre columnas indexadas (`WHERE DATE(created_at) = ...`) y comodines iniciales (`LIKE '%texto'`): impiden usar el índice.
- Mide el coste en escritura de cada índice; un índice de más también es deuda.
- Alerta sobre `Rows_examined` alto y sobre consultas que superan el presupuesto de latencia.

---

## 🚫 Qué no hacer

- Crear un índice sin mirar el `EXPLAIN`: puedes no usarlo o empeorar las escrituras.
- Indexar una columna de baja cardinalidad y esperar que resuelva todo.
- Usar `LIKE '%texto'` y confiar en que el índice se use: el comodín inicial lo impide.
- Ignorar `Rows_examined`: un tiempo bajo con muchas filas examinadas se degrada con la carga.
- Reiniciar MySQL como primera medida: el plan no cambia con un reinicio.
- Copiar el índice de otro entorno sin comprobar la selectividad real.

---

## 🔗 Referencias internas

- [Laboratorio de bases de datos](/learning-sys-admin-guides-web/labs/databases/) — setup, break y reset.
- [Docker](/learning-sys-admin-guides-web/guides/docker/) — ejecutar clientes y revisar volúmenes.
- [Conexiones agotadas](/learning-sys-admin-guides-web/scenarios/databases/01-postgres-connection-exhaustion/) — qué pasa cuando las consultas lentas retienen conexiones.
- [Backpressure](/learning-sys-admin-guides-web/concepts/backpressure/) — latencia, concurrencia y saturación.
