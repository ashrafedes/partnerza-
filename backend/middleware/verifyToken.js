const admin = require('../firebase-admin');
const db = require('../db');
const jwt = require('jsonwebtoken');

const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    console.log('Token received:', token.substring(0, 20) + '...');
    
    // Check if it's a JWT token (from email/password login)
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key');
      console.log('JWT decoded:', decoded);
      // JWT token is valid, get user from database
      const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
      if (!user) {
        console.log('User not found for ID:', decoded.id);
        return res.status(403).json({ error: 'User not found' });
      }
      console.log('User found from JWT:', user.id, 'role:', user.role);
      req.user = user;
      return next();
    } catch (jwtErr) {
      console.log('Not a valid JWT, trying other methods...');
      // Not a valid JWT token, try Firebase or demo tokens
    }
    
    // Check for demo tokens FIRST (before Firebase verification)
    const demoTokens = {
      'demo-admin-token': 'demo-admin',
      'demo-supplier-token': 'demo-supplier',
      'demo-marketer-token': 'demo-marketer',
      'demo-firebase-token': 'demo-marketer'
    };
    
    if (demoTokens[token]) {
      const demoUserId = demoTokens[token];
      console.log('Demo token detected, looking up user:', demoUserId);
      // Look up or create demo user in SQLite
      let user = db.prepare('SELECT * FROM users WHERE id = ?').get(demoUserId);
      
      if (!user) {
        // Create demo user if not exists
        const demoUsers = {
          'demo-admin': { name: 'Demo Admin', email: 'admin@partnerza.com', role: 'superadmin', phone: '966500000001', whatsapp: '966500000001' },
          'demo-supplier': { name: 'Demo Supplier', email: 'supplier@partnerza.com', role: 'supplier', phone: '966500000002', whatsapp: '966500000002' },
          'demo-marketer': { name: 'Demo Marketer', email: 'marketer@partnerza.com', role: 'marketer', phone: '966500000003', whatsapp: '966500000003' }
        };
        
        const userData = demoUsers[demoUserId];
        if (userData) {
          console.log('Creating demo user:', demoUserId, userData);
          const stmt = db.prepare('INSERT INTO users (id, name, email, role, phone, whatsapp) VALUES (?, ?, ?, ?, ?, ?)');
          stmt.run(demoUserId, userData.name, userData.email, userData.role, userData.phone, userData.whatsapp);
          user = db.prepare('SELECT * FROM users WHERE id = ?').get(demoUserId);
          console.log('Demo user created:', user);
        }
      }
      
      if (user) {
        req.user = user;
        console.log('Demo user set in req.user:', user.id);
        return next();
      }
    }
    
    // Check if Firebase is disabled or not configured
    const isFirebaseDisabled = process.env.FIREBASE_DISABLED === 'true';
    const isFirebaseConfigured = 
      !isFirebaseDisabled &&
      process.env.FIREBASE_PRIVATE_KEY && 
      process.env.FIREBASE_PRIVATE_KEY !== '"-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n"' &&
      process.env.FIREBASE_CLIENT_EMAIL && 
      process.env.FIREBASE_CLIENT_EMAIL !== 'firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com';
    
    if (!isFirebaseConfigured) {
      console.log('Firebase not configured, rejecting token');
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    // Production mode: verify Firebase token
    console.log('Verifying Firebase token...');
    const decodedToken = await admin.auth().verifyIdToken(token);
    const uid = decodedToken.uid;
    console.log('Firebase token verified, UID:', uid);
    
    // Look up user in SQLite
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(uid);
    
    if (!user) {
      console.log('User not found for Firebase UID:', uid);
      return res.status(403).json({ error: 'User not registered' });
    }
    
    console.log('User found from Firebase:', user.id, 'role:', user.role);
    req.user = user;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    // Provide more specific error message based on error type
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ error: 'Token expired. Please refresh and try again.' });
    } else if (error.code === 'auth/argument-error') {
      return res.status(401).json({ error: 'Invalid token format. Please sign in again.' });
    } else if (error.code === 'auth/invalid-credential') {
      return res.status(401).json({ error: 'Firebase credentials invalid. Check backend configuration.' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based access control middleware
const requireRole = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
};

module.exports = { verifyToken, requireRole };