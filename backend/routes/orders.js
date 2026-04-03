const express = require('express');
const router = express.Router();
const db = require('../db');
const { verifyToken } = require('../middleware/verifyToken');

/**
 * Helper: Get product variants with their options
 */
function getProductVariants(productId) {
  const variants = db.prepare(`
    SELECT pv.id, pv.variant_name, pv.is_required,
      GROUP_CONCAT(pvo.option_value, '||') as options
    FROM product_variants pv
    LEFT JOIN product_variant_options pvo ON pv.id = pvo.variant_id
    WHERE pv.product_id = ?
    GROUP BY pv.id
    ORDER BY pv.sort_order
  `).all(productId);

  return variants.map(v => ({
    ...v,
    options: v.options ? v.options.split('||') : [],
    is_required: v.is_required === 1
  }));
}

/**
 * Helper: Validate variant selections for a product
 */
function validateVariantSelections(productId, selectedVariants, requiredVariants) {
  const errors = [];
  
  // Check all required variants are selected
  for (const required of requiredVariants) {
    if (required.is_required && !selectedVariants[required.variant_name]) {
      errors.push(`Missing required variant: ${required.variant_name}`);
    }
  }

  // Check selected values exist in options
  for (const [variantName, selectedValue] of Object.entries(selectedVariants)) {
    const variant = requiredVariants.find(v => v.variant_name === variantName);
    if (!variant) {
      errors.push(`Invalid variant: ${variantName}`);
    } else if (!variant.options.includes(selectedValue)) {
      errors.push(`Invalid value "${selectedValue}" for variant "${variantName}"`);
    }
  }

  return errors;
}

/**
 * Helper: Check stock for variant combination
 */
function checkVariantStock(productId, combination) {
  const comboStr = JSON.stringify(combination);
  const stock = db.prepare(`
    SELECT stock_quantity FROM product_variant_stock
    WHERE product_id = ? AND combination = ?
  `).get(productId, comboStr);
  
  return stock ? stock.stock_quantity : 0;
}

/**
 * Helper: Deduct stock for variant combination
 */
function deductVariantStock(productId, combination, quantity) {
  const comboStr = JSON.stringify(combination);
  const current = checkVariantStock(productId, combination);
  
  if (current < quantity) {
    return { success: false, error: `Insufficient stock for combination ${comboStr}` };
  }
  
  db.prepare(`
    UPDATE product_variant_stock
    SET stock_quantity = stock_quantity - ?
    WHERE product_id = ? AND combination = ?
  `).run(quantity, productId, comboStr);
  
  return { success: true };
}

/**
 * Helper: Save order item variants
 */
function saveOrderItemVariants(orderItemId, selectedVariants) {
  const stmt = db.prepare(`
    INSERT INTO order_item_variants (order_item_id, variant_name, variant_value)
    VALUES (?, ?, ?)
  `);
  
  for (const [name, value] of Object.entries(selectedVariants)) {
    stmt.run(orderItemId, name, value);
  }
}

/**
 * Helper: Get order item variants
 */
function getOrderItemVariants(orderItemId) {
  return db.prepare(`
    SELECT variant_name, variant_value
    FROM order_item_variants
    WHERE order_item_id = ?
  `).all(orderItemId);
}

