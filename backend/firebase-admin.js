const admin = require('firebase-admin');
require('dotenv').config();

// Check if Firebase is disabled
if (process.env.FIREBASE_DISABLED === 'true') {
  console.log('Firebase authentication is disabled. Running in development mode without Firebase authentication.');
  // Create a mock admin object for development
  admin.auth = () => ({
    verifyIdToken: () => Promise.resolve({ uid: 'dev-user-id' }),
    createUser: () => Promise.resolve({ uid: 'dev-user-id' }),
  });
  module.exports = admin;
  return;
}

// Check if Firebase credentials are properly configured
const hasFirebaseConfig = 
  process.env.FIREBASE_PROJECT_ID && 
  process.env.FIREBASE_PROJECT_ID !== 'your_firebase_project_id' &&
  process.env.FIREBASE_PRIVATE_KEY && 
  process.env.FIREBASE_PRIVATE_KEY !== '"-----BEGIN PRIVATE KEY-----\\nYOUR_PRIVATE_KEY_HERE\\n-----END PRIVATE KEY-----\\n"' &&
  process.env.FIREBASE_CLIENT_EMAIL && 
  process.env.FIREBASE_CLIENT_EMAIL !== 'firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com';

if (hasFirebaseConfig) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    };

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Firebase Admin initialized with credentials');
  } catch (error) {
    console.warn('Failed to initialize Firebase Admin:', error.message);
    console.warn('Running in development mode without Firebase authentication');
    // Create a mock admin object for development
    admin.auth = () => ({
      verifyIdToken: () => Promise.resolve({ uid: 'dev-user-id' }),
      createUser: () => Promise.resolve({ uid: 'dev-user-id' }),
    });
  }
} else {
  console.log('Firebase credentials not configured. Running in development mode.');
  console.log('To enable Firebase authentication, update backend/.env with your Firebase credentials.');
  // Create a mock admin object for development
  admin.auth = () => ({
    verifyIdToken: () => Promise.resolve({ uid: 'dev-user-id' }),
    createUser: () => Promise.resolve({ uid: 'dev-user-id' }),
  });
}

module.exports = admin;