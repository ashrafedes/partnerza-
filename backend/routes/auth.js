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
          
          // Check if a user with this email already exists (to preserve role)
          const existingUserByEmail = db.prepare('SELECT * FROM users WHERE email = ?').get(userEmail);
          const role = existingUserByEmail ? existingUserByEmail.role : 'marketer';
          const phone = existingUserByEmail ? existingUserByEmail.phone : '';
          const whatsapp = existingUserByEmail ? existingUserByEmail.whatsapp : '';
          const country = existingUserByEmail ? existingUserByEmail.country : 'Egypt';
          
          const stmt = db.prepare(`
            INSERT INTO users (id, name, email, role, phone, whatsapp, country, password_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `);
          stmt.run(firebaseUid, userName, userEmail, role, phone, whatsapp, country, null);
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
    
    // Get current user to preserve role
    const currentUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Build update query dynamically - NEVER update role through profile endpoint
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
    
    // Get updated user - preserve the existing role from database
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

// ========== ADMIN USER MANAGEMENT ENDPOINTS ==========

// GET /api/auth/users - Get all users (superadmin only) - from both Firebase and SQLite
router.get('/users', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    // Get SQLite users
    const sqliteUsers = db.prepare(`
      SELECT id, name, email, role, phone, whatsapp, country, preferred_city, business_name, telegram, website 
      FROM users 
    `).all();

    // Get Firebase users
    let firebaseUsers = [];
    try {
      const listUsersResult = await admin.auth().listUsers(1000);
      firebaseUsers = listUsersResult.users.map(user => ({
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email?.split('@')[0] || 'Unknown',
        phone: user.phoneNumber || ''
      }));
    } catch (firebaseErr) {
      console.error('Failed to fetch Firebase users:', firebaseErr.message);
    }

    // Merge users - Firebase users take precedence for name/email, SQLite for role and other fields
    const mergedUsers = firebaseUsers.map(fbUser => {
      const sqliteUser = sqliteUsers.find(sq => sq.id === fbUser.uid || sq.email === fbUser.email);
      if (sqliteUser) {
        return {
          ...sqliteUser,
          name: fbUser.name || sqliteUser.name,
          email: fbUser.email || sqliteUser.email,
          phone: fbUser.phone || sqliteUser.phone
        };
      }
      // Firebase-only user
      return {
        id: fbUser.uid,
        name: fbUser.name,
        email: fbUser.email,
        role: 'marketer', // Default role
        phone: fbUser.phone,
        whatsapp: '',
        country: '',
        preferred_city: '',
        business_name: '',
        telegram: '',
        website: ''
      };
    });

    // Add SQLite-only users (users not in Firebase - e.g., demo accounts)
    sqliteUsers.forEach(sqUser => {
      const exists = mergedUsers.find(u => u.id === sqUser.id || u.email === sqUser.email);
      if (!exists) {
        mergedUsers.push(sqUser);
      }
    });

    // Sort by role then name
    mergedUsers.sort((a, b) => {
      if (a.role !== b.role) {
        const roleOrder = { superadmin: 1, supplier: 2, marketer: 3 };
        return (roleOrder[a.role] || 3) - (roleOrder[b.role] || 3);
      }
      return (a.name || '').localeCompare(b.name || '');
    });

    res.json({ users: mergedUsers });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// DELETE /api/auth/users/:id - Delete user (superadmin only)
router.delete('/users/:id', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    
    // Don't allow deleting yourself
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    // Check if user exists
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Delete user from SQLite
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);
    
    // Try to delete from Firebase too (if it's a Firebase user)
    try {
      await admin.auth().deleteUser(userId);
    } catch (firebaseErr) {
      console.log('Firebase delete skipped (user may not exist in Firebase):', firebaseErr.message);
    }
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// PATCH /api/auth/users/:id/role - Update user role (superadmin only)
router.patch('/users/:id/role', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { role } = req.body;
    
    if (!role || !['superadmin', 'supplier', 'marketer'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be superadmin, supplier, or marketer' });
    }
    
    // Don't allow changing your own role
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot change your own role' });
    }
    
    let user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    
    // If user not in SQLite, check Firebase and auto-create
    if (!user) {
      try {
        const firebaseUser = await admin.auth().getUser(userId);
        // Auto-create user in SQLite
        const insertStmt = db.prepare(`
          INSERT INTO users (id, name, email, role, phone, whatsapp, country, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        insertStmt.run(
          userId,
          firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown',
          firebaseUser.email || '',
          role, // Set the new role
          firebaseUser.phoneNumber || '',
          '',
          'Egypt',
          'active'
        );
        console.log('Auto-created user in SQLite:', userId);
        // Fetch the newly created user
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
      } catch (firebaseErr) {
        console.error('User not found in Firebase either:', firebaseErr.message);
        return res.status(404).json({ error: 'User not found' });
      }
    } else {
      // User exists, update role
      db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, userId);
    }
    
    const updatedUser = db.prepare('SELECT id, name, email, role, phone, whatsapp, country FROM users WHERE id = ?').get(userId);
    res.json({ message: 'Role updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// POST /api/auth/users/:id/reset-password - Admin reset user password (superadmin only)
router.post('/users/:id/reset-password', verifyToken, requireRole('superadmin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const { newPassword } = req.body;
    
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Hash new password
    const newHash = await bcrypt.hash(newPassword, 10);
    
    // Update password in SQLite
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);
    
    // Try to update in Firebase too
    try {
      await admin.auth().updateUser(userId, { password: newPassword });
    } catch (firebaseErr) {
      console.log('Firebase password update skipped:', firebaseErr.message);
    }
    
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

module.exports = router;