import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../api/axios';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800'
};

const METHOD_TYPES = ['Bank Account', 'E-Wallet', 'Cash'];

const E_WALLET_PROVIDERS = [
  // Mobile Wallets
  'Vodafone Cash',
  'Etisalat Cash (by e&)',
  'Orange Cash',
  'We Pay',
  // Bank-Based E-Wallets
  'BM Wallet (Banque Misr)',
  'CIB Smart Wallet',
  'Phone Cash (National Bank of Egypt)',
  'Qahera Cash (Banque du Caire)',
  'QNB Wallet',
  'ALEXBANK Wallet (Ma7fazty)',
  'KFH Egypt Mobile Wallet',
  'ABK Wallet',
  // Fintech E-Wallets
  'myFawry',
  'valU',
  'MoneyFellows',
  'Telda',
  'AMAN',
  'Halan Cash',
  'CASHU'
];

export default function MarketerDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL param first, then localStorage
    const urlTab = searchParams.get('tab');
    // Accept 'settings' and 'setting' as aliases for 'profile'
    if (urlTab === 'settings' || urlTab === 'setting') return 'profile';
    if (urlTab && ['orders', 'payment', 'methods', 'commissions', 'profile'].includes(urlTab)) {
      return urlTab;
    }
    return localStorage.getItem('marketerActiveTab') || 'orders';
  });

  // Update URL when tab changes
  const handleSetActiveTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('marketerActiveTab', tab);
    setSearchParams({ tab });
  };
  const [orders, setOrders] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [orderFilter, setOrderFilter] = useState('all');
  const [withdrawalAmount, setWithdrawalAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [methodForm, setMethodForm] = useState({
    method_type: '', account_name: '', account_number_or_iban: '', bank_name: '', is_default: false
  });
  const [showMethodForm, setShowMethodForm] = useState(false);
  const [showAddProductsModal, setShowAddProductsModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [availableProducts, setAvailableProducts] = useState([]);
  const [additionalItems, setAdditionalItems] = useState([]);
  
  // Order details modal state
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  
  // Profile settings state
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    country: 'Egypt'
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [availableCountries] = useState([
    'Egypt', 'Saudi Arabia', 'United Arab Emirates', 'Kuwait', 'Qatar', 'Bahrain', 'Oman',
    'Jordan', 'Lebanon', 'Iraq', 'Morocco', 'Algeria', 'Tunisia', 'Libya', 'Sudan', 'Yemen',
    'Syria', 'Turkey', 'United States', 'United Kingdom', 'Canada', 'Australia',
    'Germany', 'France', 'Italy', 'Spain', 'Netherlands', 'Belgium', 'Switzerland',
    'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Russia', 'Ukraine',
    'India', 'China', 'Japan', 'South Korea', 'Brazil', 'Argentina', 'Mexico',
    'South Africa', 'Nigeria', 'Kenya', 'Pakistan', 'Bangladesh', 'Indonesia',
    'Malaysia', 'Thailand', 'Philippines', 'Singapore', 'New Zealand', 'Ireland',
    'Portugal', 'Greece', 'Czech Republic', 'Hungary', 'Romania', 'Bulgaria',
    'Croatia', 'Serbia', 'Slovenia', 'Slovakia', 'Lithuania', 'Latvia', 'Estonia',
    'Iceland', 'Luxembourg', 'Malta', 'Cyprus', 'Israel', 'Iran', 'Afghanistan',
    'Uzbekistan', 'Kazakhstan', 'Turkmenistan', 'Tajikistan', 'Kyrgyzstan',
    'Azerbaijan', 'Armenia', 'Georgia', 'Moldova', 'Belarus'
  ]);
  
  const { user, logout } = useAuth();
  const { currency } = useCurrency();

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        whatsapp: user.whatsapp || '',
        country: user.country || 'Egypt'
      });
    }
  }, [user]);

  // Fetch full profile from server when profile tab is active
  useEffect(() => {
    if (activeTab === 'profile') {
      fetchUserProfile();
    }
  }, [activeTab]);

  const fetchUserProfile = async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      const u = data?.user || data;
      if (u) {
        setProfileForm({
          name: u.name || '',
          phone: u.phone || '',
          whatsapp: u.whatsapp || '',
          country: u.country || 'Egypt'
        });
      }
    } catch (e) {
      console.error('Failed to fetch user profile:', e);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    try {
      const [ordersRes, commissionsRes, withdrawalsRes, methodsRes, settingsRes, userRes] = await Promise.all([
        api.get('/api/orders').catch(() => ({ data: [] })),
        api.get('/api/commissions').catch(() => ({ data: [] })),
        api.get('/api/withdrawals').catch(() => ({ data: [] })),
        api.get('/api/payment-methods').catch(() => ({ data: [] })),
        api.get('/api/settings/public').catch((err) => {
          console.error('Settings fetch error:', err);
          return { data: {} };
        }),
        api.get('/api/auth/me').catch(() => ({ data: null }))
      ]);
      setOrders(ordersRes.data);
      setCommissions(commissionsRes.data);
      setWithdrawals(withdrawalsRes.data);
      setPaymentMethods(methodsRes.data);
      console.log('Settings received:', settingsRes.data);
      setSettings(settingsRes.data || {});
      // Update user balance from fresh fetch
      if (userRes.data?.user?.balance !== undefined) {
        user.balance = userRes.data.user.balance;
      }
    } catch (e) {
      console.error('Fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  // Balance calculations
  const totalApprovedCommissions = commissions.filter(c => c.status === 'approved').reduce((s, c) => s + parseFloat(c.amount || 0), 0);
  const totalPaidWithdrawals = withdrawals.filter(w => w.status === 'approved').reduce((s, w) => s + parseFloat(w.amount || 0), 0);
  
  // Completed orders with pending commissions (available for withdrawal)
  const completedOrders = orders.filter(o => o.status === 'completed');
  
  // Calculate completed commission total from order items (marketer_commission_amount)
  const completedCommissionTotal = completedOrders.reduce((sum, order) => {
    const orderCommission = order.items?.reduce((itemSum, item) => 
      itemSum + parseFloat(item.marketer_commission_amount || 0), 0) || 0;
    return sum + orderCommission;
  }, 0);
  
  // Available balance = completed commissions - approved withdrawals
  const balance = completedCommissionTotal - totalPaidWithdrawals;
  const pendingCommission = withdrawals.filter(w => w.status === 'pending').reduce((s, w) => s + parseFloat(w.amount || 0), 0);
  const platformFeeTotal = orders.filter(o => ['confirmed', 'shipped', 'delivered'].includes(o.status)).reduce((s, o) => s + parseFloat(o.platform_fee_amount || 0), 0);
  const minWithdrawal = parseFloat(settings.min_withdrawal_amount || '100');

  // Order filtering
  const filteredOrders = orderFilter === 'all' ? orders : orders.filter(o => o.status === orderFilter);

  // Cancel order
  const handleCancelOrder = async (orderId) => {
    if (!confirm('Are you sure you want to cancel this order?')) return;
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status: 'cancelled' });
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to cancel order');
    }
  };

  // Add products to order
  const handleAddProducts = async (order) => {
    setSelectedOrder(order);
    try {
      const { data } = await api.get('/api/products');
      setAvailableProducts(data);
      setAdditionalItems([]);
      setShowAddProductsModal(true);
    } catch (error) {
      alert('Failed to load products');
    }
  };

  const addToAdditionalItems = (product) => {
    const existingItem = additionalItems.find(item => item.id === product.id);
    if (existingItem) {
      setAdditionalItems(additionalItems.map(item => 
        item.id === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setAdditionalItems([...additionalItems, { ...product, quantity: 1 }]);
    }
  };

  const updateAdditionalQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setAdditionalItems(additionalItems.filter(item => item.id !== productId));
    } else {
      setAdditionalItems(additionalItems.map(item => 
        item.id === productId 
          ? { ...item, quantity: parseInt(quantity) }
          : item
      ));
    }
  };

  const removeFromAdditionalItems = (productId) => {
    setAdditionalItems(additionalItems.filter(item => item.id !== productId));
  };

  const submitAdditionalProducts = async () => {
    if (additionalItems.length === 0) {
      alert('Please select at least one product');
      return;
    }

    try {
      const items = additionalItems.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        price: item.price
      }));
      
      // Use the correct endpoint to add items to existing order
      await api.post(`/api/orders/${selectedOrder.id}/items`, { items });
      alert('Additional products added successfully!');
      setShowAddProductsModal(false);
      setAdditionalItems([]);
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add additional products');
    }
  };

  // Withdrawal submit
  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!selectedMethodId) { alert('Select a payment method'); return; }
    try {
      await api.post('/api/withdrawals', { amount: parseFloat(withdrawalAmount), payment_method_id: parseInt(selectedMethodId) });
      alert('Withdrawal requested successfully');
      setWithdrawalAmount('');
      fetchAll();
    } catch (error) {
      console.error('Withdrawal error:', error);
      console.error('Error response:', error.response);
      console.error('Error data:', error.response?.data);
      alert(error.response?.data?.error || 'Failed to request withdrawal');
    }
  };

  // Payment method CRUD
  const handleAddMethod = async (e) => {
    e.preventDefault();
    try {
      await api.post('/api/payment-methods', methodForm);
      setShowMethodForm(false);
      setMethodForm({ method_type: 'Bank Transfer', account_name: '', account_number_or_iban: '', bank_name: '', is_default: false });
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to add payment method');
    }
  };

  const handleDeleteMethod = async (id) => {
    if (!confirm('Delete this payment method?')) return;
    try {
      await api.delete(`/api/payment-methods/${id}`);
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to delete');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await api.patch(`/api/payment-methods/${id}/default`);
      fetchAll();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to set default');
    }
  };

  // Order details modal functions
  const openOrderModal = async (order) => {
    setSelectedOrder(order);
    setShowOrderModal(true);
    setLoadingOrderDetails(true);
    try {
      const { data } = await api.get(`/api/orders/${order.id}`);
      setOrderDetails(data);
    } catch (error) {
      console.error('Failed to fetch order details:', error);
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const closeOrderModal = () => {
    setShowOrderModal(false);
    setSelectedOrder(null);
    setOrderDetails(null);
  };

  // Profile update handler
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    console.log('Submitting profile update:', profileForm);
    try {
      const response = await api.patch('/api/auth/profile', profileForm);
      console.log('Profile update response:', response.data);
      // Update local user object
      if (user) Object.assign(user, profileForm);
      // Refresh from server to ensure data is in sync
      await fetchUserProfile();
      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      console.error('Error response:', error.response?.data);
      alert(error.response?.data?.error || error.response?.data?.details || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-amazon-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amazon-orange border-t-transparent"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'orders', label: 'Order Management' },
    { id: 'payment', label: 'Payment Management' },
    { id: 'methods', label: 'Payment Methods' },
    { id: 'commissions', label: 'Commission History' },
    { id: 'profile', label: 'Profile' }
  ];

  const orderSubTabs = ['all', 'pending', 'confirmed', 'completed', 'rejected'];

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* NAV */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <span className="text-sm text-gray-300 mx-4">Marketer Dashboard</span>
        <div className="flex-1" />
        <div className="flex items-center space-x-3 text-sm">
          <Link to="/marketplace" className="border border-transparent hover:border-white p-1 rounded-sm">Marketplace</Link>
          <div className="relative group">
            <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
              <span className="text-xs text-gray-300">Hello, {user?.name}</span><br />
              <span className="font-bold text-sm">Account</span>
            </div>
            <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
              <div className="p-3">
                <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Dashboard</Link>
                <Link to="/marketer?tab=orders" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Orders</Link>
                <Link to="/multi-order" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Multi Products Order</Link>
                <Link to="/marketer?tab=profile" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Profile</Link>
                <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* TABS */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => handleSetActiveTab(tab.id)}
            className={`px-3 py-1 rounded-sm mr-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-amazon-orange text-amazon-dark' : 'hover:outline hover:outline-1 hover:outline-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">

        {/* ========== TAB 1: ORDER MANAGEMENT ========== */}
        {activeTab === 'orders' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-amazon-dark">My Orders</h2>
              <div className="flex gap-2 mt-3 flex-wrap">
                {orderSubTabs.map(st => (
                  <button key={st} onClick={() => setOrderFilter(st)}
                    className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${orderFilter === st ? 'bg-amazon-orange text-amazon-dark' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {st} {st !== 'all' ? `(${orders.filter(o => o.status === st).length})` : `(${orders.length})`}
                  </button>
                ))}
              </div>
            </div>
            {filteredOrders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No orders found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Products</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredOrders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">#{o.id}</td>
                        <td className="px-4 py-3">
                          <div className="max-w-xs">
                            {o.items && o.items.length > 0 ? (
                              <div className="space-y-1">
                                {o.items.map((item, idx) => (
                                  <div key={idx} className="text-sm">
                                    <p className="font-medium truncate">{item.product_name}</p>
                                    <p className="text-xs text-gray-500">{item.supplier_name}</p>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-sm">No products</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">{o.client_name}</td>
                        <td className="px-4 py-3">
                          {o.items && o.items.length > 0 ? (
                            <div className="text-sm">
                              {o.items.reduce((sum, item) => sum + item.quantity, 0)} items
                            </div>
                          ) : (
                            <span>-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium">{parseFloat(o.total_amount || 0).toFixed(2)}</td>
                        <td className="px-4 py-3 text-green-700">
                          {parseFloat(o.total_commission || 0).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[o.status] || 'bg-gray-100'}`}>{o.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button onClick={() => openOrderModal(o)} className="px-2 py-1 bg-gray-500 text-white text-xs rounded">View</button>
                            {o.status === 'pending' && (
                              <>
                                <button onClick={() => handleAddProducts(o)}
                                  className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600">
                                  Add Products
                                </button>
                                <button onClick={() => handleCancelOrder(o.id)}
                                  className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600">
                                  Cancel
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========== TAB 2: PAYMENT MANAGEMENT ========== */}
        {activeTab === 'payment' && (
          <div className="space-y-6">
            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Commission Balance</p>
                <p className="text-3xl font-bold text-green-700">{parseFloat(balance).toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  <div className="flex justify-between">
                    <span>Completed commissions:</span>
                    <span className="text-green-600">+{completedCommissionTotal.toFixed(2)} {currency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Approved withdrawals:</span>
                    <span className="text-red-500">-{totalPaidWithdrawals.toFixed(2)} {currency}</span>
                  </div>
                  <div className="border-t pt-1 flex justify-between font-medium">
                    <span>Available:</span>
                    <span className="text-green-700">{parseFloat(balance).toFixed(2)} {currency}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Completed Commissions</p>
                <p className="text-3xl font-bold text-blue-600">{completedCommissionTotal.toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <p className="text-xs text-gray-400 mt-1">From {completedOrders.length} completed orders</p>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Pending Commission</p>
                <p className="text-3xl font-bold text-yellow-600">{pendingCommission.toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <div className="text-xs text-gray-400 mt-2 space-y-1">
                  {withdrawals.filter(w => w.status === 'pending').map((w, idx) => (
                    <div key={w.id} className="flex justify-between">
                      <span>Request #{w.id}:</span>
                      <span className="text-yellow-600">-{parseFloat(w.amount).toFixed(2)} {currency}</span>
                    </div>
                  ))}
                  <div className="border-t pt-1 flex justify-between font-medium">
                    <span>Total pending:</span>
                    <span className="text-yellow-600">{pendingCommission.toFixed(2)} {currency}</span>
                  </div>
                </div>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Platform Fees (info)</p>
                <p className="text-3xl font-bold text-gray-500">{platformFeeTotal.toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <p className="text-xs text-gray-400 mt-1">Total platform fees on your orders</p>
              </div>
            </div>

            {/* Completed Orders - Pending Commission */}
            {completedOrders.length === 0 ? (
              <div className="bg-white shadow-amazon rounded-sm p-8 text-center text-gray-500">
                <p className="mb-2">No completed orders yet.</p>
                <p className="text-sm text-gray-400">Commissions will appear here when your orders are marked as completed by suppliers.</p>
              </div>
            ) : (
              <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-blue-50">
                  <h3 className="text-lg font-bold text-amazon-dark">Completed Orders - Pending Commission</h3>
                  <p className="text-sm text-gray-600 mt-1">These orders are completed and commissions are available for withdrawal</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Products</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {completedOrders.map(o => {
                        const orderCommission = o.items?.reduce((sum, item) => 
                          sum + parseFloat(item.marketer_commission_amount || 0), 0) || 0;
                        return (
                          <tr key={o.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">#{o.id}</td>
                            <td className="px-4 py-3">{o.client_name}</td>
                            <td className="px-4 py-3">
                              {o.items && o.items.length > 0 ? (
                                <div className="text-sm">
                                  {o.items.map((item, idx) => (
                                    <div key={idx} className="truncate max-w-xs">{item.product_name}</div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-gray-400">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium">{parseFloat(o.total_amount || 0).toFixed(2)} {currency}</td>
                            <td className="px-4 py-3 font-bold text-green-700">{orderCommission.toFixed(2)} {currency}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-1 rounded-full text-xs font-medium capitalize bg-green-100 text-green-800">{o.status}</span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">{new Date(o.created_at).toLocaleDateString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-gray-50 border-t">
                      <tr>
                        <td colSpan="4" className="px-4 py-3 text-right font-semibold text-gray-700">Total Pending Commission:</td>
                        <td className="px-4 py-3 font-bold text-green-700">{completedCommissionTotal.toFixed(2)} {currency}</td>
                        <td colSpan="2"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Withdrawal Request Form */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h3 className="text-lg font-bold text-amazon-dark mb-4">Request Withdrawal</h3>
              {paymentMethods.length === 0 ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-800">
                  You need to add at least one payment method before requesting a withdrawal.
                  <button onClick={() => handleSetActiveTab('methods')} className="ml-2 text-amazon-orange font-bold hover:underline">Add Payment Method</button>
                </div>
              ) : (
                <form onSubmit={handleWithdraw} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-4">
                    <label className="block text-sm text-gray-600 mb-1">Amount ({currency})</label>
                    <input type="number" step="0.01" min={minWithdrawal}
                      value={withdrawalAmount} onChange={(e) => setWithdrawalAmount(e.target.value)} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    <p className="text-xs text-gray-400 mt-1">Min: {minWithdrawal} {currency} · Available: {parseFloat(balance).toFixed(2)} {currency}</p>
                  </div>
                  <div className="md:col-span-5">
                    <label className="block text-sm text-gray-600 mb-1">Payment Method</label>
                    <select value={selectedMethodId} onChange={(e) => setSelectedMethodId(e.target.value)} required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white">
                      <option value="">Select method</option>
                      {paymentMethods.map(m => (
                        <option key={m.id} value={m.id}>
                          {m.method_type} - {m.account_name} ({m.account_number_or_iban}) {m.is_default ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <button type="submit" disabled={
                        paymentMethods.length === 0 || 
                        !selectedMethodId || 
                        !withdrawalAmount || 
                        parseFloat(withdrawalAmount) < minWithdrawal
                      }
                      className="w-full bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                      Request Withdrawal
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Withdrawal History */}
            <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-amazon-dark">Withdrawal History</h3>
              </div>
              {withdrawals.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No withdrawal requests yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Admin Note</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {withdrawals.map(w => (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">#{w.id}</td>
                          <td className="px-4 py-3 font-medium">{parseFloat(w.amount).toFixed(2)} {currency}</td>
                          <td className="px-4 py-3">{w.payment_method_type || w.bank_name} - {w.payment_account || w.iban}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[w.status] || 'bg-gray-100'}`}>{w.status}</span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{new Date(w.created_at).toLocaleDateString()}</td>
                          <td className="px-4 py-3">
                            {w.receipt_url ? (
                              <a href={`http://localhost:5000/uploads/${w.receipt_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium">
                                View Receipt
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{w.admin_note || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB 3: PAYMENT METHODS ========== */}
        {activeTab === 'methods' && (
          <div className="space-y-6">
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-amazon-dark">Payment Methods</h2>
                <button onClick={() => setShowMethodForm(!showMethodForm)}
                  className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-5 py-2 rounded-full font-bold text-sm">
                  {showMethodForm ? 'Cancel' : 'Add Payment Method'}
                </button>
              </div>

              {showMethodForm && (
                <form onSubmit={handleAddMethod} className="bg-gray-50 rounded p-4 mb-4 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Method Type Selection */}
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">Method Type *</label>
                      <select 
                        value={methodForm.method_type} 
                        onChange={(e) => setMethodForm({ ...methodForm, method_type: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                      >
                        <option value="">Select method type</option>
                        {METHOD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                      </select>
                    </div>

                    {/* Common Field: Name */}
                    <div className="md:col-span-2">
                      <label className="block text-sm text-gray-600 mb-1">Name *</label>
                      <input 
                        type="text" 
                        value={methodForm.account_name} 
                        required
                        placeholder="Enter your name"
                        onChange={(e) => setMethodForm({ ...methodForm, account_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" 
                      />
                    </div>

                    {/* Bank Account Fields */}
                    {methodForm.method_type === 'Bank Account' && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Account Number *</label>
                          <input 
                            type="text" 
                            value={methodForm.account_number_or_iban} 
                            required={methodForm.method_type === 'Bank Account'}
                            placeholder="Enter account number"
                            onChange={(e) => setMethodForm({ ...methodForm, account_number_or_iban: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Bank *</label>
                          <input 
                            type="text" 
                            value={methodForm.bank_name} 
                            required={methodForm.method_type === 'Bank Account'}
                            placeholder="Enter bank name"
                            onChange={(e) => setMethodForm({ ...methodForm, bank_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" 
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-sm text-gray-600 mb-1">Branch Name</label>
                          <input 
                            type="text" 
                            value={methodForm.branch_name || ''} 
                            placeholder="Enter branch name (optional)"
                            onChange={(e) => setMethodForm({ ...methodForm, branch_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" 
                          />
                        </div>
                      </>
                    )}

                    {/* E-Wallet Fields */}
                    {methodForm.method_type === 'E-Wallet' && (
                      <>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Wallet Number *</label>
                          <input 
                            type="text" 
                            value={methodForm.account_number_or_iban || ''} 
                            required={methodForm.method_type === 'E-Wallet'}
                            placeholder="Enter wallet number"
                            onChange={(e) => setMethodForm({ ...methodForm, account_number_or_iban: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" 
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">Provider *</label>
                          <select 
                            value={methodForm.bank_name || ''} 
                            required={methodForm.method_type === 'E-Wallet'}
                            onChange={(e) => setMethodForm({ ...methodForm, bank_name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white"
                          >
                            <option value="">Select provider</option>
                            {E_WALLET_PROVIDERS.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                      </>
                    )}

                    {/* Cash Fields */}
                    {methodForm.method_type === 'Cash' && (
                      <div className="md:col-span-2">
                        <label className="block text-sm text-gray-600 mb-1">Contact Number / Reference *</label>
                        <input 
                          type="text" 
                          value={methodForm.account_number_or_iban || ''} 
                          required={methodForm.method_type === 'Cash'}
                          placeholder="Enter phone number or reference for cash payments"
                          onChange={(e) => setMethodForm({ ...methodForm, account_number_or_iban: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" 
                        />
                      </div>
                    )}
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="checkbox" checked={methodForm.is_default}
                      onChange={(e) => setMethodForm({ ...methodForm, is_default: e.target.checked })} />
                    Set as default
                  </label>
                  <button type="submit" className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">Save Method</button>
                </form>
              )}

              {paymentMethods.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No payment methods saved. Add one to request withdrawals.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Details</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Default</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paymentMethods.map(m => (
                        <tr key={m.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{m.method_type}</td>
                          <td className="px-4 py-3">{m.account_name}</td>
                          <td className="px-4 py-3 text-xs">
                            {m.method_type === 'Bank Account' && (
                              <div>
                                <div className="font-mono">{m.account_number_or_iban}</div>
                                <div className="text-gray-500">{m.bank_name} {m.branch_name && `- ${m.branch_name}`}</div>
                              </div>
                            )}
                            {m.method_type === 'E-Wallet' && (
                              <div>
                                <div className="font-mono">{m.wallet_number || m.account_number_or_iban}</div>
                                <div className="text-gray-500">{m.provider || m.bank_name}</div>
                              </div>
                            )}
                            {m.method_type === 'Cash' && (
                              <span className="text-gray-500">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {m.is_default ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">Default</span>
                            ) : (
                              <button onClick={() => handleSetDefault(m.id)} className="text-xs text-blue-600 hover:underline">Set Default</button>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <button onClick={() => handleDeleteMethod(m.id)} className="text-xs text-red-600 hover:text-red-800">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== TAB 4: COMMISSION HISTORY ========== */}
        {activeTab === 'commissions' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-amazon-dark">Commission & Withdrawal History</h2>
            </div>
            {[...commissions.map(c => ({ ...c, type: 'commission', date: c.created_at })), ...withdrawals.map(w => ({ ...w, type: 'withdrawal', date: w.created_at, amount: -parseFloat(w.amount), status: w.status }))].sort((a, b) => new Date(b.date) - new Date(a.date)).length === 0 ? (
              <div className="p-8 text-center text-gray-500">No commission or withdrawal records yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order/Method</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount {currency}</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {[...commissions.map(c => ({ ...c, type: 'commission', date: c.created_at })), ...withdrawals.map(w => ({ ...w, type: 'withdrawal', date: w.created_at, amount: -parseFloat(w.amount), status: w.status }))].sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => (
                      <tr key={`${item.type}-${item.id}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">#{item.id}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.type === 'commission' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                            {item.type === 'commission' ? 'Commission' : 'Withdrawal'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {item.type === 'commission' ? (
                            <>Order #{item.order_id}{item.product_name && ` · ${item.product_name}`}</>
                          ) : (
                            <>{item.payment_method_type || item.bank_name} · {item.payment_account || item.iban}</>
                          )}
                        </td>
                        <td className={`px-4 py-3 font-medium ${item.amount >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {item.amount >= 0 ? '+' : ''}{parseFloat(item.amount).toFixed(2)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[item.status] || 'bg-gray-100'}`}>{item.status}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">{new Date(item.date).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========== TAB 5: PROFILE ========== */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-6">Profile Settings</h2>
              
              <form onSubmit={handleProfileUpdate} className="max-w-2xl space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                    placeholder="e.g. +20 10 1234 5678"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp</label>
                  <input
                    type="text"
                    value={profileForm.whatsapp}
                    onChange={(e) => setProfileForm({ ...profileForm, whatsapp: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                    placeholder="e.g. +20 10 1234 5678"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Country</label>
                  <select
                    value={profileForm.country}
                    onChange={(e) => setProfileForm({ ...profileForm, country: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white"
                    required
                  >
                    {availableCountries.map(country => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    This will be used as the default country for your orders. Cities will be loaded based on this selection.
                  </p>
                </div>
                
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50"
                  >
                    {savingProfile ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ADD PRODUCTS MODAL */}
        {showAddProductsModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-bold text-amazon-dark">
                    Add Products to Order #{selectedOrder?.id} - {selectedOrder?.client_name}
                  </h2>
                  <button onClick={() => setShowAddProductsModal(false)}
                    className="text-gray-400 hover:text-gray-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Products List */}
                  <div>
                    <h3 className="font-semibold text-amazon-dark mb-3">Available Products</h3>
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {availableProducts.map((product) => {
                        const cartItem = additionalItems.find(item => item.id === product.id);
                        return (
                          <div key={product.id} className="border border-amazon-border rounded p-3">
                            <div className="flex gap-3">
                              <div className="w-20 h-20 bg-gray-50 rounded overflow-hidden flex-shrink-0">
                                <img
                                  src={product.main_image ? `http://localhost:5000/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                                  alt={product.name} className="w-full h-full object-contain"
                                  onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }} />
                              </div>
                              <div className="flex-1">
                                <h4 className="font-medium text-amazon-dark line-clamp-1">{product.name}</h4>
                                <p className="text-sm text-gray-500">{product.supplier_name}</p>
                                <p className="font-bold text-amazon-dark">{parseFloat(product.price).toFixed(2)} {currency}</p>
                                <p className="text-xs text-green-600">{product.marketer_commission_rate}% commission</p>
                                <p className={`text-xs ${product.stock_quantity > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                                  Stock: {product.stock_quantity || 0} available
                                </p>
                                {cartItem ? (
                                  <div className="flex items-center gap-2 mt-2">
                                    <button onClick={() => updateAdditionalQuantity(product.id, cartItem.quantity - 1)}
                                      className="w-8 h-8 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center text-sm font-medium hover:bg-gray-50">
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      min="1"
                                      value={cartItem.quantity}
                                      onChange={(e) => {
                                        const value = parseInt(e.target.value) || 1;
                                        if (value >= 1) {
                                          updateAdditionalQuantity(product.id, value);
                                        }
                                      }}
                                      className="w-14 h-8 text-center text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                                    />
                                    <button onClick={() => updateAdditionalQuantity(product.id, cartItem.quantity + 1)}
                                      className="w-8 h-8 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center text-sm font-medium hover:bg-gray-50">
                                      +
                                    </button>
                                  </div>
                                ) : (
                                  <button onClick={() => addToAdditionalItems(product)}
                                    disabled={product.stock_quantity <= 0}
                                    className="mt-2 bg-amazon-orange hover:brightness-110 disabled:bg-gray-300 disabled:cursor-not-allowed text-amazon-dark px-3 py-1 rounded text-xs font-bold">
                                    {product.stock_quantity > 0 ? 'Add' : 'Out of Stock'}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected Items */}
                  <div>
                    <h3 className="font-semibold text-amazon-dark mb-3">Selected Products ({additionalItems.length})</h3>
                    {additionalItems.length === 0 ? (
                      <p className="text-gray-500 text-sm">No products selected</p>
                    ) : (
                      <div className="space-y-2 mb-4">
                        {additionalItems.map((item) => (
                          <div key={item.id} className="flex justify-between items-center bg-gray-50 p-2 rounded">
                            <div className="flex-1">
                              <p className="font-medium text-sm line-clamp-1">{item.name}</p>
                              <p className="text-xs text-gray-500">{item.quantity} × {parseFloat(item.price).toFixed(2)} {currency}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm">{(item.price * item.quantity).toFixed(2)} {currency}</span>
                              <button onClick={() => removeFromAdditionalItems(item.id)}
                                className="text-red-500 hover:text-red-700">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        ))}
                        <div className="border-t pt-2">
                          <div className="flex justify-between font-bold">
                            <span>Total:</span>
                            <span>{additionalItems.reduce((sum, item) => sum + (item.price * item.quantity), 0).toFixed(2)} {currency}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <button onClick={submitAdditionalProducts}
                      disabled={additionalItems.length === 0}
                      className="w-full bg-amazon-orange hover:brightness-110 text-amazon-dark py-2 rounded-full font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                      Order Additional Products
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Order Details Modal */}
        {showOrderModal && selectedOrder && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <h3 className="text-xl font-bold text-amazon-dark">Order Details #{selectedOrder.id}</h3>
                <button onClick={closeOrderModal} className="text-gray-500 hover:text-gray-700">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="p-6 space-y-6">
                {loadingOrderDetails ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amazon-orange"></div>
                  </div>
                ) : orderDetails ? (
                  <>
                    {/* Order Header Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Order Information</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="font-medium">Status:</span> 
                            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusColors[orderDetails.status] || 'bg-gray-100'}`}>
                              {orderDetails.status}
                            </span>
                          </p>
                          <p><span className="font-medium">Created:</span> {new Date(orderDetails.created_at).toLocaleString()}</p>
                          <p><span className="font-medium">City:</span> {orderDetails.city || '-'}</p>
                        </div>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Client Information</h4>
                        <div className="space-y-1 text-sm">
                          <p><span className="font-medium">Name:</span> {orderDetails.client_name}</p>
                          <p><span className="font-medium">Phone:</span> {orderDetails.client_phone}</p>
                          <p><span className="font-medium">Address:</span> {orderDetails.client_address || '-'}</p>
                          {orderDetails.client_notes && (
                            <p><span className="font-medium">Notes:</span> {orderDetails.client_notes}</p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Supplier Info */}
                    {orderDetails.supplier_name && (
                      <div className="bg-green-50 p-3 rounded">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Supplier</h4>
                        <div className="text-sm">
                          <p className="font-medium">{orderDetails.supplier_name}</p>
                        </div>
                      </div>
                    )}

                    {/* Order Items */}
                    {orderDetails.items && orderDetails.items.length > 0 && (
                      <div>
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order Items</h4>
                        <div className="space-y-2">
                          {orderDetails.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-start bg-gray-50 p-3 rounded text-sm">
                              <div className="flex-1">
                                <p className="font-medium">{item.product_name}</p>
                                <p className="text-gray-500">{item.quantity} × {parseFloat(item.unit_price).toFixed(2)} {currency}</p>
                                {item.variants && item.variants.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {item.variants.map((v, vidx) => (
                                      <span key={vidx} className="inline-block bg-amazon-orange/20 text-amazon-dark px-2 py-0.5 rounded text-xs">
                                        {v.variant_name}: {v.variant_value}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="text-right">
                                <p className="font-medium">{parseFloat(item.total_amount).toFixed(2)} {currency}</p>
                                <p className="text-xs text-green-600">Commission: {parseFloat(item.marketer_commission_amount).toFixed(2)} {currency}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Financial Summary */}
                    <div className="border-t pt-4">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Financial Summary</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Products Subtotal:</span>
                          <span>{(parseFloat(orderDetails.total_amount) - parseFloat(orderDetails.shipment_cost || 0)).toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipping Cost:</span>
                          <span>{parseFloat(orderDetails.shipment_cost || 0).toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between font-bold text-base border-t pt-2">
                          <span>Order Total:</span>
                          <span>{parseFloat(orderDetails.total_amount).toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between text-green-700">
                          <span>Your Commission:</span>
                          <span>{parseFloat(orderDetails.total_commission || 0).toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between text-blue-700">
                          <span>Platform Fee:</span>
                          <span>{parseFloat(orderDetails.total_platform_fee || 0).toFixed(2)} {currency}</span>
                        </div>
                      </div>
                    </div>

                    {/* Supplier Note */}
                    {orderDetails.supplier_note && (
                      <div className="bg-yellow-50 p-3 rounded">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-1">Supplier Note</h4>
                        <p className="text-sm text-gray-700">{orderDetails.supplier_note}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-center text-gray-500">Failed to load order details</p>
                )}
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <button 
                  onClick={closeOrderModal}
                  className="w-full bg-amazon-dark hover:bg-gray-800 text-white py-2 rounded-full font-bold text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
