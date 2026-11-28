-- Rol de aplicación sin privilegios de superusuario.
CREATE ROLE app LOGIN PASSWORD 'app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
GRANT pg_monitor TO app;
GRANT CONNECT, TEMPORARY ON DATABASE app TO app;
ALTER SCHEMA public OWNER TO app;

-- Usuario de replicación del laboratorio.
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'replicator';

-- Tabla base para los escenarios de bloqueos, conexiones y restore.
CREATE TABLE orders (
  id         integer PRIMARY KEY,
  customer   text NOT NULL,
  status     text NOT NULL,
  total      numeric(10,2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO orders (id, customer, status, total, created_at)
SELECT
  n,
  'cliente-' || n,
  (ARRAY['pending', 'paid', 'shipped'])[1 + (n % 3)],
  round((random() * 500)::numeric, 2),
  now() - (n % 365) * interval '1 day'
FROM generate_series(1, 5000) AS n;

ALTER TABLE orders OWNER TO app;
CREATE INDEX idx_orders_created_at ON orders (created_at);
