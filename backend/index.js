require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();

// Security headers for Firebase auth popup to work
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Cross-Origin-Embedder-Policy', 'unsafe-none');
  next();
});

app.use(cors({ origin: function(origin, callback) {
  // Allow all origins in production (Render)
  callback(null, true);
}, credentials: true }));
app.use(express.json());

// Serve uploaded product images as static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Health check endpoint - monitor database state
app.get('/api/health', (req, res) => {
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users').get();
    const products = db.prepare('SELECT COUNT(*) as count FROM products').get();
    const activeProducts = db.prepare("SELECT COUNT(*) as count FROM products WHERE status = 'active' OR status IS NULL").get();
    const orders = db.prepare('SELECT COUNT(*) as count FROM orders').get();
    const images = db.prepare('SELECT COUNT(*) as count FROM product_images').get();
    
    // Get recent products (last 5)
    const recentProducts = db.prepare('SELECT id, name, supplier_id, status, created_at FROM products ORDER BY created_at DESC LIMIT 5').all();
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        users: users.count,
        products: products.count,
        activeProducts: activeProducts.count,
        orders: orders.count,
        images: images.count
      },
      recentProducts: recentProducts
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: error.message });
  }
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/commissions', require('./routes/commissions'));
app.use('/api/withdrawals', require('./routes/withdrawals'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/payment-methods', require('./routes/paymentMethods'));
app.use('/api/supplier/payments', require('./routes/supplierPayments'));
app.use('/api/shipping-rates', require('./routes/shippingRates'));
app.use('/api/cities', require('./routes/cities'));
app.use('/api/variants', require('./routes/variants'));
app.use('/api/admin', require('./routes/admin'));

// SEO Sitemap (public endpoint)
app.use('/sitemap.xml', require('./routes/sitemap'));
app.use('/sitemap-product-images.xml', require('./routes/sitemap'));

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle SPA routing - serve index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Partnerza running on port ${PORT}`));