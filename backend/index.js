require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

// Security headers for Firebase auth popup to work
app.use((req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
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