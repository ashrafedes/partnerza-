const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { verifyToken, requireRole } = require('../middleware/verifyToken');

// POST /api/auth/login - Login with email/password (for dev mode)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    // Find user by email
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Check if user has a password set
    if (!user.password_hash) {
      return res.status(401).json({ error: 'Password not set for this account. Please contact admin.' });
    }
    
    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role,
        name: user.name 
      },
      process.env.JWT_SECRET || 'dev-secret-key',
      { expiresIn: '24h' }
    );
    
    res.json({ 
      token, 
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        phone: user.phone,
        whatsapp: user.whatsapp,
        country: user.country
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register - Register user profile in SQLite
router.post('/register', async (req, res) => {
  try {
    const { uid, name, email, role, phone, whatsapp, country, password } = req.body;
    
    if (!uid || !name || !email) {
      return res.status(400).json({ error: 'Missing required fields: uid, name, email' });
    }

    // Hash password if provided
    let passwordHash = null;
    if (password) {
      passwordHash = await bcrypt.hash(password, 10);
    }

    // Insert user (upsert - if uid exists, do nothing)
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO users (id, name, email, role, phone, whatsapp, country, password_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = stmt.run(uid, name, email, role || 'marketer', phone, whatsapp, country || 'Egypt', passwordHash);
    
    // Get the user (whether newly created or existing)
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    
    res.json({ message: 'User registered', user });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/me - Get current user profile
router.get('/me', verifyToken, (req, res) => {
  // Fetch full user data from database
  const user = db.prepare('SELECT id, name, email, role, phone, whatsapp, country, telegram, website, business_name, business_email, business_phone, preferred_city FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
});

// PATCH /api/auth/profile - Update current user profile
router.patch('/profile', verifyToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { name, phone, whatsapp, country, telegram, website, email, business_name, business_email, business_phone, preferred_city } = req.body;
    
    console.log('Profile update request:', { userId, name, phone, whatsapp, telegram, website, email, business_name, business_email, business_phone });
    
    // Build update query dynamically
    const updates = [];
    const values = [];
    
    if (name !== undefined && name !== '') {
      updates.push('name = ?');
      values.push(name);
    }
    if (email !== undefined && email !== '') {
      updates.push('email = ?');
      values.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      values.push(phone);
    }
    if (whatsapp !== undefined) {
      updates.push('whatsapp = ?');
      values.push(whatsapp);
    }
    if (country !== undefined) {
      updates.push('country = ?');
      values.push(country);
    }
    if (telegram !== undefined) {
      updates.push('telegram = ?');
      values.push(telegram);
    }
    if (website !== undefined) {
      updates.push('website = ?');
      values.push(website);
    }
    if (business_name !== undefined) {
      updates.push('business_name = ?');
      values.push(business_name);
    }
    if (business_email !== undefined) {
      updates.push('business_email = ?');
      values.push(business_email);
    }
    if (business_phone !== undefined) {
      updates.push('business_phone = ?');
      values.push(business_phone);
    }
    if (preferred_city !== undefined) {
      updates.push('preferred_city = ?');
      values.push(preferred_city);
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(userId);
    const query = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    console.log('Executing query:', query, 'with values:', values);
    
    const result = db.prepare(query).run(...values);
    console.log('Update result:', result);
    
    // Get updated user
    const user = db.prepare('SELECT id, name, email, role, phone, whatsapp, country, telegram, website, business_name, business_email, business_phone, preferred_city FROM users WHERE id = ?').get(userId);
    console.log('Updated user:', user);
    
    res.json({ message: 'Profile updated', user });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile', details: error.message });
  }
});

// PATCH /api/auth/preferred-city - Update user's preferred city
router.patch('/preferred-city', verifyToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { preferred_city } = req.body;
    
    if (!preferred_city) {
      return res.status(400).json({ error: 'preferred_city is required' });
    }
    
    db.prepare('UPDATE users SET preferred_city = ? WHERE id = ?').run(preferred_city, userId);
    
    const user = db.prepare('SELECT id, name, email, role, phone, whatsapp, country, telegram, website, business_name, business_email, business_phone, preferred_city FROM users WHERE id = ?').get(userId);
    
    res.json({ message: 'Preferred city updated', user });
  } catch (error) {
    console.error('Preferred city update error:', error);
    res.status(500).json({ error: 'Failed to update preferred city', details: error.message });
  }
});

// POST /api/auth/change-password - Change user password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    // Get user with password
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
    if (!user || !user.password_hash) {
      return res.status(400).json({ error: 'Password authentication not set up for this user' });
    }
    
    // Verify current password
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    
    // Update password
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
    
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;