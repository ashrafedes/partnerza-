const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'db.sqlite');

// Check if using better-sqlite3
try {
  const db = new Database(dbPath);
  
  console.log('Testing insert with better-sqlite3...');
  
  // Test insert
  const stmt = db.prepare(`
    INSERT INTO products (supplier_id, name, description, price, marketer_commission_rate, category)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run('test-supplier', 'Test Product', 'Test Description', 100, 10, 'Test Category');
  
  console.log('Insert result:', result);
  console.log('lastInsertRowid:', result.lastInsertRowid);
  
  // Clean up
  db.prepare('DELETE FROM products WHERE name = ?').run('Test Product');
  
  db.close();
} catch (error) {
  console.log('better-sqlite3 not available, using sql.js');
  
  // Test with sql.js
  const initSqlJs = require('sql.js');
  
  async function test() {
    const SQL = await initSqlJs();
    const buffer = fs.readFileSync(dbPath);
    const db = new SQL.Database(buffer);
    
    console.log('Testing insert with sql.js...');
    
    // Test insert
    db.run(`
      INSERT INTO products (supplier_id, name, description, price, marketer_commission_rate, category)
      VALUES (?, ?, ?, ?, ?, ?)
    `, ['test-supplier-2', 'Test Product 2', 'Test Description 2', 200, 20, 'Test Category 2']);
    
    const result = db.exec("SELECT last_insert_rowid()");
    console.log('last_insert_rowid result:', result);
    
    // Clean up
    db.run('DELETE FROM products WHERE name = ?', ['Test Product 2']);
    
    // Save
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    
    db.close();
  }
  
  test();
}
