const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/verifyToken');

// Get all shipping rates (public - for marketers to see rates)
router.get('/', (req, res) => {
  try {
    const { country, supplier_id } = req.query;
    
    let query = 'SELECT * FROM shipping_rates WHERE is_active = 1';
    let params = [];
    
    if (country) {
      query += ' AND country = ?';
      params.push(country);
    }
    
    if (supplier_id) {
      // Get both supplier-specific rates AND global rates (supplier_id IS NULL)
      query += ' AND (supplier_id = ? OR supplier_id IS NULL)';
      params.push(supplier_id);
    }
    
    query += ' ORDER BY city ASC';
    
    const rates = db.prepare(query).all(...params);
    res.json(rates);
  } catch (error) {
    console.error('Error fetching shipping rates:', error);
    res.status(500).json({ error: 'Failed to fetch shipping rates' });
  }
});

// Get all shipping rates including inactive (superadmin only)
router.get('/all', verifyToken, requireRole(['superadmin']), (req, res) => {
  try {
    const rates = db.prepare(`
      SELECT * FROM shipping_rates 
      ORDER BY city ASC
    `).all();
    res.json(rates);
  } catch (error) {
    console.error('Error fetching all shipping rates:', error);
    res.status(500).json({ error: 'Failed to fetch shipping rates' });
  }
});

// Get shipping cost for a specific city
router.get('/cost/:city', (req, res) => {
  try {
    const { city } = req.params;
    const rate = db.prepare(`
      SELECT cost FROM shipping_rates 
      WHERE city = ? AND is_active = 1
    `).get(city);
    
    if (rate) {
      res.json({ city, cost: rate.cost });
    } else {
      res.json({ city, cost: 0 });
    }
  } catch (error) {
    console.error('Error fetching shipping cost:', error);
    res.status(500).json({ error: 'Failed to fetch shipping cost' });
  }
});

// Add new shipping rate (superadmin only)
router.post('/', verifyToken, requireRole(['superadmin']), (req, res) => {
  try {
    const { city, cost } = req.body;
    
    if (!city || cost === undefined || cost === null) {
      return res.status(400).json({ error: 'City and cost are required' });
    }
    
    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      return res.status(400).json({ error: 'Cost must be a valid non-negative number' });
    }
    
    const result = db.prepare(`
      INSERT INTO shipping_rates (city, cost, is_active, created_at, updated_at)
      VALUES (?, ?, 1, datetime('now'), datetime('now'))
    `).run(city.trim(), parsedCost);
    
    res.status(201).json({
      id: result.lastInsertRowid,
      city: city.trim(),
      cost: parsedCost,
      is_active: 1
    });
  } catch (error) {
    console.error('Error adding shipping rate:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Shipping rate for this city already exists' });
    }
    res.status(500).json({ error: 'Failed to add shipping rate' });
  }
});

// Update shipping rate (superadmin only)
router.patch('/:id', verifyToken, requireRole(['superadmin']), (req, res) => {
  try {
    const { id } = req.params;
    const { city, cost, is_active } = req.body;
    
    const existing = db.prepare('SELECT * FROM shipping_rates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Shipping rate not found' });
    }
    
    let updates = [];
    let values = [];
    
    if (city !== undefined) {
      updates.push('city = ?');
      values.push(city.trim());
    }
    
    if (cost !== undefined && cost !== null) {
      const parsedCost = parseFloat(cost);
      if (isNaN(parsedCost) || parsedCost < 0) {
        return res.status(400).json({ error: 'Cost must be a valid non-negative number' });
      }
      updates.push('cost = ?');
      values.push(parsedCost);
    }
    
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active ? 1 : 0);
    }
    
    updates.push('updated_at = datetime("now")');
    values.push(id);
    
    const query = `UPDATE shipping_rates SET ${updates.join(', ')} WHERE id = ?`;
    db.prepare(query).run(...values);
    
    res.json({
      id: parseInt(id),
      message: 'Shipping rate updated successfully'
    });
  } catch (error) {
    console.error('Error updating shipping rate:', error);
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Shipping rate for this city already exists' });
    }
    res.status(500).json({ error: 'Failed to update shipping rate' });
  }
});

// Delete shipping rate (superadmin only)
router.delete('/:id', verifyToken, requireRole(['superadmin']), (req, res) => {
  try {
    const { id } = req.params;
    
    const existing = db.prepare('SELECT * FROM shipping_rates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Shipping rate not found' });
    }
    
    db.prepare('DELETE FROM shipping_rates WHERE id = ?').run(id);
    
    res.json({
      id: parseInt(id),
      message: 'Shipping rate deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting shipping rate:', error);
    res.status(500).json({ error: 'Failed to delete shipping rate' });
  }
});

