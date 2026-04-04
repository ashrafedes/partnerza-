import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import api from '../api/axios';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for JWT token from email/password login
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('demoUser');
    
    // Also check sessionStorage for session-only login
    const sessionToken = sessionStorage.getItem('token');
    const sessionUser = sessionStorage.getItem('demoUser');
    
    const useToken = token || sessionToken;
    const useUser = savedUser || sessionUser;
    
    // Track if we restored from storage - used to prevent Firebase from clearing valid session
    let restoredFromStorage = false;
    
    if (useToken && useUser) {
      // Restore session from stored data
      try {
        const parsedUser = JSON.parse(useUser);
        setUser(parsedUser);
        setRole(parsedUser.role);
        restoredFromStorage = true;
        console.log('AuthContext: Restored user from storage:', parsedUser.id);
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('demoUser');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('demoUser');
      }
    }
    
    // Check if we're in demo mode
    const isDemoMode = window.location.hostname === 'localhost' && !auth.currentUser;
    
    if (isDemoMode) {
      // Demo mode: check for demo user in localStorage
      const savedDemoUser = localStorage.getItem('demoUser');
      if (savedDemoUser) {
        try {
          const parsedUser = JSON.parse(savedDemoUser);
          setUser(parsedUser);
          setRole(parsedUser.role);
        } catch (error) {
          console.error('Failed to parse demo user:', error);
          localStorage.removeItem('demoUser');
        }
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('AuthContext: Firebase state changed, user:', firebaseUser?.uid || 'null');
      
      if (firebaseUser) {
        // Firebase user is logged in - fetch profile and update
        try {
          const { data } = await api.get('/api/auth/me');
          const userData = data.user || data;
          setUser(userData);
          setRole(userData.role);
          
          // Save to sessionStorage for persistence
          sessionStorage.setItem('token', await firebaseUser.getIdToken());
          sessionStorage.setItem('demoUser', JSON.stringify(userData));
          console.log('AuthContext: Updated from Firebase:', userData.id);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          // Only clear if auth error and we weren't restored from storage
          if ((error.response?.status === 401 || error.response?.status === 403) && !restoredFromStorage) {
            setUser(null);
            setRole(null);
          }
        }
      } else {
        // No Firebase user - ONLY clear if we weren't restored from storage
        // This prevents Firebase overwriting a valid JWT/email session on refresh
        if (!restoredFromStorage) {
          console.log('AuthContext: No Firebase user and no stored session - clearing');
          setUser(null);
          setRole(null);
        } else {
          console.log('AuthContext: No Firebase user but stored session exists - keeping session');
        }
      }
      setLoading(false);
    });

    // If restored from storage, ensure loading is set to false after a delay
    // in case Firebase listener takes too long
    if (restoredFromStorage) {
      setTimeout(() => {
        setLoading(false);
      }, 500);
    }

    return () => unsubscribe();
  }, []);

  // Update role when user changes
  useEffect(() => {
    if (user) {
      setRole(user.role);
    } else {
      setRole(null);
    }
  }, [user]);

  const logout = async () => {
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
    } catch (e) {
      console.error('Sign out error:', e);
    }
    setUser(null);
    setRole(null);
    localStorage.removeItem('token');
    localStorage.removeItem('demoUser');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('demoUser');
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ user, role, loading, logout, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}