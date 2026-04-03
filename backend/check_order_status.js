const Database = require('better-sqlite3');
const db = new Database('partnerza.db');

// Check order 4 status
const order = db.prepare('SELECT id, status, supplier_id FROM orders WHERE id = ?').get(4);
console.log('Order 4:', order);

// Check all orders with their statuses
const orders = db.prepare('SELECT id, status, supplier_id FROM orders ORDER BY id').all();
console.log('\nAll orders:');
orders.forEach(o => {
  console.log(`ID: ${o.id}, Status: ${o.status}, Supplier: ${o.supplier_id}`);
});

db.close();
