const Database = require('better-sqlite3');
const db = new Database('partnerza.db');

// Check all products
const products = db.prepare(`
  SELECT p.*, u.name as supplier_name, COUNT(pi.id) as image_count
  FROM products p
  LEFT JOIN users u ON p.supplier_id = u.id
  LEFT JOIN product_images pi ON p.id = pi.product_id
  GROUP BY p.id
  ORDER BY p.created_at DESC
`).all();

console.log(`Found ${products.length} products:`);
products.forEach(p => {
  console.log(`\nProduct ID: ${p.id}`);
  console.log(`Name: ${p.name}`);
  console.log(`Supplier: ${p.supplier_name} (${p.supplier_id})`);
  console.log(`Status: ${p.status}`);
  console.log(`Price: ${p.price}`);
  console.log(`Images: ${p.image_count}`);
  console.log(`Main Image: ${p.main_image}`);
});

// Check product images
const images = db.prepare(`
  SELECT pi.*, p.name as product_name
  FROM product_images pi
  JOIN products p ON pi.product_id = p.id
  ORDER BY pi.product_id, pi.sort_order
`).all();

console.log(`\n\nFound ${images.length} product images:`);
images.forEach(img => {
  console.log(`Product: ${img.product_name} - Image: ${img.filename} (Order: ${img.sort_order})`);
});

db.close();
