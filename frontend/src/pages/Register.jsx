import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithRedirect, GoogleAuthProvider, getRedirectResult } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import api from '../api/axios';

export default function Register() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    whatsapp: '',
    role: 'marketer'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { city, loading: cityLoading, setShowSelector } = useCity();

  // Handle redirect result from Google sign-in
  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result && result.user) {
          setLoading(true);
          const { user } = result;
          
          // Register profile in SQLite via backend
          await api.post('/api/auth/register', {
            uid: user.uid,
            name: user.displayName || 'Google User',
            email: user.email,
            role: formData.role,
            phone: user.phoneNumber || ''
          });

          navigate('/login');
        }
      } catch (err) {
        console.error('Redirect result error:', err);
        setError(err.message || 'Google registration failed. Please try again.');
        setLoading(false);
      }
    };

    handleRedirectResult();
  }, [navigate, formData.role]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create Firebase user
      const { user } = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      
      // Register profile in SQLite via backend
      await api.post('/api/auth/register', {
        uid: user.uid,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        phone: formData.phone,
        whatsapp: formData.whatsapp
      });

      navigate('/login');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setError('');
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
      // Page will reload and useEffect will handle the result
    } catch (err) {
      console.error('Google registration error:', err);
      setError(err.message || 'Google registration failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* ===== TOP NAV ===== */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        {/* Logo */}
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>

        {/* Deliver to */}
        <div 
          onClick={() => setShowSelector(true)}
          className="hidden md:flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm cursor-pointer"
        >
          <svg className="w-4 h-4 text-white mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
          </svg>
          <div className="text-xs leading-tight">
            <span className="text-gray-300">Delivering to {cityLoading ? '...' : city || 'Select city'}</span>
            <br />
            <span className="font-bold text-sm">Update location</span>
          </div>
        </div>

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center space-x-3 text-sm">
          {!user ? (
            <>
              <Link to="/login" className="border border-transparent hover:border-white p-1 rounded-sm">
                <span className="text-xs text-gray-300">Hello, sign in</span><br />
                <span className="font-bold text-sm">Account</span>
              </Link>
              <Link to="/register" className="border border-transparent hover:border-white p-1 rounded-sm bg-amazon-orange text-amazon-dark px-3 py-1 rounded-full font-bold">
                Register
              </Link>
            </>
          ) : (
            <div className="relative group">
              <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
                <span className="text-xs text-gray-300">Hello, {user?.name}</span><br />
                <span className="font-bold text-sm">Account</span>
              </div>
              <div className="absolute right-0 mt-0 w-48 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
                <div className="p-3">
                  <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Sign Out</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* ===== SUB NAV ===== */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm overflow-x-auto">
        <Link to="/" className="px-3 py-1 rounded-sm mr-2 hover:outline hover:outline-1 hover:outline-white">Home</Link>
        <Link to="/marketplace" className="px-3 py-1 rounded-sm mr-2 hover:outline hover:outline-1 hover:outline-white">Marketplace</Link>
      </div>

      {/* Main Content */}
      <div className="flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-amazon-dark mb-2">Partnerza</h1>
            <p className="text-amazon-gray text-sm">Create your account</p>
          </div>
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-8 px-4 shadow-lg border border-amazon-border sm:rounded-lg sm:px-10">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded">
                  {error}
                </div>
              )}
              <div className="space-y-4">
                <input
                  type="text"
                  name="name"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange sm:text-sm transition-colors"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={handleChange}
                />
                <input
                  type="email"
                  name="email"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange sm:text-sm transition-colors"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                />
                <input
                  type="password"
                  name="password"
                  required
                  className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange sm:text-sm transition-colors"
                  placeholder="Password"
                  value={formData.password}
                  onChange={handleChange}
                />
                <input
                  type="tel"
                  name="phone"
                  className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange sm:text-sm transition-colors"
                  placeholder="Phone number"
                  value={formData.phone}
                  onChange={handleChange}
                />
                <input
                  type="tel"
                  name="whatsapp"
                  className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange sm:text-sm transition-colors"
                  placeholder="WhatsApp number (e.g., 966501234567)"
                  value={formData.whatsapp}
                  onChange={handleChange}
                />
                <select
                  name="role"
                  className="appearance-none relative block w-full px-3 py-3 border border-amazon-border placeholder-amazon-gray text-amazon-dark rounded-md focus:outline-none focus:ring-amazon-orange focus:border-amazon-orange sm:text-sm transition-colors"
                  value={formData.role}
                  onChange={handleChange}
                >
                  <option value="marketer">Marketer</option>
                  <option value="supplier">Supplier</option>
                </select>
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
                      Creating account...
                    </div>
                  ) : (
                    'Create your Partnerza account'
                  )}
                </button>
              </div>

              <div className="mt-6">
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-amazon-border"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-amazon-gray">Already have an account?</span>
                  </div>
                </div>

                <div className="mt-6">
                  <Link
                    to="/login"
                    className="w-full flex justify-center py-2 px-4 border border-amazon-orange text-sm font-medium rounded-md text-amazon-orange bg-white hover:bg-amazon-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amazon-orange transition-colors"
                  >
                    Sign in
                  </Link>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}