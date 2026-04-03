const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');
const fs = require('fs');
const path = require('path');

// POST /api/admin/reset-data - Clear all data while keeping structure (superadmin only)
router.post('/reset-data', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can reset data' });
    }

    // Get confirmation from body
    const { confirmation } = req.body;
    
    // Start transaction
    const transaction = db.transaction(() => {
      // 1. Delete commissions first (references order_items, orders)
      db.prepare('DELETE FROM commissions').run();
      
      // 2. Delete supplier_payment_orders (child table of supplier_payments and orders)
      db.prepare('DELETE FROM supplier_payment_orders').run();
      
      // 3. Delete order_items (child table of orders and products)
      db.prepare('DELETE FROM order_items').run();
      
      // 4. Delete supplier_payments
      db.prepare('DELETE FROM supplier_payments').run();
      
      // 5. Delete orders
      db.prepare('DELETE FROM orders').run();
      
      // 6. Delete product_specs
      db.prepare('DELETE FROM product_specs').run();
      
      // 7. Delete product_images
      db.prepare('DELETE FROM product_images').run();
      
      // 8. Delete products
      db.prepare('DELETE FROM products').run();
      
      // 9. Delete withdrawals
      db.prepare('DELETE FROM withdrawals').run();
      
      // 10. Delete payment_methods
      db.prepare('DELETE FROM payment_methods').run();
      
      // 11. Delete shipping_rates
      db.prepare('DELETE FROM shipping_rates').run();
      
      // 12. Delete cities
      db.prepare('DELETE FROM cities').run();
      
      // 13. Reset user balances
      db.prepare("UPDATE users SET balance = 0 WHERE role IN ('marketer', 'supplier')").run();
      
    });

    // Execute transaction
    transaction();
    
    // Clean up uploaded files (optional - keeps uploads folder clean)
    const uploadsDir = path.join(__dirname, '../uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      let deletedCount = 0;
      files.forEach(file => {
        // Keep default files or files with 'receipt' in name if needed
        // Delete product images and other uploaded files
        if (!file.startsWith('.') && !file.includes('default')) {
          try {
            fs.unlinkSync(path.join(uploadsDir, file));
            deletedCount++;
          } catch (e) {
            console.log('Failed to delete file:', file);
          }
        }
      });
      console.log(`Cleaned up ${deletedCount} uploaded files`);
    }
    
    // Vacuum the database to reclaim space
    db.prepare('VACUUM').run();

    res.json({ 
      message: 'All data has been cleared successfully. Database structure preserved.',
      cleared_tables: [
        'supplier_payment_orders',
        'order_items',
        'commissions', 
        'supplier_payments',
        'orders',
        'product_specs',
        'product_images',
        'products',
        'withdrawals',
        'payment_methods',
        'shipping_rates',
        'cities'
      ],
      preserved: [
        'users (all accounts preserved)',
        'platform_settings (settings preserved)'
      ]
    });
    
  } catch (error) {
    console.error('Data reset error:', error);
    res.status(500).json({ 
      error: 'Failed to reset data', 
      details: error.message 
    });
  }
});

// GET /api/admin/stats - Get current data statistics
router.get('/stats', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can view stats' });
    }

    const stats = {
      orders: db.prepare('SELECT COUNT(*) as count FROM orders').get().count,
      products: db.prepare('SELECT COUNT(*) as count FROM products').get().count,
      users: db.prepare('SELECT COUNT(*) as count FROM users').get().count,
      withdrawals: db.prepare('SELECT COUNT(*) as count FROM withdrawals').get().count,
      supplier_payments: db.prepare('SELECT COUNT(*) as count FROM supplier_payments').get().count,
      order_items: db.prepare('SELECT COUNT(*) as count FROM order_items').get().count
    };

    res.json(stats);
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

module.exports = router;
