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
    const ext = path.extname(file.originalname);
    cb(null, 'payment_' + nanoid(12) + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDF files are allowed'));
    }
  }
});

// Submit supplier payment with receipt
router.post('/submit', verifyToken, upload.single('receipt'), (req, res) => {
  try {
    const { total_amount, payment_method, transaction_reference, payment_date, notes } = req.body;
    const order_ids = JSON.parse(req.body.order_ids || '[]');
    const supplierId = req.user.id;
    const receiptUrl = req.file ? req.file.filename : null;

    console.log('Payment submission received:', {
      supplierId,
      order_ids,
      total_amount,
      transaction_reference,
      payment_date,
      hasReceipt: !!receiptUrl,
      body: req.body
    });

    // Validate required fields
    if (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      console.log('Validation failed: Order IDs missing or empty', order_ids);
      return res.status(400).json({ error: 'Order IDs are required' });
    }
    if (!total_amount || total_amount <= 0) {
      console.log('Validation failed: Invalid total amount', total_amount);
      return res.status(400).json({ error: 'Valid total amount is required' });
    }
    if (!transaction_reference) {
      console.log('Validation failed: Missing transaction reference');
      return res.status(400).json({ error: 'Transaction reference is required' });
    }
    if (!payment_date) {
      console.log('Validation failed: Missing payment date');
      return res.status(400).json({ error: 'Payment date is required' });
    }
    if (!receiptUrl) {
      console.log('Validation failed: Missing receipt file');
      return res.status(400).json({ error: 'Payment receipt is required' });
    }

    // Verify all orders belong to this supplier and are in delivered/completed status
    console.log('Checking orders for supplier:', supplierId, 'Order IDs:', order_ids);
    const ordersCheck = db.prepare(`
      SELECT o.id, o.status, o.total_platform_fee, o.total_commission
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id IN (${order_ids.map(() => '?').join(',')}) 
      AND oi.supplier_id = ?
      AND o.status IN ('delivered', 'completed')
      GROUP BY o.id
    `).all(...order_ids, supplierId);

    console.log('Orders check result:', ordersCheck, 'Expected count:', order_ids.length, 'Actual count:', ordersCheck.length);

    if (ordersCheck.length !== order_ids.length) {
      // Get more details about which orders failed
      const foundIds = ordersCheck.map(o => o.id);
      const missingIds = order_ids.filter(id => !foundIds.includes(id));
      console.log('Missing/invalid order IDs:', missingIds);
      
      // Check status of missing orders
      if (missingIds.length > 0) {
        const missingOrders = db.prepare(`
          SELECT o.id, o.status, oi.supplier_id 
          FROM orders o
          LEFT JOIN order_items oi ON o.id = oi.order_id
          WHERE o.id IN (${missingIds.map(() => '?').join(',')})
        `).all(...missingIds);
        console.log('Details for missing orders:', missingOrders);
      }
      
      return res.status(400).json({ 
        error: 'Some orders are invalid, not found, or not in delivered/completed status',
        details: { expected: order_ids.length, found: ordersCheck.length, missingIds }
      });
    }

    // Calculate expected total
    const expectedTotal = ordersCheck.reduce((sum, o) => {
      return sum + parseFloat(o.total_platform_fee || 0) + parseFloat(o.total_commission || 0);
    }, 0);

    // Allow small rounding differences
    if (Math.abs(expectedTotal - total_amount) > 0.01) {
      return res.status(400).json({ 
        error: `Amount mismatch. Expected: ${expectedTotal.toFixed(2)}, received: ${total_amount}` 
      });
    }

    // Create payment record
    const paymentResult = db.prepare(`
      INSERT INTO supplier_payments (
        supplier_id, total_amount, payment_method, transaction_reference, 
        payment_date, notes, receipt_url, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending_verification', datetime('now'))
    `).run(
      supplierId, 
      total_amount, 
      payment_method || 'vodafone_cash',
      transaction_reference,
      payment_date,
      notes || null,
      receiptUrl
    );

    const paymentId = paymentResult.lastInsertRowid;

    // Link orders to payment and update their payment_status to 'waiting_verification'
    const linkStmt = db.prepare(`
      INSERT INTO supplier_payment_orders (payment_id, order_id) VALUES (?, ?)
    `);
    
    order_ids.forEach(orderId => {
      linkStmt.run(paymentId, orderId);
    });

    // Update orders payment_status to 'waiting_verification' until admin approves
    console.log('Updating orders to waiting_verification. Order IDs:', order_ids);
    const updateResult = db.prepare(`
      UPDATE orders 
      SET payment_status = 'waiting_verification', updated_at = datetime('now')
      WHERE id IN (${order_ids.map(() => '?').join(',')})
    `).run(...order_ids);
    console.log('Update result:', updateResult);

    res.status(201).json({
      message: 'Payment submitted successfully. Awaiting admin verification.',
      payment: {
        id: paymentId,
        supplier_id: supplierId,
        total_amount: total_amount,
        payment_method: payment_method || 'vodafone_cash',
        transaction_reference: transaction_reference,
        status: 'pending_verification',
        order_count: order_ids.length
      }
    });

  } catch (error) {
    console.error('Error submitting supplier payment:', error);
    res.status(500).json({ error: 'Failed to submit payment: ' + error.message });
  }
});

