import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CurrencyProvider } from './context/CurrencyContext';
import { CityProvider } from './context/CityContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Home from './pages/Home';
import Marketplace from './pages/Marketplace';
import ProductDetail from './pages/ProductDetail';
import SubmitOrder from './pages/SubmitOrder';
import SubmitMultiOrder from './pages/SubmitMultiOrder';
import MarketerDashboard from './pages/MarketerDashboard';
import SupplierDashboard from './pages/SupplierDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsers from './pages/AdminUsers';
import Campaign from './pages/Campaign';

function ProtectedRoute({ children, allowedRole }) {
  const { user, role, loading } = useAuth();
  const location = useLocation();

  // Store the current path when redirecting to login
  useEffect(() => {
    if (!loading && !user) {
      localStorage.setItem('intendedPath', location.pathname);
    }
  }, [loading, user, location]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amazon-orange"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && role !== allowedRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amazon-light">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amazon-dark mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You don't have permission to access this page.</p>
          <Link to="/marketplace" className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">
            Go to Marketplace
          </Link>
        </div>
      </div>
    );
  }

  return children;
}

function App() {
  return (
    <AuthProvider>
      <CurrencyProvider>
        <CityProvider>
          <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/marketplace" element={
                <ProtectedRoute>
                  <Marketplace />
                </ProtectedRoute>
              } />
              <Route path="/products/:id/order" element={
                <ProtectedRoute allowedRole="marketer">
                  <SubmitOrder />
                </ProtectedRoute>
              } />
              <Route path="/products/:id" element={
                <ProtectedRoute>
                  <ProductDetail />
                </ProtectedRoute>
              } />
              <Route path="/multi-order" element={
                <ProtectedRoute allowedRole="marketer">
                  <SubmitMultiOrder />
                </ProtectedRoute>
              } />
              <Route path="/marketer" element={
                <ProtectedRoute allowedRole="marketer">
                  <MarketerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/supplier" element={
                <ProtectedRoute allowedRole="supplier">
                  <SupplierDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin" element={
                <ProtectedRoute allowedRole="superadmin">
                  <AdminDashboard />
                </ProtectedRoute>
              } />
              <Route path="/admin/users" element={
                <ProtectedRoute allowedRole="superadmin">
                  <AdminUsers />
                </ProtectedRoute>
              } />
              <Route path="/campaign" element={<Campaign />} />
              <Route path="/" element={<Home />} />
            </Routes>
          </Router>
        </CityProvider>
      </CurrencyProvider>
    </AuthProvider>
  );
}

export default App;