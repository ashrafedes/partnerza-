const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');

// Configure multer for receipt uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `receipt-${nanoid()}-${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    // Accept only images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// POST /api/withdrawals - Request withdrawal (marketer only)
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can request withdrawals' });
    }

    const { amount, payment_method_id } = req.body;

    if (!amount || !payment_method_id) {
      return res.status(400).json({ error: 'Missing required fields: amount, payment_method_id' });
    }

    const withdrawalAmount = parseFloat(amount);

    // Validate payment method belongs to marketer
    const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND marketer_id = ?').get(payment_method_id, req.user.id);
    if (!method) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // Check min withdrawal amount
    const minSetting = db.prepare("SELECT value FROM platform_settings WHERE key = 'min_withdrawal_amount'").get();
    const minAmount = minSetting ? parseFloat(minSetting.value) : 0;
    if (withdrawalAmount < minAmount) {
      return res.status(400).json({ error: `Minimum withdrawal amount is ${minAmount} SAR` });
    }

    // Check sufficient balance - calculate from completed orders commissions minus PENDING withdrawals only
    // Sum marketer_commission_amount from order_items for orders with status = 'completed'
    const completedCommissionResult = db.prepare(`
      SELECT COALESCE(SUM(oi.marketer_commission_amount), 0) as total
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE o.marketer_id = ? AND o.status = 'completed'
    `).get(req.user.id);
    
    const pendingWithdrawalsResult = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM withdrawals 
      WHERE marketer_id = ? AND status = 'pending'
    `).get(req.user.id);
    
    const completedCommissions = parseFloat(completedCommissionResult.total || 0);
    const pendingWithdrawals = parseFloat(pendingWithdrawalsResult.total || 0);
    const availableBalance = completedCommissions - pendingWithdrawals;
    
    console.log('Withdrawal check:', {
      user: req.user,
      userId: req.user?.id,
      userKeys: req.user ? Object.keys(req.user) : null,
      completedCommissions,
      pendingWithdrawals,
      availableBalance,
      withdrawalAmount
    });
    
    if (withdrawalAmount > availableBalance) {
      return res.status(400).json({ 
        error: `Insufficient balance. Available: ${availableBalance.toFixed(2)} SAR, Requested: ${withdrawalAmount.toFixed(2)} SAR. Completed commissions: ${completedCommissions.toFixed(2)} SAR, Pending withdrawals: ${pendingWithdrawals.toFixed(2)} SAR` 
      });
    }

    // Insert withdrawal request with payment method info
    db.prepare(`
      INSERT INTO withdrawals (marketer_id, amount, bank_name, iban, status, payment_method_id)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `).run(
      req.user.id,
      withdrawalAmount,
      method.bank_name || method.method_type,
      method.account_number_or_iban,
      payment_method_id
    );

    // Deduct amount from balance immediately
    db.prepare('UPDATE users SET balance = balance - ? WHERE id = ?').run(withdrawalAmount, req.user.id);

    res.json({ message: 'Withdrawal requested' });
  } catch (error) {
    console.error('Request withdrawal error:', error);
    res.status(500).json({ error: 'Failed to request withdrawal' });
  }
});

// GET /api/withdrawals - Get withdrawals (role-based)
router.get('/', verifyToken, (req, res) => {
  try {
    let withdrawals;

    if (req.user.role === 'superadmin') {
      withdrawals = db.prepare(`
        SELECT w.*, u.name as marketer_name,
               pm.method_type as payment_method_type,
               pm.account_name as payment_account_name,
               pm.account_number_or_iban as payment_account
        FROM withdrawals w
        JOIN users u ON w.marketer_id = u.id
        LEFT JOIN payment_methods pm ON w.payment_method_id = pm.id
        ORDER BY w.created_at DESC
      `).all();
    } else if (req.user.role === 'marketer') {
      withdrawals = db.prepare(`
        SELECT w.*,
               pm.method_type as payment_method_type,
               pm.account_name as payment_account_name,
               pm.account_number_or_iban as payment_account
        FROM withdrawals w
        LEFT JOIN payment_methods pm ON w.payment_method_id = pm.id
        WHERE w.marketer_id = ?
        ORDER BY w.created_at DESC
      `).all(req.user.id);
    } else {
      return res.status(403).json({ error: 'Not authorized' });
    }

    res.json(withdrawals);
  } catch (error) {
    console.error('Get withdrawals error:', error);
    res.status(500).json({ error: 'Failed to get withdrawals' });
  }
});

// PATCH /api/withdrawals/:id - Update withdrawal status (superadmin only)
router.patch('/:id', verifyToken, upload.single('receipt'), (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can update withdrawal status' });
    }

    const { status, admin_note } = req.body;

    if (!status || !['approved', 'rejected', 'paid'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be: approved, rejected, or paid' });
    }

    const withdrawal = db.prepare('SELECT * FROM withdrawals WHERE id = ?').get(req.params.id);
    if (!withdrawal) {
      return res.status(404).json({ error: 'Withdrawal not found' });
    }

    // If rejecting, refund the amount back to marketer
    if (status === 'rejected' && withdrawal.status === 'pending') {
      db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(withdrawal.amount, withdrawal.marketer_id);
    }

    // Build update query with optional receipt
    let query = `
      UPDATE withdrawals 
      SET status = ?, admin_note = ?, processed_at = datetime('now')
    `;
    let params = [status, admin_note || null];

    // Add receipt_url if file was uploaded
    if (req.file) {
      query += `, receipt_url = ?`;
      params.push(req.file.filename);
    }

    query += ` WHERE id = ?`;
    params.push(req.params.id);

    db.prepare(query).run(...params);

    res.json({ 
      message: 'Withdrawal updated',
      receipt_url: req.file ? `/uploads/${req.file.filename}` : null
    });
  } catch (error) {
    console.error('Update withdrawal error:', error);
    res.status(500).json({ error: 'Failed to update withdrawal' });
  }
});

module.exports = router;