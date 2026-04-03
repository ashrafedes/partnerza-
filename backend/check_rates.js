const db = require('./db');

console.log('=== Shipping Rates Check ===\n');

// Check all shipping rates
const allRates = db.prepare('SELECT * FROM shipping_rates LIMIT 10').all();
console.log('Sample shipping rates:');
console.table(allRates);

// Check rates for Egypt specifically
const egyptRates = db.prepare("SELECT * FROM shipping_rates WHERE country = 'Egypt' LIMIT 5").all();
console.log('\nRates for Egypt:');
console.table(egyptRates);

// Check count of rates by country
const countryCounts = db.prepare('SELECT country, COUNT(*) as count FROM shipping_rates GROUP BY country').all();
console.log('\nRates by country:');
console.table(countryCounts);

// Check if rates have supplier_id NULL vs set
const nullCount = db.prepare('SELECT COUNT(*) as count FROM shipping_rates WHERE supplier_id IS NULL').get();
const setCount = db.prepare('SELECT COUNT(*) as count FROM shipping_rates WHERE supplier_id IS NOT NULL').get();
console.log('\nSupplier ID status:');
console.log(`NULL supplier_id: ${nullCount.count}`);
console.log(`Set supplier_id: ${setCount.count}`);
