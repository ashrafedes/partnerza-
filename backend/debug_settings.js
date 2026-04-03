const db = require('./db');

// Debug: Check current minimum withdrawal setting
console.log('Checking min_withdrawal_amount in database...\n');

const result = db.prepare(
  "SELECT * FROM platform_settings WHERE key = 'min_withdrawal_amount'"
).get();

if (result) {
  console.log('✅ Setting found:');
  console.log(`  Key: ${result.key}`);
  console.log(`  Value: ${result.value}`);
  console.log(`  Updated at: ${result.updated_at}`);
} else {
  console.log('❌ Setting NOT found in database');
  console.log('All settings in database:');
  const allSettings = db.prepare('SELECT * FROM platform_settings').all();
  console.log(allSettings);
}
