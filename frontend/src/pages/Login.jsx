import React, { useState, useEffect } from 'react';
import { signInWithEmailAndPassword, signInWithRedirect, GoogleAuthProvider, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { setUser } = useAuth();

  // Handle redirect result from Google sign-in
  useEffect(() => {
    const handleRedirectResult = async () => {
      // Only run this once on mount
      if (sessionStorage.getItem('redirectHandled') === 'true') {
        return;
      }
      
      console.log('Checking for redirect result...');
      try {
        const result = await getRedirectResult(auth);
        console.log('Redirect result:', result);
        
        if (result && result.user) {
          console.log('User from redirect:', result.user.email);
          setLoading(true);
          sessionStorage.setItem('redirectHandled', 'true');
          
          let token;
          try {
            token = await result.user.getIdToken();
          } catch (tokenErr) {
            console.error('Failed to get token:', tokenErr);
            setError('Failed to get authentication token');
            setLoading(false);
            return;
          }
          
          console.log('Got token, calling /api/auth/me');
          
          let response;
          try {
            response = await api.get('/api/auth/me', {
              headers: { Authorization: `Bearer ${token}` }
            });
          } catch (apiErr) {
            console.error('API error:', apiErr);
            if (apiErr.response?.status === 404) {
              setError('Account not found. Please register first with Google.');
            } else {
              setError('Server error. Please try again.');
            }
            setLoading(false);
            return;
          }

          const userData = response.data.user || response.data;
          console.log('User data from backend:', userData);
          
          if (!userData) {
            setError('Invalid user data received');
            setLoading(false);
            return;
          }
          
          setUser(userData);
          localStorage.setItem('demoUser', JSON.stringify(userData));

          const intendedPath = localStorage.getItem('intendedPath');
          localStorage.removeItem('intendedPath');
          
          if (intendedPath && intendedPath !== '/login') {
            navigate(intendedPath);
          } else if (userData.role === 'superadmin') {
            navigate('/admin');
          } else if (userData.role === 'supplier') {
            navigate('/supplier');
          } else {
            navigate('/marketer');
          }
        } else {
          console.log('No redirect result - normal page load');
        }
      } catch (err) {
        console.error('Redirect result error:', err);
        sessionStorage.setItem('redirectHandled', 'true');
        if (err.code === 'auth/user-not-found') {
          setError('Account not found. Please register first with Google.');
        } else if (err.message) {
          setError(err.message);
        } else {
          setError('Login failed. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    handleRedirectResult();
    
    // Cleanup function
    return () => {
      // Don't clear the flag on unmount - we want it to persist
    };
  }, []); // Empty deps - run once on mount

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (email.includes('demo') || email.includes('@partnerza.com')) {
        let demoToken = 'demo-firebase-token';
        
        if (email === 'admin@partnerza.com' && password === 'admin123') {
          demoToken = 'demo-admin-token';
        } else if (email === 'supplier@partnerza.com' && password === 'supplier123') {
          demoToken = 'demo-supplier-token';
        } else if (email === 'marketer@partnerza.com' && password === 'marketer123') {
          demoToken = 'demo-marketer-token';
        } else if (password !== 'demo123') {
          throw new Error('Invalid demo credentials');
        }

        const response = await api.get('/api/auth/me', {
          headers: { Authorization: `Bearer ${demoToken}` }
        });

        const userData = response.data.user || response.data;
        setUser(userData);
        localStorage.setItem('demoUser', JSON.stringify(userData));

        // Always redirect to home page after login
        navigate('/');
        return;
      } else {
        // Non-demo user: Try Firebase auth first, then send ID token to backend
        try {
          console.log('Attempting Firebase sign-in...');
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUid = userCredential.user.uid;
          const idToken = await userCredential.user.getIdToken();
          console.log('Firebase auth successful, got ID token');
          
          // Send ID token to backend for verification and SQLite sync
          const loginResponse = await api.post('/api/auth/login', { 
            email, 
            idToken 
          });
          
          const { token, user } = loginResponse.data;
          
          localStorage.setItem('token', token);
          localStorage.setItem('demoUser', JSON.stringify(user));
          setUser(user);
          
          // Always redirect to home page after login
          navigate('/');
          return;
        } catch (firebaseErr) {
          console.error('Firebase login error:', firebaseErr);
          if (firebaseErr.response?.status === 401) {
            setError('Invalid email or password');
          } else {
            setError(firebaseErr.message || 'Login failed');
          }
          setLoading(false);
          return;
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setError('Invalid email or password');
      } else if (err.code === 'auth/configuration-not-found') {
        setError('Firebase configuration error. Please contact support.');
      } else if (err.message && err.message.includes('demo')) {
        setError(err.message);
      } else if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else {
        setError(err.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // Page will reload and useEffect will handle the result
    } catch (err) {
      console.error('Google login error:', err);
      setError(err.message || 'Google login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amazon-light flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-amazon-dark mb-2">Partnerza</h1>
          <p className="text-amazon-gray text-sm">Sign in to your sales agent account</p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg border border-amazon-border sm:rounded-lg sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-amazon-dark mb-2">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange focus:z-10 sm:text-sm transition-colors"
                placeholder="Enter your email address"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-amazon-dark mb-2">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange focus:z-10 sm:text-sm transition-colors"
                placeholder="Enter your password"
                required
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium text-white bg-amazon-orange hover:bg-orange-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amazon-orange transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>
          </form>

          {/* Google Login - Temporarily disabled
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-amazon-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-amazon-gray">Or continue with</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amazon-orange transition-colors disabled:opacity-50"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          </div>
          */}

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-amazon-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-amazon-gray">New to Partnerza?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                to="/register"
                className="w-full flex justify-center py-2 px-4 border border-amazon-orange text-sm font-medium rounded-md text-amazon-orange bg-white hover:bg-amazon-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amazon-orange transition-colors"
              >
                Create your Partnerza account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
