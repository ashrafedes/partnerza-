const db = require('./db');

console.log('=== Seeding Egypt Shipping Rates ===\n');

// Egypt cities with shipping costs from the EGYPT_CITIES array
const EGYPT_CITIES = [
  { city: 'Cairo', cost: 25 },
  { city: 'Alexandria', cost: 30 },
  { city: 'Giza', cost: 25 },
  { city: 'Shubra El Kheima', cost: 30 },
  { city: 'Port Said', cost: 35 },
  { city: 'Suez', cost: 35 },
  { city: 'Luxor', cost: 40 },
  { city: 'al-Mansura', cost: 40 },
  { city: 'El-Mahalla El-Kubra', cost: 40 },
  { city: 'Tanta', cost: 35 },
  { city: 'Asyut', cost: 45 },
  { city: 'Ismailia', cost: 35 },
  { city: 'Fayyum', cost: 40 },
  { city: 'Zagazig', cost: 35 },
  { city: 'Aswan', cost: 50 },
  { city: 'Damietta', cost: 35 },
  { city: 'Damanhur', cost: 35 },
  { city: 'al-Minya', cost: 45 },
  { city: 'Beni Suef', cost: 40 },
  { city: 'Qena', cost: 45 },
  { city: 'Sohag', cost: 45 },
  { city: 'Hurghada', cost: 50 },
  { city: '6th of October City', cost: 30 },
  { city: 'Shibin El Kom', cost: 40 },
  { city: 'Banha', cost: 30 },
  { city: 'Kafr el-Sheikh', cost: 40 },
  { city: 'Arish', cost: 60 },
  { city: 'Mallawi', cost: 45 },
  { city: 'Bilbeis', cost: 35 },
  { city: 'Marsa Matruh', cost: 70 }
];

const insertShipping = db.prepare('INSERT OR IGNORE INTO shipping_rates (city, country, cost, is_active) VALUES (?, ?, ?, 1)');

let inserted = 0;
for (const cityData of EGYPT_CITIES) {
  try {
    insertShipping.run(cityData.city, 'Egypt', cityData.cost);
    inserted++;
  } catch (e) {
    console.log(`Skipped ${cityData.city}: ${e.message}`);
  }
}

console.log(`Inserted ${inserted} shipping rates for Egypt`);

// Verify
const count = db.prepare('SELECT COUNT(*) as count FROM shipping_rates').get();
console.log(`\nTotal shipping rates in database: ${count.count}`);

const sample = db.prepare('SELECT * FROM shipping_rates LIMIT 5').all();
console.log('\nSample rates:');
console.table(sample);
