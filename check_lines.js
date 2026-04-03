const fs = require('fs');
const content = fs.readFileSync('frontend/src/pages/AdminDashboard.jsx', 'utf8');
const lines = content.split('\n');

console.log('Lines 420-430:');
for (let i = 419; i < 430 && i < lines.length; i++) {
  console.log(`${i + 1}: ${JSON.stringify(lines[i])}`);
}
