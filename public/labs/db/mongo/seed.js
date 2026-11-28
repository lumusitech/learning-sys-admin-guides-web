const statuses = ["pending", "paid", "shipped"];

if (db.orders.countDocuments() === 0) {
  let batch = [];

  for (let i = 1; i <= 200000; i++) {
    batch.push({
      customer_email: `user${i}@example.com`,
      status: statuses[i % statuses.length],
      total: Math.round(Math.random() * 50000) / 100,
      created_at: new Date(Date.now() - (i % 365) * 86400000),
    });

    if (batch.length === 1000) {
      db.orders.insertMany(batch);
      batch = [];
    }
  }

  if (batch.length > 0) {
    db.orders.insertMany(batch);
  }

  print(`Insertados ${db.orders.countDocuments()} documentos`);
} else {
  print(`orders ya tiene ${db.orders.countDocuments()} documentos`);
}

const indexNames = db.orders.getIndexes().map((index) => index.name);
if (!indexNames.includes("created_at_1")) {
  db.orders.createIndex({ created_at: 1 });
  print("Índice created_at_1 creado");
}
