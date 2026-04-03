const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');

// GET /api/settings/currency - Get current currency (public, no auth needed)
router.get('/currency', (req, res) => {
  try {
    const currency = db.prepare(
      "SELECT value FROM platform_settings WHERE key = 'currency'"
    ).get();
    
    res.json({
      currency: currency?.value || 'SAR'
    });
  } catch (error) {
    console.error('Get currency error:', error);
    res.status(500).json({ error: 'Failed to get currency' });
  }
});

// PATCH /api/settings/currency - Update currency (superadmin only)
router.patch('/currency', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can update currency' });
    }

    const { currency } = req.body;
    if (!currency) {
      return res.status(400).json({ error: 'currency is required' });
    }

    const validCurrencies = ['SAR', 'USD', 'EUR', 'EGP', 'AED', 'KWD', 'QAR', 'BHD', 'OMR', 'JOD', 'LBP', 'IQD', 'MAD', 'TRY'];
    if (!validCurrencies.includes(currency)) {
      return res.status(400).json({ error: 'Invalid currency code' });
    }

    db.prepare(`
      INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run('currency', currency);

    res.json({ message: 'Currency updated', currency });
  } catch (error) {
    console.error('Update currency error:', error);
    res.status(500).json({ error: 'Failed to update currency' });
  }
});

// GET /api/settings/public - Get public settings (any authenticated user)
router.get('/public', verifyToken, (req, res) => {
  try {
    const minWithdrawal = db.prepare(
      "SELECT value FROM platform_settings WHERE key = 'min_withdrawal_amount'"
    ).get();
    
    res.json({
      min_withdrawal_amount: minWithdrawal?.value || '100'
    });
  } catch (error) {
    console.error('Get public settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// GET /api/settings - Get platform settings (superadmin and supplier only)
router.get('/', verifyToken, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM platform_settings').all();
    const settingsObj = {};
    settings.forEach(s => { settingsObj[s.key] = s.value; });

    // Suppliers only need settings, not marketer list
    if (req.user.role === 'supplier') {
      return res.json({ settings: settingsObj });
    }

    // Superadmin gets full access including marketer data
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can view full settings' });
    }

    const marketers = db.prepare(
      "SELECT id, name, email, platform_fee_rate_override FROM users WHERE role = 'marketer'"
    ).all();

    res.json({ settings: settingsObj, marketers });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /api/settings - Upsert a platform setting (superadmin only)
router.put('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can update settings' });
    }

    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ error: 'key and value are required' });
    }

    db.prepare(`
      INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
    `).run(key, String(value));

    res.json({ message: 'Setting updated' });
  } catch (error) {
    console.error('Update setting error:', error);
    res.status(500).json({ error: 'Failed to update setting' });
  }
});

// PATCH /api/settings/marketer/:id - Set per-marketer platform fee override
router.patch('/marketer/:id', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can set marketer overrides' });
    }

    const { platform_fee_rate_override } = req.body;
    const val = platform_fee_rate_override !== null && platform_fee_rate_override !== undefined
      ? parseFloat(platform_fee_rate_override) : null;

    db.prepare('UPDATE users SET platform_fee_rate_override = ? WHERE id = ?').run(val, req.params.id);
    res.json({ message: 'Marketer fee override updated' });
  } catch (error) {
    console.error('Update marketer override error:', error);
    res.status(500).json({ error: 'Failed to update marketer override' });
  }
});

// PATCH /api/settings/product/:id - Set per-product platform fee override
router.patch('/product/:id', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can set product overrides' });
    }

    const { platform_fee_rate_override } = req.body;
    const val = platform_fee_rate_override !== null && platform_fee_rate_override !== undefined
      ? parseFloat(platform_fee_rate_override) : null;

    db.prepare('UPDATE products SET platform_fee_rate_override = ? WHERE id = ?').run(val, req.params.id);
    res.json({ message: 'Product fee override updated' });
  } catch (error) {
    console.error('Update product override error:', error);
    res.status(500).json({ error: 'Failed to update product override' });
  }
});

module.exports = router;