// POST /api/orders - Create order (marketer only)
router.post('/', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can submit orders' });
    }

    const { items, client_name, client_phone, client_address, client_notes, city, shipment_cost } = req.body;

    // Support both single product (backward compatibility) and multi-product
    if (req.body.product_id) {
      // Single product order (backward compatibility)
      const { product_id, quantity, selected_variants } = req.body;
      
      if (!product_id || !client_name || !client_phone) {
        return res.status(400).json({ error: 'Missing required fields: product_id, client_name, client_phone' });
      }

      const shipmentCost = parseFloat(shipment_cost) || 0;
      
      // Get shipping cost from city if not provided directly (filter by supplier)
      let finalShipmentCost = shipmentCost;
      if (!shipmentCost && city) {
        const product = db.prepare('SELECT supplier_id FROM products WHERE id = ?').get(product_id);
        const supplierId = product ? product.supplier_id : null;
        const shippingRate = db.prepare('SELECT cost FROM shipping_rates WHERE city = ? AND supplier_id = ? AND is_active = 1').get(city, supplierId);
        if (shippingRate) {
          finalShipmentCost = shippingRate.cost;
        }
      }

      const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = ?').get(product_id, 'active');
      if (!product) {
        return res.status(404).json({ error: 'Product not found or not active' });
      }

      // Get product variants and validate selections
      const variants = getProductVariants(product_id);
      const parsedVariants = selected_variants || {};
      
      if (variants.length > 0) {
        const validationErrors = validateVariantSelections(product_id, parsedVariants, variants);
        if (validationErrors.length > 0) {
          return res.status(400).json({ error: 'Variant validation failed', details: validationErrors });
        }

        // Check stock for variant combination
        if (Object.keys(parsedVariants).length > 0) {
          const stockAvailable = checkVariantStock(product_id, parsedVariants);
          const qty = parseInt(quantity) || 1;
          if (stockAvailable < qty) {
            return res.status(400).json({ 
              error: 'Insufficient stock for selected variant combination',
              available: stockAvailable,
              requested: qty
            });
          }
        }
      }

      // Get platform fee rate
      const defaultFeeSetting = db.prepare("SELECT value FROM platform_settings WHERE key = ?").get('default_platform_fee_rate');
      const defaultFeeRate = defaultFeeSetting ? parseFloat(defaultFeeSetting.value) : 5;

      const effectivePlatformRate = product.platform_fee_rate_override != null
        ? product.platform_fee_rate_override
        : (req.user.platform_fee_rate_override != null
            ? req.user.platform_fee_rate_override
            : defaultFeeRate);

      const qty = parseInt(quantity) || 1;
      const unitPrice = product.price;
      const itemsTotal = unitPrice * qty;
      const totalAmount = itemsTotal + finalShipmentCost;
      const commissionAmount = itemsTotal * (product.marketer_commission_rate / 100);
      const platformFeeAmount = itemsTotal * (effectivePlatformRate / 100);

      // Create order
      const orderStmt = db.prepare(`
        INSERT INTO orders (marketer_id, client_name, client_phone, client_address, client_notes, city,
          total_amount, total_commission, total_platform_fee, shipment_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const orderResult = orderStmt.run(
        req.user.id, client_name, client_phone, client_address || null, client_notes || null, city || null,
        totalAmount, commissionAmount, platformFeeAmount, finalShipmentCost
      );

      // Create order item
      const itemStmt = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_amount,
          marketer_commission_rate, marketer_commission_amount, platform_fee_rate, platform_fee_amount, supplier_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const itemResult = itemStmt.run(
        orderResult.lastInsertRowid, product_id, qty, unitPrice, totalAmount,
        product.marketer_commission_rate, commissionAmount, effectivePlatformRate, platformFeeAmount, product.supplier_id
      );

      // Save variant selections
      if (variants.length > 0 && Object.keys(parsedVariants).length > 0) {
        saveOrderItemVariants(itemResult.lastInsertRowid, parsedVariants);
      }

      res.json({ message: 'Order submitted', order_id: orderResult.lastInsertRowid });

    } else {
      // Multi-product order
      if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'At least one product is required' });
      }

      if (!client_name || !client_phone) {
        return res.status(400).json({ error: 'Missing required fields: client_name, client_phone' });
      }

      // Get platform fee rate
      const defaultFeeSetting = db.prepare("SELECT value FROM platform_settings WHERE key = ?").get('default_platform_fee_rate');
      const defaultFeeRate = defaultFeeSetting ? parseFloat(defaultFeeSetting.value) : 5;

      let totalOrderAmount = 0;
      let totalCommission = 0;
      let totalPlatformFee = 0;
      const orderItems = [];

      // Validate all products and calculate totals
      let firstSupplierId = null;
      let firstSupplierName = null;
      
      for (const item of items) {
        const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = ?').get(item.product_id, 'active');
        if (!product) {
          return res.status(404).json({ error: `Product ID ${item.product_id} not found or not active` });
        }

        // Enforce single-supplier per order rule
        if (firstSupplierId === null) {
          firstSupplierId = product.supplier_id;
          firstSupplierName = product.supplier_name || db.prepare('SELECT name FROM users WHERE id = ?').get(product.supplier_id)?.name;
        } else if (product.supplier_id !== firstSupplierId) {
          const otherSupplierName = product.supplier_name || db.prepare('SELECT name FROM users WHERE id = ?').get(product.supplier_id)?.name;
          return res.status(400).json({ 
            error: `All products in one order must be from the same supplier. Product "${product.name}" is from "${otherSupplierName}" but current order is for "${firstSupplierName}". Please create a separate order for products from different suppliers.`
          });
        }

        // Validate variants if product has them
        const variants = getProductVariants(item.product_id);
        const selectedVariants = item.selected_variants || {};
        
        if (variants.length > 0) {
          const validationErrors = validateVariantSelections(item.product_id, selectedVariants, variants);
          if (validationErrors.length > 0) {
            return res.status(400).json({ 
              error: `Variant validation failed for product "${product.name}"`, 
              details: validationErrors 
            });
          }

          // Check stock for variant combination
          if (Object.keys(selectedVariants).length > 0) {
            const stockAvailable = checkVariantStock(item.product_id, selectedVariants);
            const qty = parseInt(item.quantity) || 1;
            if (stockAvailable < qty) {
              return res.status(400).json({ 
                error: `Insufficient stock for selected variant combination for product "${product.name}"`,
                available: stockAvailable,
                requested: qty
              });
            }
          }
        }

        const effectivePlatformRate = product.platform_fee_rate_override
          ?? req.user.platform_fee_rate_override
          ?? defaultFeeRate;

        const qty = parseInt(item.quantity) || 1;
        const unitPrice = parseFloat(item.price) || product.price;
        const itemTotal = unitPrice * qty;
        const commissionAmount = itemTotal * (product.marketer_commission_rate / 100);
        const platformFeeAmount = itemTotal * (effectivePlatformRate / 100);

        totalOrderAmount += itemTotal;
        totalCommission += commissionAmount;
        totalPlatformFee += platformFeeAmount;

        orderItems.push({
          product_id: item.product_id,
          quantity: qty,
          unit_price: unitPrice,
          total_amount: itemTotal,
          marketer_commission_rate: product.marketer_commission_rate,
          marketer_commission_amount: commissionAmount,
          platform_fee_rate: effectivePlatformRate,
          platform_fee_amount: platformFeeAmount,
          supplier_id: product.supplier_id,
          selected_variants: selectedVariants
        });
      }

      // Calculate shipping cost (filter by supplier)
      const shipmentCost = parseFloat(shipment_cost) || 0;
      let finalShipmentCost = shipmentCost;
      if (!shipmentCost && city && firstSupplierId) {
        const shippingRate = db.prepare('SELECT cost FROM shipping_rates WHERE city = ? AND supplier_id = ? AND is_active = 1').get(city, firstSupplierId);
        if (shippingRate) {
          finalShipmentCost = shippingRate.cost;
        }
      }

      // Create order with shipping cost added to total
      const orderStmt = db.prepare(`
        INSERT INTO orders (marketer_id, client_name, client_phone, client_address, client_notes, city,
          total_amount, total_commission, total_platform_fee, shipment_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const orderResult = orderStmt.run(
        req.user.id, client_name, client_phone, client_address || null, client_notes || null, city || null,
        totalOrderAmount + finalShipmentCost, totalCommission, totalPlatformFee, finalShipmentCost
      );

      // Create all order items
      const itemStmt = db.prepare(`
        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_amount,
          marketer_commission_rate, marketer_commission_amount, platform_fee_rate, platform_fee_amount, supplier_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const item of orderItems) {
        const itemResult = itemStmt.run(
          orderResult.lastInsertRowid, item.product_id, item.quantity, item.unit_price, item.total_amount,
          item.marketer_commission_rate, item.marketer_commission_amount, item.platform_fee_rate, item.platform_fee_amount, item.supplier_id
        );
        
        // Save variant selections if present
        if (Object.keys(item.selected_variants).length > 0) {
          saveOrderItemVariants(itemResult.lastInsertRowid, item.selected_variants);
        }
      }

      res.json({ message: 'Order submitted', order_id: orderResult.lastInsertRowid });
    }
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to submit order' });
  }
});

// GET /api/orders - List orders (role-filtered)
router.get('/', verifyToken, (req, res) => {
  try {
    const statusFilter = req.query.status;
    let query = '';
    let params = [];

    if (req.user.role === 'marketer') {
      query = statusFilter
        ? `SELECT o.*, u_m.name as marketer_name, u_m.email as marketer_email
           FROM orders o
           JOIN users u_m ON o.marketer_id = u_m.id
           WHERE o.marketer_id = ? AND o.status = ?
           ORDER BY o.created_at DESC`
        : `SELECT o.*, u_m.name as marketer_name, u_m.email as marketer_email
           FROM orders o
           JOIN users u_m ON o.marketer_id = u_m.id
           WHERE o.marketer_id = ?
           ORDER BY o.created_at DESC`;
      params = statusFilter ? [req.user.id, statusFilter] : [req.user.id];
    } else if (req.user.role === 'supplier') {
      query = statusFilter
        ? `SELECT DISTINCT o.*, u_m.name as marketer_name, u_m.email as marketer_email
           FROM orders o
           JOIN order_items oi ON o.id = oi.order_id
           JOIN users u_m ON o.marketer_id = u_m.id
           WHERE oi.supplier_id = ? AND o.status = ?
           ORDER BY o.created_at DESC`
        : `SELECT DISTINCT o.*, u_m.name as marketer_name, u_m.email as marketer_email
           FROM orders o
           JOIN order_items oi ON o.id = oi.order_id
           JOIN users u_m ON o.marketer_id = u_m.id
           WHERE oi.supplier_id = ?
           ORDER BY o.created_at DESC`;
      params = statusFilter ? [req.user.id, statusFilter] : [req.user.id];
    } else if (req.user.role === 'superadmin') {
      query = statusFilter
        ? `SELECT o.*, u_m.name as marketer_name, u_s.name as supplier_name
           FROM orders o
           JOIN users u_m ON o.marketer_id = u_m.id
           LEFT JOIN order_items oi ON oi.order_id = o.id
           LEFT JOIN users u_s ON oi.supplier_id = u_s.id
           WHERE o.status = ?
           GROUP BY o.id
           ORDER BY o.created_at DESC`
        : `SELECT o.*, u_m.name as marketer_name, u_s.name as supplier_name
           FROM orders o
           JOIN users u_m ON o.marketer_id = u_m.id
           LEFT JOIN order_items oi ON oi.order_id = o.id
           LEFT JOIN users u_s ON oi.supplier_id = u_s.id
           GROUP BY o.id
           ORDER BY o.created_at DESC`;
      params = statusFilter ? [statusFilter] : [];
    } else {
      return res.status(403).json({ error: 'Invalid role' });
    }

    const orders = db.prepare(query).all(...params);

    // Get order items for each order
    for (const order of orders) {
      order.items = db.prepare(`
        SELECT oi.*, p.name as product_name, u_s.name as supplier_name
        FROM order_items oi
        JOIN products p ON oi.product_id = p.id
        JOIN users u_s ON oi.supplier_id = u_s.id
        WHERE oi.order_id = ?
        ORDER BY oi.id
      `).all(order.id);
      
      // Get variant selections for each item
      for (const item of order.items) {
        item.variants = getOrderItemVariants(item.id);
      }
    }

    res.json(orders);
  } catch (error) {
    console.error('List orders error:', error);
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// GET /api/orders/:id - Get single order detail
router.get('/:id', verifyToken, (req, res) => {
  try {
    const order = db.prepare(`
      SELECT o.*, u_m.name as marketer_name, u_m.email as marketer_email
      FROM orders o
      JOIN users u_m ON o.marketer_id = u_m.id
      WHERE o.id = ?
    `).get(req.params.id);

    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check if user has access (marketer or any supplier in the order)
    const orderItems = db.prepare(`
      SELECT supplier_id FROM order_items WHERE order_id = ?
    `).all(req.params.id);

    const supplierIds = orderItems.map(item => item.supplier_id);
    
    if (req.user.role !== 'superadmin' && 
        order.marketer_id !== req.user.id && 
        !supplierIds.includes(req.user.id)) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get order items with product details
    order.items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.description as product_description,
        u_s.name as supplier_name, u_s.email as supplier_email
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      JOIN users u_s ON oi.supplier_id = u_s.id
      WHERE oi.order_id = ?
      ORDER BY oi.id
    `).all(req.params.id);
    
    // Get variant selections for each item
    for (const item of order.items) {
      item.variants = getOrderItemVariants(item.id);
    }

    res.json(order);
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// POST /api/orders/:id/items - Add items to existing order
router.post('/:id/items', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'marketer') {
      return res.status(403).json({ error: 'Only marketers can add items to orders' });
    }

    const orderId = req.params.id;
    const { items } = req.body;

    // Check if order exists and belongs to marketer
    const order = db.prepare('SELECT * FROM orders WHERE id = ? AND marketer_id = ?').get(orderId, req.user.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found or not authorized' });
    }

    // Only allow adding items to pending orders
    if (order.status !== 'pending') {
      return res.status(400).json({ error: 'Can only add items to pending orders' });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one product is required' });
    }

    // Get platform fee rate
    const defaultFeeSetting = db.prepare("SELECT value FROM platform_settings WHERE key = ?").get('default_platform_fee_rate');
    const defaultFeeRate = defaultFeeSetting ? parseFloat(defaultFeeSetting.value) : 5;

    let addedAmount = 0;
    let addedCommission = 0;
    let addedPlatformFee = 0;

    // Get existing order supplier
    const existingItems = db.prepare('SELECT DISTINCT supplier_id FROM order_items WHERE order_id = ?').all(orderId);
    const existingSupplierId = existingItems.length > 0 ? existingItems[0].supplier_id : null;

    const itemStmt = db.prepare(`
      INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_amount,
        marketer_commission_rate, marketer_commission_amount, platform_fee_rate, platform_fee_amount, supplier_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Add each item
    for (const item of items) {
      const product = db.prepare('SELECT * FROM products WHERE id = ? AND status = ?').get(item.product_id, 'active');
      if (!product) {
        return res.status(404).json({ error: `Product ID ${item.product_id} not found or not active` });
      }

      // Enforce single-supplier per order rule
      if (existingSupplierId && product.supplier_id !== existingSupplierId) {
        const existingSupplierName = db.prepare('SELECT name FROM users WHERE id = ?').get(existingSupplierId)?.name || 'current supplier';
        const newSupplierName = product.supplier_name || db.prepare('SELECT name FROM users WHERE id = ?').get(product.supplier_id)?.name;
        return res.status(400).json({ 
          error: `Cannot add products from different suppliers to the same order. This order is for "${existingSupplierName}" but "${product.name}" is from "${newSupplierName}". Please create a separate order.`
        });
      }

      const effectivePlatformRate = product.platform_fee_rate_override != null
        ? product.platform_fee_rate_override
        : (req.user.platform_fee_rate_override != null
            ? req.user.platform_fee_rate_override
            : defaultFeeRate);

      const qty = parseInt(item.quantity) || 1;
      const unitPrice = parseFloat(item.price) || product.price;
      const itemTotal = unitPrice * qty;
      const commissionAmount = itemTotal * (product.marketer_commission_rate / 100);
      const platformFeeAmount = itemTotal * (effectivePlatformRate / 100);

      addedAmount += itemTotal;
      addedCommission += commissionAmount;
      addedPlatformFee += platformFeeAmount;

      itemStmt.run(
        orderId, item.product_id, qty, unitPrice, itemTotal,
        product.marketer_commission_rate, commissionAmount, effectivePlatformRate, platformFeeAmount, product.supplier_id
      );
    }

    // Update order totals
    db.prepare(`
      UPDATE orders 
      SET total_amount = total_amount + ?,
          total_commission = total_commission + ?,
          total_platform_fee = total_platform_fee + ?,
          updated_at = datetime('now')
      WHERE id = ?
    `).run(addedAmount, addedCommission, addedPlatformFee, orderId);

    res.json({ 
      message: 'Items added to order', 
      order_id: orderId,
      added_items: items.length,
      new_total: order.total_amount + addedAmount
    });

  } catch (error) {
    console.error('Add items to order error:', error);
    res.status(500).json({ error: 'Failed to add items to order' });
  }
});
router.patch('/:id/status', verifyToken, (req, res) => {
  try {
    if (req.user.role !== 'supplier' && req.user.role !== 'superadmin') {
      return res.status(403).json({ error: 'Only suppliers or superadmin can update order status' });
    }

    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Check if supplier is authorized (must have items in this order)
    if (req.user.role === 'supplier') {
      const orderItems = db.prepare('SELECT supplier_id FROM order_items WHERE order_id = ?').get(req.params.id);
      if (!orderItems || orderItems.supplier_id !== req.user.id) {
        // For multi-product orders, check if supplier has any items
        const hasItems = db.prepare(`
          SELECT COUNT(*) as count FROM order_items 
          WHERE order_id = ? AND supplier_id = ?
        `).get(req.params.id, req.user.id);
        
        if (hasItems.count === 0) {
          return res.status(403).json({ error: 'Not authorized to update this order' });
        }
      }
    }

    const { status, supplier_note } = req.body;

    // Validate status transitions - more flexible for suppliers
    const validTransitions = {
      'pending': ['confirmed', 'shipped', 'delivered', 'completed', 'rejected', 'cancelled'],
      'confirmed': ['shipped', 'delivered', 'completed', 'rejected', 'cancelled'],
      'shipped': ['delivered', 'completed', 'rejected', 'cancelled'],
      'delivered': ['completed', 'cancelled'],
      'completed': ['delivered', 'shipped', 'confirmed', 'cancelled'],
      'rejected': [],
      'cancelled': ['pending'] // Allow re-activation
    };

    if (!validTransitions[order.status] || !validTransitions[order.status].includes(status)) {
      console.log(`Invalid transition attempt: Order ${order.id} from '${order.status}' to '${status}'`);
      console.log('Valid transitions from', order.status, ':', validTransitions[order.status]);
      return res.status(400).json({ error: `Cannot transition from '${order.status}' to '${status}'` });
    }

    // On confirmation, calculate commissions from order items
    if (status === 'confirmed') {
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      
      let totalCommission = 0;
      let totalPlatformFee = 0;

      // Process each order item
      for (const item of orderItems) {
        let commissionAmount = parseFloat(item.marketer_commission_amount || 0);
        let platformFeeAmount = parseFloat(item.platform_fee_amount || 0);
        
        // Fallback: calculate if not stored
        if (commissionAmount === 0 && item.marketer_commission_rate) {
          commissionAmount = parseFloat(item.total_amount) * (parseFloat(item.marketer_commission_rate) / 100);
        }
        if (platformFeeAmount === 0 && item.platform_fee_rate) {
          platformFeeAmount = parseFloat(item.total_amount) * (parseFloat(item.platform_fee_rate) / 100);
        }
        
        totalCommission += commissionAmount;
        totalPlatformFee += platformFeeAmount;
      }

      db.prepare(`
        UPDATE orders SET 
          status = ?, 
          supplier_note = ?, 
          total_commission = ?, 
          total_platform_fee = ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).run(status, supplier_note || null, totalCommission, totalPlatformFee, req.params.id);

    } else if (status === 'completed') {
      // When order is completed, calculate final commissions and platform fees from order items
      const orderItems = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(req.params.id);
      
      let totalCommission = 0;
      let totalPlatformFee = 0;

      // Process each order item
      for (const item of orderItems) {
        let commissionAmount = parseFloat(item.marketer_commission_amount || 0);
        let platformFeeAmount = parseFloat(item.platform_fee_amount || 0);
        
        // Fallback: calculate if not stored
        if (commissionAmount === 0 && item.marketer_commission_rate) {
          commissionAmount = parseFloat(item.total_amount) * (parseFloat(item.marketer_commission_rate) / 100);
        }
        if (platformFeeAmount === 0 && item.platform_fee_rate) {
          platformFeeAmount = parseFloat(item.total_amount) * (parseFloat(item.platform_fee_rate) / 100);
        }
        
        totalCommission += commissionAmount;
        totalPlatformFee += platformFeeAmount;

        // Create commission record if not exists
        const existingCommission = db.prepare('SELECT id FROM commissions WHERE order_item_id = ?').get(item.id);
        if (!existingCommission) {
          db.prepare(`
            INSERT INTO commissions (order_id, order_item_id, product_id, marketer_id, amount, status, created_at)
            VALUES (?, ?, ?, ?, ?, 'approved', datetime('now'))
          `).run(req.params.id, item.id, item.product_id, order.marketer_id, commissionAmount);
          
          // Add commission amount to marketer's balance
          db.prepare('UPDATE users SET balance = balance + ? WHERE id = ?').run(commissionAmount, order.marketer_id);
        }

        // Reduce product stock when order is completed
        const productStock = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(item.product_id);
        if (productStock && productStock.stock_quantity > 0) {
          const newStock = Math.max(0, productStock.stock_quantity - item.quantity);
          db.prepare('UPDATE products SET stock_quantity = ? WHERE id = ?').run(newStock, item.product_id);
        }
        
        // Deduct variant stock if variants were selected
        const itemVariants = getOrderItemVariants(item.id);
        if (itemVariants.length > 0) {
          const selectedVariants = {};
          itemVariants.forEach(v => {
            selectedVariants[v.variant_name] = v.variant_value;
          });
          const deductResult = deductVariantStock(item.product_id, selectedVariants, item.quantity);
          if (!deductResult.success) {
            console.warn(`Failed to deduct variant stock for order item ${item.id}:`, deductResult.error);
          }
        }
      }

      // Update order with calculated totals
      db.prepare(`
        UPDATE orders SET 
          status = ?, 
          supplier_note = ?, 
          total_commission = ?, 
          total_platform_fee = ?,
          updated_at = datetime('now') 
        WHERE id = ?
      `).run(status, supplier_note || null, totalCommission, totalPlatformFee, req.params.id);

    } else {
      db.prepare(`
        UPDATE orders SET status = ?, supplier_note = ?, updated_at = datetime('now') WHERE id = ?
      `).run(status, supplier_note || null, req.params.id);
    }

    res.json({ message: 'Order status updated' });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});


module.exports = router;
