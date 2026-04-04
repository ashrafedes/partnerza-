const Database = require('better-sqlite3');
const path = require('path');

// Use mounted disk path if available (Render), otherwise use local path
const dbPath = process.env.RENDER_DISK_PATH 
  ? path.join(process.env.RENDER_DISK_PATH, 'db.sqlite')
  : path.join(__dirname, 'data', 'db.sqlite');

// Ensure data directory exists
const fs = require('fs');
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

console.log('SQLite database path:', dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    email                       TEXT NOT NULL UNIQUE,
    phone                       TEXT,
    whatsapp                    TEXT,
    role                        TEXT NOT NULL DEFAULT 'marketer',
    status                      TEXT NOT NULL DEFAULT 'active',
    balance                     REAL NOT NULL DEFAULT 0.0,
    platform_fee_rate_override  REAL,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id                 TEXT NOT NULL REFERENCES users(id),
    name                        TEXT NOT NULL,
    description                 TEXT,
    price                       REAL NOT NULL,
    marketer_commission_rate    REAL NOT NULL,
    platform_fee_rate_override  REAL,
    category                    TEXT,
    main_image                  TEXT,
    status                      TEXT NOT NULL DEFAULT 'active',
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS product_specs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    spec_key    TEXT NOT NULL,
    spec_value  TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS product_images (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id                          INTEGER PRIMARY KEY AUTOINCREMENT,
    marketer_id                 TEXT NOT NULL REFERENCES users(id),
    client_name                 TEXT NOT NULL,
    client_phone                TEXT NOT NULL,
    client_address              TEXT,
    client_notes                TEXT,
    status                      TEXT NOT NULL DEFAULT 'pending',
    supplier_note               TEXT,
    total_amount                REAL NOT NULL DEFAULT 0,
    total_commission            REAL NOT NULL DEFAULT 0,
    total_platform_fee          REAL NOT NULL DEFAULT 0,
    created_at                  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at                  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
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
    supplier_id                 TEXT NOT NULL REFERENCES users(id),
    created_at                  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS commissions (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id     INTEGER NOT NULL REFERENCES orders(id),
    order_item_id INTEGER REFERENCES order_items(id),
    product_id   INTEGER REFERENCES products(id),
    marketer_id  TEXT NOT NULL REFERENCES users(id),
    amount       REAL NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    note         TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS withdrawals (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    marketer_id  TEXT NOT NULL REFERENCES users(id),
    amount       REAL NOT NULL,
    bank_name    TEXT NOT NULL,
    iban         TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'pending',
    admin_note   TEXT,
    created_at   TEXT NOT NULL DEFAULT (datetime('now')),
    processed_at TEXT
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS platform_settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS payment_methods (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    marketer_id             TEXT NOT NULL REFERENCES users(id),
    method_type             TEXT NOT NULL,
    account_name            TEXT NOT NULL,
    account_number_or_iban  TEXT NOT NULL,
    bank_name               TEXT,
    is_default              INTEGER NOT NULL DEFAULT 0,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_payments (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    supplier_id             TEXT NOT NULL REFERENCES users(id),
    total_amount            REAL NOT NULL,
    payment_method          TEXT NOT NULL DEFAULT 'vodafone_cash',
    transaction_reference   TEXT NOT NULL,
    payment_date            TEXT NOT NULL,
    notes                   TEXT,
    status                  TEXT NOT NULL DEFAULT 'pending_verification',
    verification_notes      TEXT,
    verified_by             TEXT REFERENCES users(id),
    verified_at             TEXT,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS supplier_payment_orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id  INTEGER NOT NULL REFERENCES supplier_payments(id) ON DELETE CASCADE,
    order_id    INTEGER NOT NULL REFERENCES orders(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// Add missing columns to existing tables
try {
  db.exec(`ALTER TABLE commissions ADD COLUMN product_id INTEGER REFERENCES products(id)`);
} catch (e) {
  // Column already exists — safe to ignore
}

try {
  db.exec(`ALTER TABLE commissions ADD COLUMN order_item_id INTEGER REFERENCES order_items(id)`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add payment_method_id column to withdrawals if not exists
try {
  db.exec(`ALTER TABLE withdrawals ADD COLUMN payment_method_id INTEGER REFERENCES payment_methods(id)`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add transportation_cost column to orders
try {
  db.exec(`ALTER TABLE orders ADD COLUMN transportation_cost REAL DEFAULT 0`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add payment_status column to orders for supplier payment tracking
try {
  db.exec(`ALTER TABLE orders ADD COLUMN payment_status TEXT DEFAULT 'pending'`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Seed default platform fee rate
db.exec(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('default_platform_fee_rate', '5')`);
db.exec(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('min_withdrawal_amount', '100')`);
db.exec(`INSERT OR IGNORE INTO platform_settings (key, value) VALUES ('currency', 'SAR')`);

// Add receipt_url column to withdrawals for payment proof
try {
  db.exec(`ALTER TABLE withdrawals ADD COLUMN receipt_url TEXT`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Create shipping_rates table for city-based pricing with proper unique constraint
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping_rates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      city        TEXT NOT NULL,
      country     TEXT DEFAULT 'Egypt',
      cost        REAL NOT NULL DEFAULT 0,
      supplier_id TEXT REFERENCES users(id),
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(supplier_id, city, country)
    )
  `);
} catch (e) {
  // Table may already exist with old schema, try to migrate
  console.log('Shipping rates table may already exist');
}

// Migrate old shipping_rates table if needed (city was UNIQUE, should be composite)
try {
  const hasOldUnique = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='shipping_rates'`).get();
  if (hasOldUnique && hasOldUnique.sql.includes('city') && hasOldUnique.sql.includes('UNIQUE') && !hasOldUnique.sql.includes('supplier_id')) {
    console.log('Migrating shipping_rates table to new schema...');
    db.exec(`
      CREATE TABLE shipping_rates_new (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        city        TEXT NOT NULL,
        country     TEXT DEFAULT 'Egypt',
        cost        REAL NOT NULL DEFAULT 0,
        supplier_id TEXT REFERENCES users(id),
        is_active   INTEGER NOT NULL DEFAULT 1,
        created_at  TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(supplier_id, city, country)
      )
    `);
    db.exec(`INSERT INTO shipping_rates_new (id, city, cost, is_active, created_at, updated_at) SELECT id, city, cost, is_active, created_at, updated_at FROM shipping_rates`);
    db.exec(`DROP TABLE shipping_rates`);
    db.exec(`ALTER TABLE shipping_rates_new RENAME TO shipping_rates`);
    console.log('Shipping rates table migrated successfully');
  }
} catch (e) {
  console.log('Shipping rates migration check:', e.message);
}

// Add city column to orders table
try {
  db.exec(`ALTER TABLE orders ADD COLUMN city TEXT`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Rename transportation_cost to shipment_cost if needed, or ensure it exists
try {
  db.exec(`ALTER TABLE orders ADD COLUMN shipment_cost REAL DEFAULT 0`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add receipt_url column to supplier_payments table
try {
  db.exec(`ALTER TABLE supplier_payments ADD COLUMN receipt_url TEXT`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add country field to users table for marketers
try {
  db.exec(`ALTER TABLE users ADD COLUMN country TEXT DEFAULT 'Egypt'`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Create cities table to store cities by country
db.exec(`
  CREATE TABLE IF NOT EXISTS cities (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    country     TEXT NOT NULL,
    city        TEXT NOT NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(country, city)
  )
`);

// Seed Egypt cities if not already present
const egyptCities = [
  'Cairo', 'Alexandria', 'Giza', 'Shubra El-Kheima', 'Port Said', 'Suez', 'Luxor', 'Asyut', 
  'Mansoura', 'Tanta', 'Ismailia', 'Faiyum', 'Zagazig', 'Aswan', 'Damietta', 'Damanhur',
  'Minya', 'Beni Suef', 'Sohag', 'Hurghada', 'Qena', 'Banha', 'Kafr el-Sheikh', 'Mallawi',
  'Arish', 'Bilbeis', '10th of Ramadan City', 'Desouk', 'Abu Kabir', 'Girga', 'Akhmim',
  'El-Mahalla El-Kubra', 'New Cairo', '6th of October City', 'Sheikh Zayed City', 'Sharm El-Sheikh',
  'El Alamein', 'Marsa Matruh', 'Ras El Bar', 'Ain Sokhna', 'Mersa Matruh'
];

try {
  const existingCities = db.prepare("SELECT COUNT(*) as count FROM cities WHERE country = 'Egypt'").get();
  if (existingCities.count === 0) {
    const insert = db.prepare("INSERT INTO cities (country, city) VALUES (?, ?)");
    egyptCities.forEach(city => {
      try {
        insert.run('Egypt', city);
      } catch (e) {
        // City may already exist
      }
    });
    console.log('Egypt cities seeded successfully');
  }
} catch (e) {
  console.error('Failed to seed Egypt cities:', e);
}

// Create shipping_rates table if not exists (don't drop to preserve data)
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS shipping_rates (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      city        TEXT NOT NULL,
      country     TEXT DEFAULT 'Egypt',
      cost        REAL NOT NULL DEFAULT 0,
      supplier_id TEXT REFERENCES users(id),
      is_active   INTEGER NOT NULL DEFAULT 1,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(supplier_id, city, country)
    )
  `);
  console.log('Shipping rates table ready');
} catch (e) {
  console.log('Shipping rates table creation:', e.message);
}

// Seed Egypt shipping rates if none exist
try {
  const existingRates = db.prepare('SELECT COUNT(*) as count FROM shipping_rates WHERE country = ?').get('Egypt');
  if (existingRates.count === 0) {
    console.log('Seeding Egypt shipping rates...');
    const insertRate = db.prepare('INSERT INTO shipping_rates (city, country, cost, is_active) VALUES (?, ?, ?, 1)');
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
    for (const cityData of EGYPT_CITIES) {
      insertRate.run(cityData.city, 'Egypt', cityData.cost);
    }
    console.log(`Seeded ${EGYPT_CITIES.length} Egypt shipping rates`);
  }
} catch (e) {
  console.error('Failed to seed Egypt shipping rates:', e);
}

// Add telegram column to users table
try {
  db.exec(`ALTER TABLE users ADD COLUMN telegram TEXT`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add website column to users table
try {
  db.exec(`ALTER TABLE users ADD COLUMN website TEXT`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Add password_hash column to users table for local authentication
try {
  db.exec(`ALTER TABLE users ADD COLUMN password_hash TEXT`);
} catch (e) {
  // Column already exists — safe to ignore
}

// Create product_videos table for video uploads
db.exec(`
  CREATE TABLE IF NOT EXISTS product_videos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id  INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    filename    TEXT NOT NULL,
    sort_order  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  )
`);

// ============================================
// CATEGORY-BASED PRODUCT VARIANTS SYSTEM
// ============================================

// Admin-defined variant templates per category
db.exec(`
  CREATE TABLE IF NOT EXISTS category_variant_templates (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    category      TEXT NOT NULL,
    variant_name  TEXT NOT NULL,
    sort_order    INTEGER DEFAULT 0,
    UNIQUE(category, variant_name)
  )
`);

// Supplier-defined variant groups per product
db.exec(`
  CREATE TABLE IF NOT EXISTS product_variants (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    variant_name  TEXT NOT NULL,
    is_required   INTEGER DEFAULT 1,
    sort_order    INTEGER DEFAULT 0,
    UNIQUE(product_id, variant_name)
  )
`);

// The actual options for each variant (e.g. Color → Red, Blue, Black)
db.exec(`
  CREATE TABLE IF NOT EXISTS product_variant_options (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    variant_id    INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    option_value  TEXT NOT NULL,
    sort_order    INTEGER DEFAULT 0,
    UNIQUE(variant_id, option_value)
  )
`);

// Stock per variant combination (e.g. Red+42 = 5 units)
db.exec(`
  CREATE TABLE IF NOT EXISTS product_variant_stock (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    combination   TEXT NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, combination)
  )
`);

// What the marketer selected on each order item
db.exec(`
  CREATE TABLE IF NOT EXISTS order_item_variants (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_item_id   INTEGER NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    variant_name    TEXT NOT NULL,
    variant_value   TEXT NOT NULL
  )
`);

// Seed default variant templates
try {
  const seedTemplates = db.prepare(`
    INSERT OR IGNORE INTO category_variant_templates (category, variant_name, sort_order) VALUES
    ('Shoes', 'Color', 1),
    ('Shoes', 'Size', 2),
    ('Fashion', 'Color', 1),
    ('Fashion', 'Size', 2),
    ('Fashion', 'Material', 3),
    ('Electronics', 'Color', 1),
    ('Electronics', 'Storage', 2),
    ('Mobile Phones', 'Color', 1),
    ('Mobile Phones', 'Storage', 2),
    ('Mobile Phones', 'RAM', 3)
  `);
  seedTemplates.run();
  console.log('Seeded default variant templates');
} catch (e) {
  console.error('Failed to seed variant templates:', e);
}

// Add main_media columns to products table
try {
  db.exec(`ALTER TABLE products ADD COLUMN main_media_type TEXT DEFAULT 'image'`);
} catch (e) {
  // Column already exists
}

try {
  db.exec(`ALTER TABLE products ADD COLUMN main_media_id INTEGER`);
} catch (e) {
  // Column already exists
}

// Add stock_quantity column to products table for inventory management
try {
  db.exec(`ALTER TABLE products ADD COLUMN stock_quantity INTEGER DEFAULT 0`);
} catch (e) {
  // Column already exists
}

// Add business info columns to users table (separate from personal info)
try {
  db.exec(`ALTER TABLE users ADD COLUMN business_name TEXT`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN business_email TEXT`);
} catch (e) {
  // Column already exists
}
try {
  db.exec(`ALTER TABLE users ADD COLUMN business_phone TEXT`);
} catch (e) {
  // Column already exists
}

// Add preferred_city column for location-based features
try {
  db.exec(`ALTER TABLE users ADD COLUMN preferred_city TEXT`);
} catch (e) {
  // Column already exists
}

console.log('Database initialized');

module.exports = db;
