const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken, requireRole } = require('../middleware/verifyToken');

/**
 * Admin Variant Templates CRUD Routes
 * For managing category-based product variant templates
 */

// Get all variant templates (grouped by category)
router.get('/templates', async (req, res) => {
  try {
    const templates = db.prepare(`
      SELECT * FROM category_variant_templates
      ORDER BY category, sort_order, variant_name
    `).all();

    // Group by category
    const grouped = templates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    }, {});

    res.json({ templates, grouped });
  } catch (error) {
    console.error('Error fetching variant templates:', error);
    res.status(500).json({ error: 'Failed to fetch variant templates' });
  }
});

// Get templates for a specific category
router.get('/templates/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const templates = db.prepare(`
      SELECT * FROM category_variant_templates
      WHERE category = ?
      ORDER BY sort_order, variant_name
    `).all(category);

    res.json({ category, templates });
  } catch (error) {
    console.error('Error fetching category templates:', error);
    res.status(500).json({ error: 'Failed to fetch category templates' });
  }
});

// Create a new variant template (superadmin only)
router.post('/templates', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { category, variant_name, sort_order = 0 } = req.body;

    if (!category || !variant_name) {
      return res.status(400).json({ error: 'Category and variant_name are required' });
    }

    const result = db.prepare(`
      INSERT INTO category_variant_templates (category, variant_name, sort_order)
      VALUES (?, ?, ?)
    `).run(category.trim(), variant_name.trim(), sort_order);

    res.status(201).json({
      id: result.lastInsertRowid,
      category: category.trim(),
      variant_name: variant_name.trim(),
      sort_order
    });
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Template already exists for this category and variant name' });
    }
    console.error('Error creating variant template:', error);
    res.status(500).json({ error: 'Failed to create variant template' });
  }
});

// Update a variant template (superadmin only)
router.put('/templates/:id', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { category, variant_name, sort_order } = req.body;

    const existing = db.prepare('SELECT * FROM category_variant_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updates = [];
    const values = [];

    if (category !== undefined) {
      updates.push('category = ?');
      values.push(category.trim());
    }
    if (variant_name !== undefined) {
      updates.push('variant_name = ?');
      values.push(variant_name.trim());
    }
    if (sort_order !== undefined) {
      updates.push('sort_order = ?');
      values.push(sort_order);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    db.prepare(`
      UPDATE category_variant_templates
      SET ${updates.join(', ')}
      WHERE id = ?
    `).run(...values);

    const updated = db.prepare('SELECT * FROM category_variant_templates WHERE id = ?').get(id);
    res.json(updated);
  } catch (error) {
    if (error.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: 'Template with this category and variant name already exists' });
    }
    console.error('Error updating variant template:', error);
    res.status(500).json({ error: 'Failed to update variant template' });
  }
});

// Delete a variant template (superadmin only)
router.delete('/templates/:id', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { id } = req.params;

    const existing = db.prepare('SELECT * FROM category_variant_templates WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: 'Template not found' });
    }

    db.prepare('DELETE FROM category_variant_templates WHERE id = ?').run(id);
    res.json({ message: 'Template deleted successfully', deleted: existing });
  } catch (error) {
    console.error('Error deleting variant template:', error);
    res.status(500).json({ error: 'Failed to delete variant template' });
  }
});

// Bulk create templates for a category (superadmin only)
router.post('/templates/bulk', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const { category, variants } = req.body;

    if (!category || !Array.isArray(variants) || variants.length === 0) {
      return res.status(400).json({ error: 'Category and variants array are required' });
    }

    const insert = db.prepare(`
      INSERT OR IGNORE INTO category_variant_templates (category, variant_name, sort_order)
      VALUES (?, ?, ?)
    `);

    const results = [];
    db.transaction(() => {
      variants.forEach((variant, index) => {
        const result = insert.run(category.trim(), variant.variant_name.trim(), variant.sort_order || index);
        results.push({
          variant_name: variant.variant_name,
          sort_order: variant.sort_order || index,
          inserted: result.changes > 0
        });
      });
    })();

    res.status(201).json({
      category: category.trim(),
      results,
      message: `Processed ${variants.length} templates`
    });
  } catch (error) {
    console.error('Error bulk creating templates:', error);
    res.status(500).json({ error: 'Failed to bulk create templates' });
  }
});

// Get all unique categories that have templates
router.get('/categories', async (req, res) => {
  try {
    const categories = db.prepare(`
      SELECT DISTINCT category FROM category_variant_templates
      ORDER BY category
    `).all();

    res.json({ categories: categories.map(c => c.category) });
  } catch (error) {
    console.error('Error fetching categories:', error);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

module.exports = router;
