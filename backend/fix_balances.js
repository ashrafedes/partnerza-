const db = require('./db');

// Fix: Update all marketers' balances based on their pending commissions
console.log('Fixing marketer balances...');

// Get all pending commissions grouped by marketer
const pendingCommissions = db.prepare(`
  SELECT marketer_id, SUM(amount) as total_pending
  FROM commissions 
  WHERE status = 'pending'
  GROUP BY marketer_id
`).all();

console.log(`Found ${pendingCommissions.length} marketers with pending commissions`);

// Update each marketer's balance
for (const row of pendingCommissions) {
  const currentBalance = db.prepare('SELECT balance FROM users WHERE id = ?').get(row.marketer_id);
  console.log(`Marketer ${row.marketer_id}: Current balance = ${currentBalance?.balance || 0}, Adding = ${row.total_pending}`);
  
  db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(row.total_pending, row.marketer_id);
}

// Verify the fix
const updatedUsers = db.prepare(`
  SELECT u.id, u.name, u.balance, 
    (SELECT SUM(amount) FROM commissions WHERE marketer_id = u.id AND status = 'pending') as pending_total
  FROM users u
  WHERE u.role = 'marketer'
`).all();

console.log('\nUpdated balances:');
for (const user of updatedUsers) {
  console.log(`${user.name}: Balance = ${user.balance}, Pending = ${user.pending_total || 0}`);
}

console.log('\nFix complete!');
