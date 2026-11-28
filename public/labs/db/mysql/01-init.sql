SET SESSION cte_max_recursion_depth = 600000;

CREATE TABLE orders (
  id             BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  customer_email VARCHAR(255) NOT NULL,
  status         VARCHAR(20) NOT NULL,
  total          DECIMAL(10,2) NOT NULL,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

INSERT INTO orders (customer_email, status, total, created_at)
WITH RECURSIVE seq (n) AS (
  SELECT 1
  UNION ALL
  SELECT n + 1 FROM seq WHERE n < 500000
)
SELECT
  CONCAT('user', n, '@example.com'),
  ELT(1 + MOD(n, 3), 'pending', 'paid', 'shipped'),
  ROUND(RAND() * 500, 2),
  NOW() - INTERVAL MOD(n, 365) DAY
FROM seq;

CREATE INDEX idx_orders_created_at ON orders (created_at);
