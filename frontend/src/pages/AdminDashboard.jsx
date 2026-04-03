import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../api/axios';
import VariantTemplatesManager from '../components/VariantTemplatesManager';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function AdminDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    // Check URL param first, then localStorage
    const urlTab = searchParams.get('tab');
    if (urlTab && ['orders', 'products', 'withdrawals', 'supplierPayments', 'supplierReport', 'settings', 'dataReset'].includes(urlTab)) {
      return urlTab;
    }
    return localStorage.getItem('adminActiveTab') || 'orders';
  });

  const handleSetActiveTab = (tab) => {
    setActiveTab(tab);
    localStorage.setItem('adminActiveTab', tab);
    setSearchParams({ tab });
  };

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [supplierPayments, setSupplierPayments] = useState([]);
  const [settings, setSettings] = useState({ default_platform_fee_rate: '5' });
  const [marketers, setMarketers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user, logout } = useAuth();
  const { currency, setCurrency } = useCurrency();

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [receiptFile, setReceiptFile] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [withdrawalFilter, setWithdrawalFilter] = useState('all');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    try {
      const [ordersRes, productsRes, withdrawalsRes, settingsRes, paymentsRes] = await Promise.all([
        api.get('/api/orders').catch(() => ({ data: [] })),
        api.get('/api/products'),
        api.get('/api/withdrawals').catch(() => ({ data: [] })),
        api.get('/api/settings').catch(() => ({ data: { settings: {}, marketers: [] } })),
        api.get('/api/supplier/payments/pending').catch(() => ({ data: [] }))
      ]);
      setOrders(ordersRes.data);
      setProducts(productsRes.data);
      setWithdrawals(withdrawalsRes.data);
      setSupplierPayments(paymentsRes.data);
      if (settingsRes.data.settings) setSettings(settingsRes.data.settings);
      if (settingsRes.data.marketers) setMarketers(settingsRes.data.marketers);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    const note = prompt('Add a note (optional):');
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status, supplier_note: note || '' });
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to update order');
    }
  };

  const updateWithdrawalStatus = async (id, status, admin_note, receiptFile = null) => {
    try {
      const formData = new FormData();
      formData.append('status', status);
      formData.append('admin_note', admin_note || '');
      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }
      
      await api.patch(`/api/withdrawals/${id}`, formData);
      fetchData();
    } catch (error) {
      console.error('Failed to update withdrawal:', error);
      alert(error.response?.data?.error || 'Failed to update withdrawal');
    }
  };

  const openApproveModal = (withdrawal) => {
    setSelectedWithdrawal(withdrawal);
    setReceiptFile(null);
    setAdminNote('');
    setShowReceiptModal(true);
  };

  const handleApproveWithReceipt = async () => {
    if (!receiptFile) {
      alert('Please select a receipt file');
      return;
    }
    await updateWithdrawalStatus(selectedWithdrawal.id, 'approved', adminNote, receiptFile);
    setShowReceiptModal(false);
  };

  const deleteProduct = async (productId) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      await api.delete(`/api/products/${productId}`);
      fetchData();
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const saveFeeRate = async () => {
    try {
      await api.put('/api/settings', { key: 'default_platform_fee_rate', value: settings.default_platform_fee_rate });
      alert('Platform fee rate updated');
    } catch (error) {
      alert('Failed to update');
    }
  };

  const updateMarketerOverride = async (marketerId, value) => {
    try {
      await api.patch(`/api/settings/marketer/${marketerId}`, {
        platform_fee_rate_override: value === '' ? null : parseFloat(value)
      });
      fetchData();
    } catch (error) {
      alert('Failed to update marketer override');
    }
  };

  const verifySupplierPayment = async (paymentId, status) => {
    const notes = prompt('Add verification notes (optional):');
    try {
      await api.patch(`/api/supplier/payments/${paymentId}/verify`, { 
        status, 
        notes: notes || '' 
      });
      alert(`Payment ${status === 'verified' ? 'verified' : 'rejected'} successfully`);
      fetchData();
    } catch (error) {
      alert(error.response?.data?.error || 'Failed to verify payment');
    }
  };

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amazon-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amazon-orange"></div>
      </div>
    );
  }

  // Calculate total supplier payments
  const totalSupplierPayments = supplierPayments.reduce((sum, p) => sum + parseFloat(p.total_amount || 0), 0);

  // Calculate total approved withdrawals
  const totalApprovedWithdrawals = withdrawals
    .filter(w => w.status === 'approved')
    .reduce((sum, w) => sum + parseFloat(w.amount || 0), 0);

  // Calculate supplier report data
  const supplierReport = (() => {
    const suppliers = {};
    
    // Get all unique suppliers from orders
    orders.forEach(order => {
      if (!order.supplier_name) return;
      
      if (!suppliers[order.supplier_name]) {
        suppliers[order.supplier_name] = {
          name: order.supplier_name,
          totalOrders: 0,
          notCompleted: 0,
          completed: 0,
          completedPaid: 0,
          totalPrice: 0,
          notCompletedPrice: 0,
          completedPrice: 0,
          completedPaidPrice: 0
        };
      }
      
      const s = suppliers[order.supplier_name];
      const orderTotal = parseFloat(order.total_amount || 0);
      
      s.totalOrders++;
      s.totalPrice += orderTotal;
      
      if (order.status === 'completed') {
        s.completed++;
        s.completedPrice += orderTotal;
        
        if (order.payment_status === 'paid') {
          s.completedPaid++;
          s.completedPaidPrice += orderTotal;
        }
      } else {
        s.notCompleted++;
        s.notCompletedPrice += orderTotal;
      }
    });
    
    return Object.values(suppliers);
  })();

  const tabs = [
    { id: 'orders', label: `Orders (${orders.length})` },
    { id: 'products', label: `Products (${products.length})` },
    { id: 'withdrawals', label: `Withdrawals (${withdrawals.filter(w => w.status === 'pending').length})` },
    { id: 'supplierPayments', label: `Supplier Payments (${supplierPayments.length})` },
    { id: 'supplierReport', label: 'Supplier Report' },
    { id: 'settings', label: 'Platform Settings' },
    { id: 'dataReset', label: 'Data Reset' }
  ];

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* NAV */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <span className="text-sm text-gray-300 mx-4">Superadmin Panel</span>
        <div className="flex-1" />
        <div className="flex items-center space-x-3 text-sm">
          <Link to="/marketplace" className="border border-transparent hover:border-white p-1 rounded-sm">Marketplace</Link>
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
        </div>
      </nav>

      {/* Tabs */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm overflow-x-auto">
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => handleSetActiveTab(tab.id)}
            className={`px-3 py-1 rounded-sm mr-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-amazon-orange text-amazon-dark' : 'hover:outline hover:outline-1 hover:outline-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">

        {/* ORDERS TAB */}
        {activeTab === 'orders' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-amazon-dark">All Orders</h2>
            </div>
            {orders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No orders yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">#{o.id}</td>
                        <td className="px-4 py-3">{o.product_name}</td>
                        <td className="px-4 py-3">{o.marketer_name}</td>
                        <td className="px-4 py-3">{o.supplier_name}</td>
                        <td className="px-4 py-3">
                          <div>{o.client_name}</div>
                          <div className="text-xs text-gray-400">{o.client_phone}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{parseFloat(o.total_amount || 0).toFixed(2)} {currency}</td>
                        <td className="px-4 py-3 text-green-700">
                          {o.total_commission ? parseFloat(o.total_commission).toFixed(2) : '-'} {currency}
                        </td>
                        <td className="px-4 py-3 text-blue-700">
                          {o.total_platform_fee ? parseFloat(o.total_platform_fee).toFixed(2) : '-'} {currency}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[o.status] || 'bg-gray-100'}`}>
                            {o.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 flex-wrap">
                            <button onClick={() => openOrderModal(o)} className="px-2 py-1 bg-gray-500 text-white text-xs rounded">View</button>
                            {o.status === 'pending' && (
                              <>
                                <button onClick={() => updateOrderStatus(o.id, 'confirmed')} className="px-2 py-1 bg-blue-500 text-white text-xs rounded">Confirm</button>
                                <button onClick={() => updateOrderStatus(o.id, 'rejected')} className="px-2 py-1 bg-red-500 text-white text-xs rounded">Reject</button>
                              </>
                            )}
                            {o.status === 'confirmed' && (
                              <button onClick={() => updateOrderStatus(o.id, 'shipped')} className="px-2 py-1 bg-purple-500 text-white text-xs rounded">Ship</button>
                            )}
                            {o.status === 'shipped' && (
                              <button onClick={() => updateOrderStatus(o.id, 'delivered')} className="px-2 py-1 bg-green-500 text-white text-xs rounded">Deliver</button>
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

        {/* PRODUCTS TAB */}
        {activeTab === 'products' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-amazon-dark">All Products</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4">
              {products.map((product) => (
                <div key={product.id} className="border border-amazon-border rounded p-3 hover:shadow-lg transition-shadow">
                  <div className="aspect-square bg-gray-50 rounded mb-2 overflow-hidden relative">
                    <img
                      src={product.main_image ? `http://localhost:5000/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                      alt={product.name} className="w-full h-full object-contain"
                      onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }} />
                    {product.image_count > 1 && (
                      <span className="absolute top-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded">
                        {product.image_count} photos
                      </span>
                    )}
                  </div>
                  
                  {/* Product ID Badge */}
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">ID: #{product.id}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${product.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {product.status === 'active' ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  
                  <h3 className="text-sm font-semibold line-clamp-2 mb-1">{product.name}</h3>
                  
                  {/* Description */}
                  {product.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{product.description}</p>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                    <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded">{product.category || 'No Category'}</span>
                    <span>{product.supplier_name}</span>
                  </div>
                  
                  {/* Price & Commission Row */}
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-lg font-bold text-amazon-dark">{parseFloat(product.price).toFixed(2)} {currency}</p>
                    <div className="text-right">
                      <p className="text-xs text-green-600 font-medium">{product.marketer_commission_rate}% commission</p>
                      {product.platform_fee_rate_override && (
                        <p className="text-xs text-blue-600">{product.platform_fee_rate_override}% platform fee</p>
                      )}
                    </div>
                  </div>
                  
                  {/* Stock & Stats Row */}
                  <div className="flex items-center justify-between text-xs border-t pt-2 mt-2">
                    <span className={`font-medium ${(product.stock_quantity || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      Stock: {product.stock_quantity || 0}
                    </span>
                    <span className="text-gray-400">
                      {new Date(product.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <button onClick={() => deleteProduct(product.id)}
                    className="mt-2 w-full text-red-600 hover:text-red-900 hover:bg-red-50 text-xs py-1 rounded transition-colors">
                    Delete Product
                  </button>
                </div>
              ))}
              {products.length === 0 && <div className="col-span-full text-center py-8 text-gray-500">No products.</div>}
            </div>
          </div>
        )}

        {/* WITHDRAWALS TAB */}
        {activeTab === 'withdrawals' && (
          <div className="space-y-6">
            {/* Status Filter */}
            <div className="bg-white shadow-amazon rounded-sm p-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium text-gray-700">Filter by Status:</span>
                <div className="flex gap-2">
                  {['all', 'pending', 'approved', 'rejected'].map(status => (
                    <button
                      key={status}
                      onClick={() => setWithdrawalFilter(status)}
                      className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${
                        withdrawalFilter === status
                          ? 'bg-amazon-orange text-amazon-dark'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status} {status !== 'all' && `(${withdrawals.filter(w => w.status === status).length})`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pending Withdrawal Requests Grid */}
            {withdrawalFilter === 'all' || withdrawalFilter === 'pending' ? (
              <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
                <div className="p-4 border-b border-gray-200 bg-yellow-50">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-xl font-bold text-amazon-dark">Pending Withdrawal Requests</h2>
                      <p className="text-sm text-gray-500 mt-1">Withdrawals awaiting approval</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Total Pending</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {withdrawals.filter(w => w.status === 'pending').reduce((sum, w) => sum + parseFloat(w.amount || 0), 0).toFixed(2)} {currency}
                      </p>
                    </div>
                  </div>
                </div>
                {withdrawals.filter(w => w.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center text-gray-500">No pending withdrawal requests.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bank</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IBAN</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Requested Date</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {withdrawals.filter(w => w.status === 'pending').map((w) => (
                          <tr key={w.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3">{w.marketer_name}</td>
                            <td className="px-4 py-3 font-medium text-yellow-700">{parseFloat(w.amount).toFixed(2)} {currency}</td>
                            <td className="px-4 py-3">{w.bank_name}</td>
                            <td className="px-4 py-3 font-mono text-xs">{w.iban}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{new Date(w.created_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => openApproveModal(w)} className="px-2 py-1 bg-green-500 text-white text-xs rounded">Approve</button>
                                <button onClick={() => updateWithdrawalStatus(w.id, 'rejected', 'Rejected')} className="px-2 py-1 bg-red-500 text-white text-xs rounded">Reject</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : null}

            {/* All Withdrawal Requests */}
            <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-xl font-bold text-amazon-dark">
                      {withdrawalFilter === 'all' ? 'All Withdrawal Requests' : `${withdrawalFilter.charAt(0).toUpperCase() + withdrawalFilter.slice(1)} Withdrawals`}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">Review and manage withdrawal requests</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-500">Total Approved Payouts</p>
                    <p className="text-2xl font-bold text-green-600">{totalApprovedWithdrawals.toFixed(2)} {currency}</p>
                  </div>
                </div>
              </div>
              {withdrawals.filter(w => withdrawalFilter === 'all' || w.status === withdrawalFilter).length === 0 ? (
                <div className="p-8 text-center text-gray-500">No withdrawal requests found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Bank</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">IBAN</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {withdrawals
                        .filter(w => withdrawalFilter === 'all' || w.status === withdrawalFilter)
                        .map((w) => (
                        <tr key={w.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">{w.marketer_name}</td>
                          <td className="px-4 py-3 font-medium">{parseFloat(w.amount).toFixed(2)} {currency}</td>
                          <td className="px-4 py-3">{w.bank_name}</td>
                          <td className="px-4 py-3 font-mono text-xs">{w.iban}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                              w.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              w.status === 'approved' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>{w.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            {w.receipt_url ? (
                              <a href={`http://localhost:5000/uploads/${w.receipt_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                                View Receipt
                              </a>
                            ) : (
                              <span className="text-gray-400 text-xs">-</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {w.status === 'pending' && (
                              <div className="flex gap-1">
                                <button onClick={() => openApproveModal(w)} className="px-2 py-1 bg-green-500 text-white text-xs rounded">Approve</button>
                                <button onClick={() => updateWithdrawalStatus(w.id, 'rejected', 'Rejected')} className="px-2 py-1 bg-red-500 text-white text-xs rounded">Reject</button>
                              </div>
                            )}
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

        {/* SUPPLIER PAYMENTS TAB */}
        {activeTab === 'supplierPayments' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-amazon-dark">Pending Supplier Payments</h2>
                  <p className="text-sm text-gray-500 mt-1">Review and verify payments submitted by suppliers</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500">Total Pending</p>
                  <p className="text-2xl font-bold text-orange-600">{totalSupplierPayments.toFixed(2)} {currency}</p>
                </div>
              </div>
            </div>
            {supplierPayments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No pending supplier payments.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Method</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Transaction Ref</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payment Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Orders</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Receipt</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Submitted</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {supplierPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">#{p.id}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium">{p.supplier_name}</div>
                          <div className="text-xs text-gray-500">{p.supplier_email}</div>
                        </td>
                        <td className="px-4 py-3 font-medium">{parseFloat(p.total_amount).toFixed(2)} {currency}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full capitalize">
                            {p.payment_method.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{p.transaction_reference}</td>
                        <td className="px-4 py-3">{p.payment_date}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                            {p.order_ids ? p.order_ids.length : 0} orders
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {p.receipt_url ? (
                            <a href={`http://localhost:5000/uploads/${p.receipt_url}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">
                              View Receipt
                            </a>
                          ) : (
                            <span className="text-gray-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                            p.status === 'pending_verification' ? 'bg-yellow-100 text-yellow-800' :
                            p.status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {p.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">
                          {p.status === 'pending_verification' && (
                            <div className="flex gap-1">
                              <button 
                                onClick={() => verifySupplierPayment(p.id, 'verified')} 
                                className="px-2 py-1 bg-green-500 text-white text-xs rounded hover:bg-green-600"
                              >
                                Verify
                              </button>
                              <button 
                                onClick={() => verifySupplierPayment(p.id, 'rejected')} 
                                className="px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUPPLIER PAYMENTS STATUS SECTION */}
            <div className="p-4 border-t border-gray-200 mt-4">
              <h3 className="text-lg font-bold text-amazon-dark mb-3">Supplier Payments Status</h3>
            </div>
            {orders.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No orders available.</div>
            ) : (
              <div className="overflow-x-auto px-4 pb-4">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Number</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Amount</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Commission</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Payment</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer Name</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Payment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">#{order.id}</td>
                        <td className="px-4 py-3">{parseFloat(order.total_amount || 0).toFixed(2)} {currency}</td>
                        <td className="px-4 py-3 text-green-700">{parseFloat(order.total_commission || 0).toFixed(2)} {currency}</td>
                        <td className="px-4 py-3 text-blue-700">{parseFloat(order.total_platform_fee || 0).toFixed(2)} {currency}</td>
                        <td className="px-4 py-3 font-medium">
                          {(parseFloat(order.total_amount || 0) - parseFloat(order.total_commission || 0) - parseFloat(order.total_platform_fee || 0)).toFixed(2)} {currency}
                        </td>
                        <td className="px-4 py-3">{order.supplier_name || '-'}</td>
                        <td className="px-4 py-3">{order.marketer_name || '-'}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 text-xs rounded-full capitalize ${
                            order.payment_status === 'waiting_verification' ? 'bg-yellow-100 text-yellow-800' :
                            order.payment_status === 'paid' ? 'bg-green-100 text-green-800' :
                            order.payment_status === 'pending' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {order.payment_status || 'pending'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* SUPPLIER REPORT TAB */}
        {activeTab === 'supplierReport' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-amazon-dark">Supplier Report</h2>
                  <p className="text-sm text-gray-500 mt-1">Order statistics and revenue by supplier</p>
                </div>
              </div>
            </div>
            {supplierReport.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No supplier data available.</div>
            ) : (
              <div className="overflow-x-auto">
                {/* Order Counts Table */}
                <div className="p-4">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Order Counts by Supplier</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Orders</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Not Completed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Completed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Completed Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {supplierReport.map((s) => (
                        <tr key={s.name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3">{s.totalOrders}</td>
                          <td className="px-4 py-3 text-orange-600">{s.notCompleted}</td>
                          <td className="px-4 py-3 text-blue-600">{s.completed}</td>
                          <td className="px-4 py-3 text-green-600">{s.completedPaid}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t font-bold">
                      <tr>
                        <td className="px-4 py-3">TOTALS</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.totalOrders, 0)}</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.notCompleted, 0)}</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.completed, 0)}</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.completedPaid, 0)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Prices Table */}
                <div className="p-4 border-t border-gray-200">
                  <h3 className="text-lg font-bold text-gray-800 mb-3">Revenue by Supplier ({currency})</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Name</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Price</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Not Completed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Completed</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Completed Paid</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {supplierReport.map((s) => (
                        <tr key={s.name} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3">{s.totalPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-orange-600">{s.notCompletedPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-blue-600">{s.completedPrice.toFixed(2)}</td>
                          <td className="px-4 py-3 text-green-600">{s.completedPaidPrice.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-gray-100 border-t font-bold">
                      <tr>
                        <td className="px-4 py-3">TOTALS</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.totalPrice, 0).toFixed(2)}</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.notCompletedPrice, 0).toFixed(2)}</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.completedPrice, 0).toFixed(2)}</td>
                        <td className="px-4 py-3">{supplierReport.reduce((sum, s) => sum + s.completedPaidPrice, 0).toFixed(2)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            {/* Default Platform Fee */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Default Platform Fee Rate</h2>
              <div className="flex items-center gap-3 max-w-md">
                <input type="number" step="0.1" min="0" max="100"
                  value={settings.default_platform_fee_rate || ''}
                  onChange={(e) => setSettings({ ...settings, default_platform_fee_rate: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md w-32 focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                <span className="text-gray-500">%</span>
                <button onClick={saveFeeRate}
                  className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">Save</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">This rate applies to all orders unless overridden at the product or marketer level.</p>
            </div>

            {/* Minimum Withdrawal Amount */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Minimum Withdrawal Amount</h2>
              <div className="flex items-center gap-3 max-w-md">
                <input type="number" step="10" min="0"
                  value={settings.min_withdrawal_amount || ''}
                  onChange={(e) => setSettings({ ...settings, min_withdrawal_amount: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded-md w-32 focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                <span className="text-gray-500">{currency}</span>
                <button onClick={async () => {
                  try {
                    await api.put('/api/settings', { key: 'min_withdrawal_amount', value: settings.min_withdrawal_amount });
                    alert('Minimum withdrawal amount updated');
                  } catch (error) {
                    alert('Failed to update');
                  }
                }}
                  className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">Save</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Marketers can only request withdrawals when their balance is at or above this amount.</p>
            </div>

            {/* Site Domain / Custom URL */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Site Domain (Custom URL)</h2>
              <div className="flex items-center gap-3 max-w-lg">
                <input type="url"
                  value={settings.site_domain || ''}
                  placeholder="https://partnerza.sa"
                  onChange={(e) => setSettings({ ...settings, site_domain: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                <button onClick={async () => {
                  try {
                    await api.put('/api/settings', { key: 'site_domain', value: settings.site_domain || '' });
                    alert('Site domain updated successfully');
                  } catch (error) {
                    alert('Failed to update site domain');
                  }
                }}
                  className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">Save</button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Used for sitemap.xml and SEO. Example: https://partnerza.sa or https://www.partnerza.com</p>
              <p className="text-xs text-gray-400 mt-1">Current: {settings.site_domain || 'Not set (using localhost)'}</p>
            </div>

            {/* Platform Currency */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Platform Currency</h2>
              <div className="flex items-center gap-3 max-w-md">
                <select 
                  value={currency}
                  onChange={async (e) => {
                    const newCurrency = e.target.value;
                    try {
                      await api.patch('/api/settings/currency', { currency: newCurrency });
                      setCurrency(newCurrency);
                      alert('Currency updated successfully');
                    } catch (error) {
                      alert('Failed to update currency');
                    }
                  }}
                  className="px-3 py-2 border border-gray-300 rounded-md w-48 focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white"
                >
                  <option value="SAR">SAR - Saudi Riyal</option>
                  <option value="USD">USD - US Dollar</option>
                  <option value="EUR">EUR - Euro</option>
                  <option value="EGP">EGP - Egyptian Pound</option>
                  <option value="AED">AED - UAE Dirham</option>
                  <option value="KWD">KWD - Kuwaiti Dinar</option>
                  <option value="QAR">QAR - Qatari Riyal</option>
                  <option value="BHD">BHD - Bahraini Dinar</option>
                  <option value="OMR">OMR - Omani Rial</option>
                  <option value="JOD">JOD - Jordanian Dinar</option>
                  <option value="LBP">LBP - Lebanese Pound</option>
                  <option value="IQD">IQD - Iraqi Dinar</option>
                  <option value="MAD">MAD - Moroccan Dirham</option>
                  <option value="TRY">TRY - Turkish Lira</option>
                </select>
              </div>
              <p className="text-xs text-gray-500 mt-2">This currency will be displayed across the entire platform.</p>
            </div>

            {/* Per-Marketer Override */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Per-Marketer Fee Overrides</h2>
              {marketers.length === 0 ? (
                <p className="text-gray-500 text-sm">No marketers found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Marketer</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Email</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Override (%)</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {marketers.map(m => (
                        <tr key={m.id}>
                          <td className="px-4 py-2">{m.name}</td>
                          <td className="px-4 py-2 text-gray-500">{m.email}</td>
                          <td className="px-4 py-2">
                            <input type="number" step="0.1" min="0" max="100"
                              defaultValue={m.platform_fee_rate_override ?? ''}
                              placeholder="Default"
                              id={`mko-${m.id}`}
                              className="px-2 py-1 border border-gray-300 rounded w-24 text-sm" />
                          </td>
                          <td className="px-4 py-2">
                            <button onClick={() => {
                              const val = document.getElementById(`mko-${m.id}`).value;
                              updateMarketerOverride(m.id, val);
                            }} className="px-2 py-1 bg-amazon-orange text-amazon-dark text-xs rounded font-bold">Save</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* VARIANT TEMPLATES MANAGER */}
            <VariantTemplatesManager />
          </div>
        )}

        {/* DATA RESET TAB */}
        {activeTab === 'dataReset' && (
          <div className="space-y-6">
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-red-600 mb-4">Data Reset (Production Prep)</h2>
              <p className="text-gray-600 mb-6">
                This will clear all data (orders, products, withdrawals, payments, commissions) while keeping the database structure intact. 
                This is useful for preparing the system for production mode after testing.
              </p>
              
              <div className="space-y-4">
                <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                  <h3 className="font-bold text-yellow-800 mb-2">Current Data Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div className="bg-white p-3 rounded shadow-sm">
                      <p className="text-gray-500">Orders</p>
                      <p className="text-2xl font-bold text-amazon-dark">{orders.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm">
                      <p className="text-gray-500">Products</p>
                      <p className="text-2xl font-bold text-amazon-dark">{products.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm">
                      <p className="text-gray-500">Withdrawals</p>
                      <p className="text-2xl font-bold text-amazon-dark">{withdrawals.length}</p>
                    </div>
                    <div className="bg-white p-3 rounded shadow-sm">
                      <p className="text-gray-500">Supplier Payments</p>
                      <p className="text-2xl font-bold text-amazon-dark">{supplierPayments.length}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-red-50 border border-red-200 rounded p-4">
                  <h3 className="font-bold text-red-800 mb-2">Danger Zone</h3>
                  <p className="text-sm text-red-700 mb-4">
                    This action cannot be undone. All data will be permanently deleted except user accounts and platform settings.
                  </p>
                  <button 
                    onClick={async () => {
                      if (!confirm('Are you absolutely sure? This will delete ALL orders, products, withdrawals, and payments.\\n\\nType "RESET" to confirm:')) return;
                      const confirmation = prompt('Type "RESET" to permanently delete all data:');
                      if (confirmation !== 'RESET') {
                        alert('Data reset cancelled. You did not type RESET correctly.');
                        return;
                      }
                      try {
                        await api.post('/api/admin/reset-data');
                        alert('All data has been cleared successfully! The system is now ready for production.');
                        fetchData();
                      } catch (error) {
                        alert(error.response?.data?.error || 'Failed to reset data');
                      }
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-full font-bold text-sm"
                  >
                    Reset All Data (Keep Structure)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Receipt Upload Modal */}
      {showReceiptModal && selectedWithdrawal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-amazon-dark mb-4">Approve Withdrawal</h3>
            <div className="mb-4">
              <p className="text-sm text-gray-600">Marketer: <span className="font-medium">{selectedWithdrawal.marketer_name}</span></p>
              <p className="text-sm text-gray-600">Amount: <span className="font-medium">{parseFloat(selectedWithdrawal.amount).toFixed(2)} SAR</span></p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Payment Receipt (Required)</label>
              <input 
                type="file" 
                accept="image/*"
                onChange={(e) => setReceiptFile(e.target.files[0])}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
              />
              <p className="text-xs text-gray-400 mt-1">Upload proof of transfer (image only)</p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Admin Note (Optional)</label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                rows="2"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                placeholder="Add any notes about this payment..."
              />
            </div>

            <div className="flex gap-2">
              <button 
                onClick={handleApproveWithReceipt}
                disabled={!receiptFile}
                className="flex-1 bg-green-500 hover:bg-green-600 text-white py-2 rounded-full font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve with Receipt
              </button>
              <button 
                onClick={() => setShowReceiptModal(false)}
                className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-700 py-2 rounded-full font-bold text-sm"
              >
                Cancel
              </button>
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

                  {/* Marketer & Supplier Info */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-blue-50 p-3 rounded">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Marketer</h4>
                      <div className="text-sm">
                        <p className="font-medium">{orderDetails.marketer_name}</p>
                        <p className="text-gray-600">{orderDetails.marketer_email}</p>
                      </div>
                    </div>
                    {orderDetails.supplier_name && (
                      <div className="bg-green-50 p-3 rounded">
                        <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Supplier</h4>
                        <div className="text-sm">
                          <p className="font-medium">{orderDetails.supplier_name}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Order Items */}
                  {orderDetails.items && orderDetails.items.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">Order Items</h4>
                      <div className="space-y-2">
                        {orderDetails.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-start bg-gray-50 p-3 rounded text-sm">
                            <div className="flex-1">
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-gray-500">{item.quantity} × {parseFloat(item.unit_price).toFixed(2)} SAR</p>
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
                              <p className="font-medium">{parseFloat(item.total_amount).toFixed(2)} SAR</p>
                              <p className="text-xs text-green-600">Commission: {parseFloat(item.marketer_commission_amount).toFixed(2)} SAR</p>
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
                        <span>{(parseFloat(orderDetails.total_amount) - parseFloat(orderDetails.shipment_cost || 0)).toFixed(2)} SAR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Shipping Cost:</span>
                        <span>{parseFloat(orderDetails.shipment_cost || 0).toFixed(2)} SAR</span>
                      </div>
                      <div className="flex justify-between font-bold text-base border-t pt-2">
                        <span>Order Total:</span>
                        <span>{parseFloat(orderDetails.total_amount).toFixed(2)} SAR</span>
                      </div>
                      <div className="flex justify-between text-green-700">
                        <span>Marketer Commission:</span>
                        <span>{parseFloat(orderDetails.total_commission || 0).toFixed(2)} SAR</span>
                      </div>
                      <div className="flex justify-between text-blue-700">
                        <span>Platform Fee:</span>
                        <span>{parseFloat(orderDetails.total_platform_fee || 0).toFixed(2)} SAR</span>
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
  );
}