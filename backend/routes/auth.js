const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const admin = require('../firebase-admin');
const { verifyToken, requireRole } = require('../middleware/verifyToken');

// POST /api/auth/login - Login with email/password OR Firebase ID token
router.post('/login', async (req, res) => {
  try {
    const { email, password, idToken } = req.body;
    
    console.log('Login attempt:', { email, passwordProvided: !!password, idTokenProvided: !!idToken });
    
    let user = null;
    let firebaseUid = null;
    let userEmail = email;
    let userName = null;
    
    // If Firebase ID token provided, verify it first
    if (idToken) {
      try {
        console.log('Verifying Firebase ID token...');
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        firebaseUid = decodedToken.uid;
        userEmail = decodedToken.email;
        userName = decodedToken.name || decodedToken.email?.split('@')[0] || 'User';
        console.log('Firebase token verified:', { uid: firebaseUid, email: userEmail });
        
        // Look up user in SQLite by Firebase UID or email
        user = db.prepare('SELECT * FROM users WHERE id = ? OR email = ?').get(firebaseUid, userEmail);
        
        // If user not found in SQLite, auto-create from Firebase data
        if (!user) {
          console.log('User not found in SQLite, auto-creating...');
          const stmt = db.prepare(`
            INSERT INTO users (id, name, email, role, phone, whatsapp, country, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(firebaseUid, userName, userEmail, 'marketer', '', '', 'Egypt', null);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(firebaseUid);
          console.log('Auto-created user in SQLite:', user);
        }
      } catch (firebaseErr) {
        console.error('Firebase token verification failed:', firebaseErr.message);
        if (firebaseErr.message && firebaseErr.message.includes('configuration')) {
          return res.status(401).json({ error: 'Firebase not configured on server. Please contact admin or use demo login.' });
        }
        return res.status(401).json({ error: 'Invalid Firebase token' });
      }
    } else if (email && password) {
      // Traditional email/password login
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      console.log('User lookup result:', { found: !!user, userId: user?.id, hasPasswordHash: !!user?.password_hash });
      
      if (!user) {
        console.log('Login failed: User not found for email:', email);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
      
      if (!user.password_hash) {
        console.log('Login failed: No password hash for user:', user.id);
        return res.status(401).json({ error: 'Password not set for this account. Use Google login or contact admin.' });
      }
      
      const valid = await bcrypt.compare(password, user.password_hash);
      console.log('Password comparison result:', valid);
      
      if (!valid) {
        console.log('Login failed: Invalid password for user:', user.id);
        return res.status(401).json({ error: 'Invalid email or password' });
      }
    } else {
      return res.status(400).json({ error: 'Email and password required, or provide Firebase ID token' });
    }
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    console.log('Login successful for user:', user.id);
    
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