// Get supplier payment history
router.get('/history', verifyToken, (req, res) => {
  try {
    const supplierId = req.user.id;
    
    const payments = db.prepare(`
      SELECT 
        sp.*,
        GROUP_CONCAT(spo.order_id) as order_ids
      FROM supplier_payments sp
      LEFT JOIN supplier_payment_orders spo ON sp.id = spo.payment_id
      WHERE sp.supplier_id = ?
      GROUP BY sp.id
      ORDER BY sp.created_at DESC
    `).all(supplierId);

    const formattedPayments = payments.map(p => ({
      ...p,
      order_ids: p.order_ids ? p.order_ids.split(',').map(Number) : []
    }));

    res.json(formattedPayments);
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Get pending payments (for admin)
router.get('/pending', verifyToken, (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const payments = db.prepare(`
      SELECT 
        sp.*,
        u.name as supplier_name,
        u.email as supplier_email,
        GROUP_CONCAT(spo.order_id) as order_ids
      FROM supplier_payments sp
      JOIN users u ON sp.supplier_id = u.id
      LEFT JOIN supplier_payment_orders spo ON sp.id = spo.payment_id
      WHERE sp.status = 'pending_verification'
      GROUP BY sp.id
      ORDER BY sp.created_at ASC
    `).all();

    const formattedPayments = payments.map(p => ({
      ...p,
      order_ids: p.order_ids ? p.order_ids.split(',').map(Number) : []
    }));

    res.json(formattedPayments);
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
  }
});

// Verify payment (admin only)
router.patch('/:id/verify', verifyToken, (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { status, notes } = req.body;
    
    if (!status || !['verified', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Valid status required (verified or rejected)' });
    }

    const payment = db.prepare('SELECT * FROM supplier_payments WHERE id = ?').get(req.params.id);
    
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.status !== 'pending_verification') {
      return res.status(400).json({ error: 'Payment has already been processed' });
    }

    db.prepare(`
      UPDATE supplier_payments 
      SET status = ?, verification_notes = ?, verified_by = ?, verified_at = datetime('now')
      WHERE id = ?
    `).run(status, notes || null, req.user.id, req.params.id);

    // If verified, update orders to paid status
    if (status === 'verified') {
      const orderIds = db.prepare('SELECT order_id FROM supplier_payment_orders WHERE payment_id = ?')
        .all(req.params.id)
        .map(row => row.order_id);

      if (orderIds.length > 0) {
        db.prepare(`
          UPDATE orders 
          SET payment_status = 'paid', updated_at = datetime('now')
          WHERE id IN (${orderIds.map(() => '?').join(',')})
        `).run(...orderIds);
      }
    }

    res.json({
      message: `Payment ${status === 'verified' ? 'verified' : 'rejected'} successfully`,
      payment_id: req.params.id,
      status: status
    });

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
