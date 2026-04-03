const db = require('./db');

console.log('Testing transaction with correct order...');

try {
  const transaction = db.transaction(() => {
    console.log('1. Deleting commissions...');
    db.prepare('DELETE FROM commissions').run();
    
    console.log('2. Deleting supplier_payment_orders...');
    db.prepare('DELETE FROM supplier_payment_orders').run();
    
    console.log('3. Deleting order_items...');
    db.prepare('DELETE FROM order_items').run();
    
    console.log('4. Deleting supplier_payments...');
    db.prepare('DELETE FROM supplier_payments').run();
    
    console.log('5. Deleting orders...');
    db.prepare('DELETE FROM orders').run();
    
    console.log('6. Deleting product_specs...');
    db.prepare('DELETE FROM product_specs').run();
    
    console.log('7. Deleting product_images...');
    db.prepare('DELETE FROM product_images').run();
    
    console.log('8. Deleting products...');
    db.prepare('DELETE FROM products').run();
    
    console.log('9. Deleting withdrawals...');
    db.prepare('DELETE FROM withdrawals').run();
    
    console.log('10. Deleting payment_methods...');
    db.prepare('DELETE FROM payment_methods').run();
    
    console.log('11. Deleting shipping_rates...');
    db.prepare('DELETE FROM shipping_rates').run();
    
    console.log('12. Deleting cities...');
    db.prepare('DELETE FROM cities').run();
    
    console.log('13. Resetting user balances...');
    db.prepare("UPDATE users SET balance = 0 WHERE role IN ('marketer', 'supplier')").run();
  });
  
  transaction();
  console.log('\nSUCCESS: All tables cleared!');
} catch (e) {
  console.error('\nERROR:', e.message);
  process.exit(1);
}
