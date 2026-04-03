const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, 'db.sqlite');

async function migrate() {
  const SQL = await initSqlJs();
  
  // Load existing database
  let buffer;
  try {
    buffer = fs.readFileSync(dbPath);
  } catch (error) {
    console.log('No existing database found');
    return;
  }
  
  const db = new SQL.Database(buffer);
  
  try {
    // Check if order_items table exists
    const tableExists = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='order_items'
    `).get();
    
    if (!tableExists) {
      console.log('Creating order_items table...');
      db.run(`
        CREATE TABLE order_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          product_id INTEGER NOT NULL REFERENCES products(id),
          quantity INTEGER NOT NULL DEFAULT 1,
          unit_price REAL NOT NULL,
          total_amount REAL NOT NULL,
          marketer_commission_rate REAL NOT NULL,
          marketer_commission_amount REAL,
          platform_fee_rate REAL NOT NULL,
          platform_fee_amount REAL,
          supplier_id TEXT NOT NULL REFERENCES users(id),
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
    }
    
    // Check if we need to migrate old orders
    const oldOrders = db.prepare(`
      SELECT * FROM orders 
      WHERE product_id IS NOT NULL 
      AND id NOT IN (SELECT DISTINCT order_id FROM order_items)
    `).all();
    
    console.log(`Found ${oldOrders.length} orders to migrate`);
    
    for (const order of oldOrders) {
      // Insert into order_items
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
      
      console.log(`Migrated order ${order.id}`);
    }
    
    // Save the database
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    
    console.log('Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration error:', error);
  } finally {
    db.close();
  }
}

migrate();
