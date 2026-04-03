const Database = require('better-sqlite3');
const db = new Database('partnerza.db');

console.log('Updating order structure to support multiple products per order...');

try {
  // Create order_items table
  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id                          INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id                    INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id                  INTEGER NOT NULL REFERENCES products(id),
      quantity                    INTEGER NOT NULL DEFAULT 1,
      unit_price                  REAL NOT NULL,
      total_amount                REAL NOT NULL,
      marketer_commission_rate    REAL NOT NULL,
      marketer_commission_amount  REAL,
      platform_fee_rate           REAL NOT NULL,
      platform_fee_amount         REAL,
      supplier_id                 TEXT NOT NULL REFERENCES users(id)
    )
  `);

  // Check if we need to migrate existing orders
  const existingOrders = db.prepare('SELECT * FROM orders').all();
  console.log(`Found ${existingOrders.length} existing orders to migrate`);

  // Migrate each order to order_items
  for (const order of existingOrders) {
    // Check if already migrated
    const existingItem = db.prepare('SELECT id FROM order_items WHERE order_id = ?').get(order.id);
    
    if (!existingItem) {
      db.run(`
        INSERT INTO order_items (
          order_id, product_id, quantity, unit_price, total_amount,
          marketer_commission_rate, marketer_commission_amount,
          platform_fee_rate, platform_fee_amount, supplier_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        order.id,
        order.product_id,
        order.quantity,
        order.unit_price,
        order.total_amount,
        order.marketer_commission_rate,
        order.marketer_commission_amount,
        order.platform_fee_rate,
        order.platform_fee_amount,
        order.supplier_id
      ]);
      
      console.log(`Migrated order ${order.id} to order_items`);
    }
  }

  // Remove old columns from orders table (we'll keep them for now for backward compatibility)
  console.log('Order structure updated successfully!');
  
  // Show current structure
  const orders = db.prepare('SELECT * FROM orders LIMIT 5').all();
  console.log('\nSample orders:');
  orders.forEach(o => {
    const items = db.prepare('SELECT COUNT(*) as count FROM order_items WHERE order_id = ?').get(o.id);
    console.log(`Order ${o.id}: ${items.count} items`);
  });

} catch (error) {
  console.error('Error updating order structure:', error);
} finally {
  db.close();
}
