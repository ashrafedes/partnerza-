const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');

// Multer configuration for file upload (images and videos)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, nanoid(12) + ext);
  }
});

const upload = multer({
  storage,
  limits: { files: 11, fileSize: 200 * 1024 * 1024 }, // 200MB for videos
  fileFilter: (req, file, cb) => {
    const allowedImages = ['image/jpeg', 'image/png', 'image/webp'];
    const allowedVideos = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (allowedImages.includes(file.mimetype) || allowedVideos.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, WebP images and MP4, WebM, MOV videos are allowed'));
    }
  }
});

// GET /api/products - Get all active products (public), supports ?search= and ?category=
router.get('/', (req, res) => {
  try {
    const { search, category } = req.query;
    console.log('Marketplace query - search:', search, 'category:', category);
    
    // Count total products first
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM products').get();
    const activeCount = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'active' OR status IS NULL").get();
    console.log('Database product counts - Total:', totalCount.count, 'Active:', activeCount.count);
    
    let sql = `
      SELECT p.id, p.name, p.description, p.price, p.marketer_commission_rate,
        p.platform_fee_rate_override, p.category, p.status, p.created_at, p.stock_quantity,
        p.supplier_id, u.name as supplier_name,
        CASE 
          WHEN p.main_media_type = 'image' AND p.main_media_id IS NOT NULL THEN
            (SELECT filename FROM product_images WHERE id = p.main_media_id)
          ELSE
            (SELECT filename FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1)
        END as main_image
      FROM products p
      JOIN users u ON p.supplier_id = u.id
      WHERE (p.status = 'active' OR p.status IS NULL)
    `;
    const params = [];

    if (search && search.trim()) {
      sql += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
      const term = `%${search.trim()}%`;
      params.push(term, term);
    }

    if (category && category.trim() && category !== 'All') {
      sql += ` AND p.category = ?`;
      params.push(category.trim());
    }

    sql += ` ORDER BY p.created_at DESC`;

    console.log('Marketplace SQL:', sql);
    console.log('Marketplace params:', params);
    
    const products = db.prepare(sql).all(...params);
    console.log('Marketplace found', products.length, 'products');
    if (products.length > 0) {
      console.log('First product:', {id: products[0].id, name: products[0].name, supplier_id: products[0].supplier_id, supplier_name: products[0].supplier_name});
    } else {
      console.log('WARNING: No products found in marketplace query!');
    }
    
    res.json(products);
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// GET /api/products/:id - Get one product with all images and specs (public)
router.get('/:id', (req, res) => {
  try {
    const product = db.prepare(`
      SELECT p.*, u.name as supplier_name, u.country as supplier_country
      FROM products p
      JOIN users u ON p.supplier_id = u.id
      WHERE p.id = ? AND (p.status = 'active' OR p.status IS NULL)
    `).get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const images = db.prepare(`
      SELECT id, filename as image_path FROM product_images WHERE product_id = ? ORDER BY sort_order
    `).all(req.params.id);

    const videos = db.prepare(`
      SELECT id, filename as video_path FROM product_videos WHERE product_id = ? ORDER BY sort_order
    `).all(req.params.id);

    console.log(`Product ${req.params.id} images:`, images);
    console.log(`Product ${req.params.id} videos:`, videos);

    const specs = db.prepare(`
      SELECT spec_key, spec_value, sort_order FROM product_specs WHERE product_id = ? ORDER BY sort_order
    `).all(req.params.id);
    
    res.json({ ...product, images, videos, specs });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Failed to get product' });
  }
});

// POST /api/products - Create new product (supplier/superadmin only)
router.post('/', verifyToken, (req, res) => {
  // Use upload middleware with error handling
  upload.array('images', 10)(req, res, (err) => {
    if (err) {
      console.error('Upload error:', err);
      return res.status(400).json({ error: err.message || 'Upload failed' });
    }

    try {
      console.log('Creating product, user:', req.user);
      console.log('User ID:', req.user?.id);
      console.log('User role:', req.user?.role);
      
      if (req.user.role !== 'supplier' && req.user.role !== 'superadmin') {
        return res.status(403).json({ error: 'Only suppliers can add products' });
      }

      const { name, description, price, marketer_commission_rate, platform_fee_rate_override, category, specs, stock_quantity } = req.body;
      
      if (!name || !price || !marketer_commission_rate) {
        return res.status(400).json({ error: 'Missing required fields: name, price, marketer_commission_rate' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'At least one image or video is required' });
      }

      if (req.files.length > 11) {
        return res.status(400).json({ error: 'Maximum 10 images + 1 video allowed per product' });
      }

      // Separate images and videos
      const imageFiles = req.files.filter(f => f.mimetype.startsWith('image/'));
      const videoFiles = req.files.filter(f => f.mimetype.startsWith('video/'));

      if (imageFiles.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images allowed per product' });
      }
      if (videoFiles.length > 1) {
        return res.status(400).json({ error: 'Maximum 1 video allowed per product' });
      }

    // Insert product
      const stmt = db.prepare(`
        INSERT INTO products (supplier_id, name, description, price, marketer_commission_rate, platform_fee_rate_override, category, stock_quantity, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      const feeOverride = platform_fee_rate_override ? parseFloat(platform_fee_rate_override) : null;
      const stockQty = stock_quantity !== undefined ? parseInt(stock_quantity) : 0;
      console.log('Inserting product with supplier_id:', req.user.id);
      const result = stmt.run(req.user.id, name, description, parseFloat(price), parseFloat(marketer_commission_rate), feeOverride, category, stockQty, 'active');
      const productId = result.lastInsertRowid;
      console.log('Product created with ID:', productId, 'supplier_id:', req.user.id);

      // Insert specs if provided
      if (specs) {
        try {
          const specsArr = typeof specs === 'string' ? JSON.parse(specs) : specs;
          const specStmt = db.prepare('INSERT INTO product_specs (product_id, spec_key, spec_value, sort_order) VALUES (?, ?, ?, ?)');
          specsArr.forEach((s, i) => {
            specStmt.run(productId, s.spec_key, s.spec_value, s.sort_order !== undefined ? s.sort_order : i);
          });
        } catch (e) {
          console.error('Failed to parse specs:', e);
        }
      }
      
      // Insert images
      const imgStmt = db.prepare(`
        INSERT INTO product_images (product_id, filename, sort_order) VALUES (?, ?, ?)
      `);
      
      imageFiles.forEach((file, index) => {
        console.log(`Saving image: ${file.filename} for product ${productId}`);
        imgStmt.run(productId, file.filename, index);
      });

      // Insert video if present
      if (videoFiles.length > 0) {
        const videoStmt = db.prepare(`
          INSERT INTO product_videos (product_id, filename, sort_order) VALUES (?, ?, ?)
        `);
        console.log(`Saving video: ${videoFiles[0].filename} for product ${productId}`);
        videoStmt.run(productId, videoFiles[0].filename, 0);
      }
      
      // Set main_image to first uploaded image
      if (imageFiles.length > 0) {
        db.prepare('UPDATE products SET main_image = ? WHERE id = ?').run(imageFiles[0].filename, productId);
        console.log(`Set main_image to: ${imageFiles[0].filename}`);
      }
      
      res.json({ message: 'Product created', product_id: productId });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ error: 'Failed to create product' });
    }
  });
});

// PUT /api/products/:id - Update product (owner or superadmin only)
router.put('/:id', verifyToken, upload.array('images', 11), (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (req.user.role !== 'superadmin' && product.supplier_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this product' });
    }

    const { name, description, price, marketer_commission_rate, platform_fee_rate_override, category, status, specs, main_media_type, main_media_id, stock_quantity } = req.body;
    
    // Update product
    const stmt = db.prepare(`
      UPDATE products 
      SET name = ?, description = ?, price = ?, marketer_commission_rate = ?, platform_fee_rate_override = ?, category = ?, status = ?, main_media_type = ?, main_media_id = ?, stock_quantity = ?
      WHERE id = ?
    `);
    
    stmt.run(
      name || product.name,
      description !== undefined ? description : product.description,
      price ? parseFloat(price) : product.price,
      marketer_commission_rate ? parseFloat(marketer_commission_rate) : product.marketer_commission_rate,
      platform_fee_rate_override !== undefined ? (platform_fee_rate_override ? parseFloat(platform_fee_rate_override) : null) : product.platform_fee_rate_override,
      category !== undefined ? category : product.category,
      status || product.status,
      main_media_type || product.main_media_type || 'image',
      main_media_id || product.main_media_id || null,
      stock_quantity !== undefined ? parseInt(stock_quantity) : product.stock_quantity || 0,
      req.params.id
    );

    // Update specs if provided
    if (specs) {
      try {
        const specsArr = typeof specs === 'string' ? JSON.parse(specs) : specs;
        
        // Delete existing specs
        db.prepare('DELETE FROM product_specs WHERE product_id = ?').run(req.params.id);
        
        // Insert new specs
        const specStmt = db.prepare('INSERT INTO product_specs (product_id, spec_key, spec_value, sort_order) VALUES (?, ?, ?, ?)');
        specsArr.forEach((s, i) => {
          if (s.spec_key && s.spec_value) {
            specStmt.run(req.params.id, s.spec_key, s.spec_value, s.sort_order !== undefined ? s.sort_order : i);
          }
        });
      } catch (e) {
        console.error('Failed to parse specs:', e);
      }
    }

    // Add new images and videos if any
    if (req.files && req.files.length > 0) {
      // Separate images and videos
      const imageFiles = req.files.filter(f => f.mimetype.startsWith('image/'));
      const videoFiles = req.files.filter(f => f.mimetype.startsWith('video/'));

      // Count current images
      const currentCount = db.prepare('SELECT COUNT(*) as count FROM product_images WHERE product_id = ?').get(req.params.id);
      
      if (currentCount.count + imageFiles.length > 10) {
        return res.status(400).json({ error: 'Maximum 10 images allowed per product' });
      }

      // Check current video count
      const currentVideoCount = db.prepare('SELECT COUNT(*) as count FROM product_videos WHERE product_id = ?').get(req.params.id);
      if (currentVideoCount.count + videoFiles.length > 1) {
        return res.status(400).json({ error: 'Maximum 1 video allowed per product' });
      }

      // Insert new images
      if (imageFiles.length > 0) {
        const imgStmt = db.prepare(`
          INSERT INTO product_images (product_id, filename, sort_order) VALUES (?, ?, ?)
        `);
        
        imageFiles.forEach((file, index) => {
          imgStmt.run(req.params.id, file.filename, currentCount.count + index);
        });
      }

      // Insert new video
      if (videoFiles.length > 0) {
        const videoStmt = db.prepare(`
          INSERT INTO product_videos (product_id, filename, sort_order) VALUES (?, ?, ?)
        `);
        videoStmt.run(req.params.id, videoFiles[0].filename, currentVideoCount.count);
      }
    }
    
    res.json({ message: 'Product updated' });
  } catch (error) {
    console.error('Update product error:', error);
    console.error('Error message:', error.message);
    res.status(500).json({ error: 'Failed to update product', details: error.message });
  }
});

// GET /api/products/supplier/mine - Get supplier's own products
router.get('/supplier/mine', verifyToken, (req, res) => {
  try {
    console.log('Supplier products request - User:', req.user?.id, 'Role:', req.user?.role);
    
    if (req.user.role !== 'supplier' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const isSuperadmin = req.user.role === 'superadmin';
    const supplierId = isSuperadmin ? null : req.user.id;
    
    console.log('Fetching products for supplier:', supplierId, 'isSuperadmin:', isSuperadmin);
    
    const products = db.prepare(`
      SELECT p.*, u.name as supplier_name,
        (SELECT filename FROM product_images WHERE product_id = p.id ORDER BY sort_order LIMIT 1) as main_image,
        (SELECT COUNT(*) FROM product_images WHERE product_id = p.id) as image_count
      FROM products p
      JOIN users u ON p.supplier_id = u.id
      WHERE (p.supplier_id = ? OR ? = 1)
        AND p.status != 'deleted'
      ORDER BY p.created_at DESC
    `).all(supplierId, isSuperadmin ? 1 : 0);
    
    console.log('Supplier dashboard found', products.length, 'products for supplier', supplierId);
    if (products.length > 0) {
      console.log('First product:', {id: products[0].id, name: products[0].name, supplier_id: products[0].supplier_id, status: products[0].status});
    }
    
    res.json(products);
  } catch (error) {
    console.error('Get supplier products error:', error);
    res.status(500).json({ error: 'Failed to get products' });
  }
});

// ============================================
// PRODUCT VARIANTS ENDPOINTS
// ============================================

// GET /api/products/:id/variants - Get all variants, options, and stock for a product
router.get('/:id/variants', async (req, res) => {
  try {
    const productId = req.params.id;

    // Check product exists
    const product = db.prepare('SELECT id, category FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get variants with their options
    const variants = db.prepare(`
      SELECT pv.id, pv.variant_name, pv.is_required, pv.sort_order,
        GROUP_CONCAT(pvo.option_value, '||') as options
      FROM product_variants pv
      LEFT JOIN product_variant_options pvo ON pv.id = pvo.variant_id
      WHERE pv.product_id = ?
      GROUP BY pv.id
      ORDER BY pv.sort_order, pv.variant_name
    `).all(productId);

    // Parse options into arrays
    const formattedVariants = variants.map(v => ({
      ...v,
      options: v.options ? v.options.split('||') : []
    }));

    // Get stock for all combinations
    const stock = db.prepare(`
      SELECT combination, stock_quantity
      FROM product_variant_stock
      WHERE product_id = ?
    `).all(productId);

    // Parse combination JSON
    const formattedStock = stock.map(s => ({
      combination: JSON.parse(s.combination),
      stock_quantity: s.stock_quantity
    }));

    res.json({
      product_id: productId,
      category: product.category,
      variants: formattedVariants,
      stock: formattedStock
    });
  } catch (error) {
    console.error('Error fetching product variants:', error);
    res.status(500).json({ error: 'Failed to fetch product variants' });
  }
});

// PUT /api/products/:id/variants - Update variants and stock for a product
router.put('/:id/variants', verifyToken, async (req, res) => {
  try {
    const productId = req.params.id;
    const { variants, variant_stock } = req.body;

    // Check product exists and user has permission
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (req.user.role !== 'superadmin' && product.supplier_id !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to update this product' });
    }

    // Start transaction
    db.transaction(() => {
      // Delete existing variants (cascades to options and stock)
      db.prepare('DELETE FROM product_variants WHERE product_id = ?').run(productId);
      db.prepare('DELETE FROM product_variant_stock WHERE product_id = ?').run(productId);

      // Insert new variants
      if (variants && Array.isArray(variants)) {
        const variantStmt = db.prepare(`
          INSERT INTO product_variants (product_id, variant_name, is_required, sort_order)
          VALUES (?, ?, ?, ?)
        `);
        const optionStmt = db.prepare(`
          INSERT INTO product_variant_options (variant_id, option_value, sort_order)
          VALUES (?, ?, ?)
        `);

        variants.forEach((variant, vIndex) => {
          const variantResult = variantStmt.run(
            productId,
            variant.variant_name,
            variant.is_required !== false ? 1 : 0,
            variant.sort_order || vIndex
          );

          // Insert options for this variant
          if (variant.options && Array.isArray(variant.options)) {
            variant.options.forEach((option, oIndex) => {
              optionStmt.run(variantResult.lastInsertRowid, option, oIndex);
            });
          }
        });
      }

      // Insert variant stock
      if (variant_stock && Array.isArray(variant_stock)) {
        const stockStmt = db.prepare(`
          INSERT INTO product_variant_stock (product_id, combination, stock_quantity)
          VALUES (?, ?, ?)
        `);

        variant_stock.forEach(stock => {
          stockStmt.run(
            productId,
            JSON.stringify(stock.combination),
            stock.stock_quantity || 0
          );
        });
      }
    })();

    res.json({ message: 'Product variants updated successfully' });
  } catch (error) {
    console.error('Error updating product variants:', error);
    res.status(500).json({ error: 'Failed to update product variants' });
  }
});

// GET /api/products/:id/variant-stock - Get stock for a specific variant combination
router.get('/:id/variant-stock', async (req, res) => {
  try {
    const productId = req.params.id;
    const { combination } = req.query;

    if (!combination) {
      return res.status(400).json({ error: 'combination query param is required' });
    }

    const stock = db.prepare(`
      SELECT stock_quantity
      FROM product_variant_stock
      WHERE product_id = ? AND combination = ?
    `).get(productId, combination);

    res.json({
      product_id: productId,
      combination: JSON.parse(combination),
      stock_quantity: stock ? stock.stock_quantity : 0,
      available: stock ? stock.stock_quantity > 0 : false
    });
  } catch (error) {
    console.error('Error fetching variant stock:', error);
    res.status(500).json({ error: 'Failed to fetch variant stock' });
  }
});

// POST /api/products/:id/variants/check-stock - Check stock for multiple combinations
router.post('/:id/variants/check-stock', async (req, res) => {
  try {
    const productId = req.params.id;
    const { combinations } = req.body;

    if (!Array.isArray(combinations)) {
      return res.status(400).json({ error: 'combinations array is required' });
    }

    const results = combinations.map(combo => {
      const comboStr = typeof combo === 'string' ? combo : JSON.stringify(combo);
      const stock = db.prepare(`
        SELECT stock_quantity
        FROM product_variant_stock
        WHERE product_id = ? AND combination = ?
      `).get(productId, comboStr);

      return {
        combination: typeof combo === 'string' ? JSON.parse(combo) : combo,
        stock_quantity: stock ? stock.stock_quantity : 0,
        available: stock ? stock.stock_quantity > 0 : false
      };
    });

    res.json({ results });
  } catch (error) {
    console.error('Error checking variant stock:', error);
    res.status(500).json({ error: 'Failed to check variant stock' });
  }
});

// DELETE /api/products/:id - Delete product (superadmin only)
router.delete('/:id', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only superadmin can delete products' });
    }
    
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Soft delete - set status to deleted
    db.prepare('UPDATE products SET status = ? WHERE id = ?').run('deleted', req.params.id);
    
    res.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

module.exports = router;
