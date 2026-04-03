const db = require('./db');
const fs = require('fs');
const path = require('path');

// Check all product images and report missing files
const checkImages = db.prepare(`
  SELECT pi.id, pi.product_id, pi.filename, p.name as product_name
  FROM product_images pi
  JOIN products p ON pi.product_id = p.id
  ORDER BY pi.product_id
`).all();

const uploadsDir = path.join(__dirname, 'uploads');
let missingCount = 0;
let missingFiles = [];

console.log(`\nChecking ${checkImages.length} product images...\n`);

for (const img of checkImages) {
  const filePath = path.join(uploadsDir, img.filename);
  const exists = fs.existsSync(filePath);
  
  if (!exists) {
    missingCount++;
    missingFiles.push({
      image_id: img.id,
      product_id: img.product_id,
      product_name: img.product_name,
      filename: img.filename
    });
    console.log(`❌ MISSING: Product ${img.product_id} (${img.product_name}) - File: ${img.filename}`);
  }
}

console.log(`\n========================================`);
console.log(`Total images checked: ${checkImages.length}`);
console.log(`Missing files: ${missingCount}`);
console.log(`========================================\n`);

if (missingCount > 0) {
  console.log('Missing files by product:');
  const byProduct = {};
  for (const m of missingFiles) {
    if (!byProduct[m.product_id]) {
      byProduct[m.product_id] = { name: m.product_name, files: [] };
    }
    byProduct[m.product_id].files.push(m.filename);
  }
  
  for (const [pid, data] of Object.entries(byProduct)) {
    console.log(`\nProduct #${pid}: ${data.name}`);
    data.files.forEach(f => console.log(`  - ${f}`));
  }
  
  // Clean up database records for missing files
  console.log(`\n\nWould you like to clean up ${missingCount} orphaned database records?`);
  console.log('Run: node cleanup_images.js --fix to remove them');
  
  if (process.argv.includes('--fix')) {
    console.log('\nRemoving orphaned records...');
    const deleteStmt = db.prepare('DELETE FROM product_images WHERE id = ?');
    for (const m of missingFiles) {
      deleteStmt.run(m.image_id);
      console.log(`  Deleted record ${m.image_id}`);
    }
    console.log('Done!');
  }
}

// Also check for orphaned files (files in uploads not in database)
console.log(`\n\nChecking for orphaned files in uploads folder...`);
const uploadFiles = fs.readdirSync(uploadsDir);
const dbFiles = new Set(checkImages.map(img => img.filename));

let orphanedCount = 0;
for (const file of uploadFiles) {
  if (!dbFiles.has(file) && !file.startsWith('.')) {
    orphanedCount++;
    console.log(`⚠️  ORPHANED: ${file} (not in database)`);
  }
}

console.log(`\nOrphaned files: ${orphanedCount}`);
console.log(`\nDone!`);
