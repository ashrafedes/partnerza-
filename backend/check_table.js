const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, 'db.sqlite');

async function checkTable() {
  const SQL = await initSqlJs();
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  try {
    // Check products table schema
    const schema = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='products'");
    console.log('Products table schema:');
    console.log(schema[0].values[0][0]);
    
    // Check current max ID
    try {
      const maxId = db.exec("SELECT MAX(id) as max_id FROM products");
      console.log('\nCurrent max ID:', maxId.values[0][0]);
    } catch (e) {
      console.log('\nNo products found');
    }
    
    // Check if there are any products
    try {
      const count = db.exec("SELECT COUNT(*) as count FROM products");
      console.log('Total products:', count.values[0][0]);
    } catch (e) {
      console.log('Error counting products');
    }
    
    // Show last few products
    try {
      const products = db.exec("SELECT id, name, supplier_id FROM products ORDER BY id DESC LIMIT 5");
      console.log('\nLast 5 products:');
      products.values.forEach(p => {
        console.log(`ID: ${p[0]}, Name: ${p[1]}, Supplier: ${p[2]}`);
      });
    } catch (e) {
      console.log('No products to show');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
  }
}

checkTable();
