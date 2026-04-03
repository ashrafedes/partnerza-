import axios from 'axios';
import { auth } from '../firebase';
import { onAuthStateChanged } from 'firebase/auth';

const api = axios.create({
  baseURL: '',  // Empty = same host (relative URLs)
});

// Promise that resolves when Firebase auth state is determined
let authReadyPromise = null;
let authStateResolved = false;

function getAuthReadyPromise() {
  if (!authReadyPromise) {
    authReadyPromise = new Promise((resolve) => {
      if (authStateResolved) {
        resolve();
      } else {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          authStateResolved = true;
          unsubscribe();
          resolve();
        });
      }
    });
  }
  return authReadyPromise;
}

api.interceptors.request.use(async (config) => {
  // Check if Authorization header is already explicitly set (case-insensitive)
  const hasAuthHeader = Object.keys(config.headers || {}).some(
    key => key.toLowerCase() === 'authorization' && config.headers[key]
  );
  
  if (hasAuthHeader) {
    return config;
  }

  // Check for demo user in localStorage first (for demo mode)
  const demoUser = JSON.parse(localStorage.getItem('demoUser') || 'null');
  
  if (demoUser && demoUser.email && demoUser.email.includes('@partnerza.com')) {
    // Demo mode: use demo token based on user role
    let demoToken = 'demo-firebase-token'; // default
    
    if (demoUser.email === 'admin@partnerza.com') {
      demoToken = 'demo-admin-token';
    } else if (demoUser.email === 'supplier@partnerza.com') {
      demoToken = 'demo-supplier-token';
    } else if (demoUser.email === 'marketer@partnerza.com') {
      demoToken = 'demo-marketer-token';
    }
    
    config.headers.Authorization = `Bearer ${demoToken}`;
  } else {
    // Wait for Firebase auth to be ready, then get token
    await getAuthReadyPromise();
    
    if (auth.currentUser) {
      try {
        const token = await auth.currentUser.getIdToken(true);
        config.headers.Authorization = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get Firebase token:', error);
      }
    }
  }
  
  return config;
});

export default api;