const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');

// GET /api/payment-methods — marketer only
router.get('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can access payment methods' });
    }
    const methods = db.prepare(`
      SELECT * FROM payment_methods WHERE marketer_id = ? ORDER BY is_default DESC, created_at DESC
    `).all(req.user.id);
    res.json(methods);
  } catch (error) {
    console.error('Get payment methods error:', error);
    res.status(500).json({ error: 'Failed to get payment methods' });
  }
});

// POST /api/payment-methods — marketer only
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can add payment methods' });
    }

    const { method_type, account_name, account_number_or_iban, bank_name, is_default } = req.body;

    if (!method_type || !account_name || !account_number_or_iban) {
      return res.status(400).json({ error: 'Missing required fields: method_type, account_name, account_number_or_iban' });
    }

    if (method_type === 'Bank Transfer' && !bank_name) {
      return res.status(400).json({ error: 'bank_name is required for Bank Transfer' });
    }

    // If is_default, clear all other defaults first
    if (is_default) {
      db.prepare('UPDATE payment_methods SET is_default = 0 WHERE marketer_id = ?').run(req.user.id);
    }

    // If this is the first method, make it default automatically
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM payment_methods WHERE marketer_id = ?').get(req.user.id);
    const makeDefault = is_default || (existing && existing.cnt === 0) ? 1 : 0;

    const result = db.prepare(`
      INSERT INTO payment_methods (marketer_id, method_type, account_name, account_number_or_iban, bank_name, is_default)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(req.user.id, method_type, account_name, account_number_or_iban, bank_name || null, makeDefault);

    res.json({ message: 'Payment method added', id: result.lastInsertRowid });
  } catch (error) {
    console.error('Add payment method error:', error);
    res.status(500).json({ error: 'Failed to add payment method' });
  }
});

// PATCH /api/payment-methods/:id/default — marketer only
router.patch('/:id/default', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can update payment methods' });
    }

    const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND marketer_id = ?').get(req.params.id, req.user.id);
    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    db.prepare('UPDATE payment_methods SET is_default = 0 WHERE marketer_id = ?').run(req.user.id);
    db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(req.params.id);

    res.json({ message: 'Default payment method updated' });
  } catch (error) {
    console.error('Update default payment method error:', error);
    res.status(500).json({ error: 'Failed to update default payment method' });
  }
});

// DELETE /api/payment-methods/:id — marketer only
router.delete('/:id', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can delete payment methods' });
    }

    const method = db.prepare('SELECT * FROM payment_methods WHERE id = ? AND marketer_id = ?').get(req.params.id, req.user.id);
    if (!method) {
      return res.status(404).json({ error: 'Payment method not found' });
    }

    // Check if this method has pending withdrawals
    const pendingWithdrawals = db.prepare(
      "SELECT COUNT(*) as cnt FROM withdrawals WHERE payment_method_id = ? AND status = 'pending'"
    ).get(req.params.id);

    if (pendingWithdrawals && pendingWithdrawals.cnt > 0) {
      return res.status(400).json({ error: 'Cannot delete a payment method with pending withdrawals' });
    }

    db.prepare('DELETE FROM payment_methods WHERE id = ?').run(req.params.id);

    // If deleted method was default, make the next one default
    if (method.is_default) {
      const next = db.prepare('SELECT id FROM payment_methods WHERE marketer_id = ? ORDER BY created_at ASC LIMIT 1').get(req.user.id);
      if (next) {
        db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(next.id);
      }
    }

    res.json({ message: 'Payment method deleted' });
  } catch (error) {
    console.error('Delete payment method error:', error);
    res.status(500).json({ error: 'Failed to delete payment method' });
  }
});

module.exports = router;
