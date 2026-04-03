import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyDhofDHaUFJPiFY2jOzkG9Jfs2chOUFqAA",
  authDomain: "partnerza.onrender.com",
  projectId: "partnerza",
  storageBucket: "partnerza.firebasestorage.app",
  messagingSenderId: "904830444554",
  appId: "1:904830444554:web:44187bddae99e3889debf3",
  measurementId: "G-6C4LZZKH6P"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const auth = getAuth(app);
