const db = require('./db');

// Fix: Update all existing pending commissions to approved
console.log('Updating commission statuses...');

const result = db.prepare(`
  UPDATE commissions 
  SET status = 'approved' 
  WHERE status = 'pending'
`).run();

console.log(`Updated ${result.changes} commissions from 'pending' to 'approved'`);

// Verify the fix
const pendingCount = db.prepare('SELECT COUNT(*) as count FROM commissions WHERE status = ?').get('pending');
const approvedCount = db.prepare('SELECT COUNT(*) as count FROM commissions WHERE status = ?').get('approved');

console.log(`\nCurrent status counts:`);
console.log(`Pending: ${pendingCount.count}`);
console.log(`Approved: ${approvedCount.count}`);

console.log('\nFix complete!');
