const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const dbPath = path.join(__dirname, 'db.sqlite');

async function checkStructure() {
  const SQL = await initSqlJs();
  
  const buffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(buffer);
  
  try {
    // Check products table structure
    const stmt = db.prepare(`
      PRAGMA table_info(products)
    `);
    const productsSchema = [];
    while (stmt.step()) {
      productsSchema.push(stmt.getAsObject());
    }
    stmt.free();
    
    console.log('Products table structure:');
    productsSchema.forEach(col => {
      console.log(`- ${col.name}: ${col.type} (nullable: ${!col.notnull})`);
    });
    
    // Check if main_image column exists
    const hasMainImage = productsSchema.some(col => col.name === 'main_image');
    console.log(`\nHas main_image column: ${hasMainImage}`);
    
    if (!hasMainImage) {
      console.log('\nAdding main_image column...');
      db.run('ALTER TABLE products ADD COLUMN main_image TEXT');
      console.log('main_image column added successfully!');
    }
    
    // Save the database
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    db.close();
  }
}

checkStructure();
