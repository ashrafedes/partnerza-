import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800'
};

export default function MyOrders() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('all');
  const { user, logout } = useAuth();

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const { data } = await api.get('/api/orders');
        setOrders(data);
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOrders();
  }, []);

  const tabs = ['all', 'pending', 'confirmed', 'shipped', 'delivered', 'rejected'];
  const filtered = tab === 'all' ? orders : orders.filter(o => o.status === tab);

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* NAV */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center space-x-3 text-sm">
          <div className="relative group">
            <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
              <span className="text-xs text-gray-300">Hello, {user?.name}</span><br />
              <span className="font-bold text-sm">Account</span>
            </div>
            <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
              <div className="p-3">
                <Link to="/marketplace" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Marketplace</Link>
                <Link to="/my-orders" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Orders</Link>
                <Link to="/withdrawals" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Withdrawals</Link>
                <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Secondary nav */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm">
        <Link to="/marketplace" className="hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm mr-2">Marketplace</Link>
        <Link to="/my-orders" className="hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm mr-2 bg-amazon-orange text-amazon-dark">My Orders</Link>
        <Link to="/withdrawals" className="hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm mr-2">Withdrawals</Link>
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">
        {/* Balance Card */}
        <div className="bg-white p-4 shadow-amazon rounded-sm mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-amazon-dark">My Orders</h1>
            <p className="text-sm text-gray-500">{orders.length} total orders</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Available Balance</p>
            <p className="text-2xl font-bold text-green-700">{parseFloat(user?.balance || 0).toFixed(2)} SAR</p>
            <Link to="/withdrawals" className="text-xs text-amazon-orange hover:underline">Request Withdrawal →</Link>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-sm text-sm font-medium capitalize whitespace-nowrap ${tab === t ? 'bg-amazon-orange text-amazon-dark' : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'}`}
            >
              {t} {t !== 'all' ? `(${orders.filter(o => o.status === t).length})` : `(${orders.length})`}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amazon-orange mx-auto"></div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No orders found.</p>
              <Link to="/marketplace" className="text-amazon-orange hover:underline text-sm mt-2 inline-block">Browse Marketplace →</Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qty</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total (SAR)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission (SAR)</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map(order => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-amazon-dark">#{order.id}</td>
                      <td className="px-4 py-3 text-gray-700">{order.product_name}</td>
                      <td className="px-4 py-3 text-gray-700">{order.client_name}</td>
                      <td className="px-4 py-3 text-gray-700">{order.quantity}</td>
                      <td className="px-4 py-3 font-medium">{parseFloat(order.total_amount).toFixed(2)}</td>
                      <td className="px-4 py-3 text-green-700 font-medium">
                        {order.marketer_commission_amount ? parseFloat(order.marketer_commission_amount).toFixed(2) : (order.total_amount * order.marketer_commission_rate / 100).toFixed(2)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[order.status] || 'bg-gray-100 text-gray-800'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
