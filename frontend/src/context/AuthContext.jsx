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
    // First, check for JWT token from email/password login
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('demoUser');
    
    if (token && savedUser) {
      // Restore session from stored data
      try {
        const user = JSON.parse(savedUser);
        setUser(user);
        setRole(user.role);
        setLoading(false);
        return;
      } catch (error) {
        console.error('Failed to parse saved user:', error);
        localStorage.removeItem('token');
        localStorage.removeItem('demoUser');
      }
    }
    
    // Check if we're in demo mode
    const isDemoMode = window.location.hostname === 'localhost' && !auth.currentUser;
    
    if (isDemoMode) {
      // Demo mode: check for demo user in localStorage
      const savedDemoUser = localStorage.getItem('demoUser');
      if (savedDemoUser) {
        try {
          const user = JSON.parse(savedDemoUser);
          setUser(user);
          setRole(user.role);
        } catch (error) {
          console.error('Failed to parse demo user:', error);
          localStorage.removeItem('demoUser');
        }
      }
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const { data } = await api.get('/api/auth/me');
          const userData = data.user || data;
          setUser(userData);
          setRole(userData.role);
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
          setUser(null);
          setRole(null);
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

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
    sessionStorage.removeItem('sessionOnly');
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