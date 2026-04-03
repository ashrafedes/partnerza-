const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');

// POST /api/commissions - Record commission (admin/supplier only)
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'supplier') {
      return res.status(403).json({ error: 'Only admins and suppliers can record commissions' });
    }

    const { marketer_id, link_id, product_id, amount, note } = req.body;
    
    if (!marketer_id || !amount) {
      return res.status(400).json({ error: 'Missing required fields: marketer_id, amount' });
    }

    // Verify marketer exists
    const marketer = db.prepare('SELECT * FROM users WHERE id = ? AND role = ?').get(marketer_id, 'marketer');
    
    if (!marketer) {
      return res.status(404).json({ error: 'Marketer not found' });
    }

    // Insert commission
    const stmt = db.prepare(`
      INSERT INTO commissions (marketer_id, link_id, product_id, amount, note, status)
      VALUES (?, ?, ?, ?, ?, 'pending')
    `);
    
    const result = stmt.run(marketer_id, link_id || null, product_id || null, parseFloat(amount), note);
    
    // Update marketer balance
    db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(parseFloat(amount), marketer_id);
    
    res.json({ message: 'Commission recorded' });
  } catch (error) {
    console.error('Record commission error:', error);
    res.status(500).json({ error: 'Failed to record commission' });
  }
});

// GET /api/commissions - Get commissions (role-based)
router.get('/', verifyToken, (req, res) => {
  try {
    let commissions;
    
    if (req.user.role === 'admin') {
      // Admin sees all commissions
      commissions = db.prepare(`
        SELECT c.*, u.name as marketer_name, p.name as product_name
        FROM commissions c
        JOIN users u ON c.marketer_id = u.id
        LEFT JOIN products p ON c.product_id = p.id
        ORDER BY c.created_at DESC
      `).all();
    } else if (req.user.role === 'marketer') {
      // Marketer sees only their commissions
      commissions = db.prepare(`
        SELECT c.*, p.name as product_name
        FROM commissions c
        LEFT JOIN products p ON c.product_id = p.id
        WHERE c.marketer_id = ?
        ORDER BY c.created_at DESC
      `).all(req.user.id);
    } else if (req.user.role === 'supplier') {
      // Supplier sees commissions for their products
      commissions = db.prepare(`
        SELECT c.*, u.name as marketer_name, p.name as product_name
        FROM commissions c
        JOIN users u ON c.marketer_id = u.id
        JOIN products p ON c.product_id = p.id
        WHERE p.supplier_id = ?
        ORDER BY c.created_at DESC
      `).all(req.user.id);
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    res.json(commissions);
  } catch (error) {
    console.error('Get commissions error:', error);
    res.status(500).json({ error: 'Failed to get commissions' });
  }
});

// PATCH /api/commissions/:id/status - Update commission status (admin only)
router.patch('/:id/status', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update commission status' });
    }

    const { status } = req.body;
    
    if (!status || !['pending', 'approved', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: pending, approved, or paid' });
    }

    const commission = db.prepare('SELECT * FROM commissions WHERE id = ?').get(req.params.id);
    
    if (!commission) {
      return res.status(404).json({ error: 'Commission not found' });
    }

    db.prepare('UPDATE commissions SET status = ? WHERE id = ?').run(status, req.params.id);
    
    res.json({ message: 'Commission status updated' });
  } catch (error) {
    console.error('Update commission error:', error);
    res.status(500).json({ error: 'Failed to update commission status' });
  }
});

module.exports = router;