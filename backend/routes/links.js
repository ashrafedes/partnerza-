const express = require('express');
const router = express.Router();
const { nanoid } = require('nanoid');
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');

// POST /api/links - Generate affiliate link (marketer only)
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can generate affiliate links' });
    }

    const { product_id } = req.body;
    
    if (!product_id) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    // Check if product exists and is active
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = ?').get(product_id, 'active');
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found or not active' });
    }

    // Check if link already exists for this marketer + product
    const existingLink = db.prepare('SELECT * FROM affiliate_links WHERE marketer_id = ? AND product_id = ?').get(req.user.id, product_id);
    
    if (existingLink) {
      // Return existing link
      return res.json({
        code: existingLink.code,
        link_url: `http://localhost:5000/go/${existingLink.code}`
      });
    }

    // Generate unique code
    const code = nanoid(8);
    
    // Insert new link
    const stmt = db.prepare('INSERT INTO affiliate_links (marketer_id, product_id, code) VALUES (?, ?, ?)');
    stmt.run(req.user.id, product_id, code);
    
    res.json({
      code,
      link_url: `http://localhost:5000/go/${code}`
    });
  } catch (error) {
    console.error('Generate link error:', error);
    res.status(500).json({ error: 'Failed to generate affiliate link' });
  }
});

// GET /api/links/mine - Get marketer's links (marketer only)
router.get('/mine', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can view their links' });
    }

    const links = db.prepare(`
      SELECT al.*, p.name as product_name, p.price, p.commission_rate,
        p.status as product_status
      FROM affiliate_links al
      JOIN products p ON al.product_id = p.id
      WHERE al.marketer_id = ?
      ORDER BY al.created_at DESC
    `).all(req.user.id);
    
    res.json(links);
  } catch (error) {
    console.error('Get links error:', error);
    res.status(500).json({ error: 'Failed to get links' });
  }
});

// GET /go/:code - Track click and return product data (public)
router.get('/:code', (req, res) => {
  try {
    const { code } = req.params;
    
    // Find affiliate link
    const link = db.prepare('SELECT * FROM affiliate_links WHERE code = ?').get(code);
    
    if (!link) {
      return res.status(404).json({ error: 'Affiliate link not found' });
    }

    // Increment clicks
    db.prepare('UPDATE affiliate_links SET clicks = clicks + 1 WHERE code = ?').run(code);
    
    // Get product data
    const product = db.prepare(`
      SELECT p.*, u.name as supplier_name
      FROM products p
      JOIN users u ON p.supplier_id = u.id
      WHERE p.id = ? AND p.status = 'active'
    `).get(link.product_id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found or not available' });
    }

    // Get all images
    const images = db.prepare(`
      SELECT filename FROM product_images WHERE product_id = ? ORDER BY sort_order
    `).all(link.product_id);

    // Get marketer's WhatsApp
    const marketer = db.prepare('SELECT whatsapp FROM users WHERE id = ?').get(link.marketer_id);
    
    // Build WhatsApp URL
    const text = encodeURIComponent(`Hi, I want to buy: ${product.name}. Price: ${product.price} SAR`);
    const whatsapp_url = marketer.whatsapp ? `https://wa.me/${marketer.whatsapp}?text=${text}` : null;
    
    res.json({
      product,
      images: images.map(img => img.filename),
      whatsapp_url,
      marketer_name: marketer ? marketer.whatsapp : null
    });
  } catch (error) {
    console.error('Track click error:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

module.exports = router;