// Get supplier's own shipping rates
router.get('/my-rates', verifyToken, requireRole(['supplier']), (req, res) => {
  try {
    const supplierId = req.user.id;
    const rates = db.prepare(`
      SELECT * FROM shipping_rates 
      WHERE supplier_id = ?
      ORDER BY country ASC, city ASC
    `).all(supplierId);
    res.json(rates);
  } catch (error) {
    console.error('Error fetching supplier shipping rates:', error);
    res.status(500).json({ error: 'Failed to fetch shipping rates' });
  }
});

// Get cities by country (for supplier to set rates)
router.get('/cities-by-country/:country', verifyToken, requireRole(['supplier']), (req, res) => {
  try {
    const { country } = req.params;
    const cities = db.prepare(`
      SELECT city FROM cities 
      WHERE country = ?
      ORDER BY city ASC
    `).all(country);
    res.json(cities.map(c => c.city));
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ error: 'Failed to fetch cities' });
  }
});

// Add single shipping rate for supplier
router.post('/single', verifyToken, requireRole(['supplier']), (req, res) => {
  try {
    const supplierId = req.user.id;
    const { city, cost, country } = req.body;
    
    if (!city || cost === undefined || cost === null) {
      return res.status(400).json({ error: 'City and cost are required' });
    }
    
    const parsedCost = parseFloat(cost);
    if (isNaN(parsedCost) || parsedCost < 0) {
      return res.status(400).json({ error: 'Cost must be a valid non-negative number' });
    }
    
    // Check if rate already exists for this supplier/city/country
    const existing = db.prepare(`
      SELECT * FROM shipping_rates 
      WHERE supplier_id = ? AND city = ? AND country = ?
    `).get(supplierId, city.trim(), country || 'Egypt');
    
    if (existing) {
      // Update existing
      db.prepare(`
        UPDATE shipping_rates 
        SET cost = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(parsedCost, existing.id);
      res.json({ message: 'Shipping rate updated', id: existing.id });
    } else {
      // Create new
      const result = db.prepare(`
        INSERT INTO shipping_rates (city, country, cost, supplier_id, is_active, created_at, updated_at)
        VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
      `).run(city.trim(), country || 'Egypt', parsedCost, supplierId);
      res.status(201).json({
        id: result.lastInsertRowid,
        city: city.trim(),
        country: country || 'Egypt',
        cost: parsedCost
      });
    }
  } catch (error) {
    console.error('Error adding shipping rate:', error);
    res.status(500).json({ error: 'Failed to add shipping rate' });
  }
});

// Add bulk shipping rates for supplier
router.post('/bulk', verifyToken, requireRole(['supplier']), (req, res) => {
  try {
    const supplierId = req.user.id;
    const { country, rates } = req.body;
    
    if (!Array.isArray(rates) || rates.length === 0) {
      return res.status(400).json({ error: 'Rates array is required' });
    }
    
    let savedCount = 0;
    
    for (const rate of rates) {
      if (!rate.city || rate.cost === undefined) continue;
      
      const existing = db.prepare(`
        SELECT id FROM shipping_rates 
        WHERE supplier_id = ? AND city = ? AND country = ?
      `).get(supplierId, rate.city.trim(), country || 'Egypt');
      
      if (existing) {
        // Update existing
        db.prepare(`
          UPDATE shipping_rates 
          SET cost = ?, updated_at = datetime('now')
          WHERE id = ?
        `).run(parseFloat(rate.cost), existing.id);
      } else {
        // Insert new
        db.prepare(`
          INSERT INTO shipping_rates (city, country, cost, supplier_id, is_active, created_at, updated_at)
          VALUES (?, ?, ?, ?, 1, datetime('now'), datetime('now'))
        `).run(rate.city.trim(), country || 'Egypt', parseFloat(rate.cost), supplierId);
      }
      savedCount++;
    }
    
    res.json({ message: 'Bulk rates saved successfully', count: savedCount });
  } catch (error) {
    console.error('Error saving bulk rates:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to save bulk rates', details: error.message });
  }
});

// Delete shipping rate by city (for supplier)
router.delete('/city/:city', verifyToken, requireRole(['supplier']), (req, res) => {
  try {
    const supplierId = req.user.id;
    const { city } = req.params;
    
    const existing = db.prepare(`
      SELECT * FROM shipping_rates 
      WHERE supplier_id = ? AND city = ?
    `).get(supplierId, city);
    
    if (!existing) {
      return res.status(404).json({ error: 'Shipping rate not found' });
    }
    
    db.prepare('DELETE FROM shipping_rates WHERE id = ?').run(existing.id);
    res.json({ message: 'Shipping rate deleted successfully' });
  } catch (error) {
    console.error('Error deleting shipping rate:', error);
    res.status(500).json({ error: 'Failed to delete shipping rate' });
  }
});

module.exports = router;
