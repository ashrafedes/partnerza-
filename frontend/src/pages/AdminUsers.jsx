import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const roleColors = {
  superadmin: 'bg-purple-100 text-purple-800',
  supplier: 'bg-blue-100 text-blue-800',
  marketer: 'bg-green-100 text-green-800'
};

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const { logout } = useAuth();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/auth/users');
      setUsers(response.data.users);
    } catch (err) {
      setError('Failed to load users');
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId, userName) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) return;
    
    try {
      await api.delete(`/api/auth/users/${userId}`);
      alert('User deleted successfully');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const updateRole = async (userId, newRole) => {
    try {
      await api.patch(`/api/auth/users/${userId}/role`, { role: newRole });
      alert('Role updated successfully');
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update role');
    }
  };

  const resetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await api.post(`/api/auth/users/${selectedUser.id}/reset-password`, { newPassword });
      alert(`Password reset successfully for ${selectedUser.name}`);
      setShowResetModal(false);
      setNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to reset password');
    }
  };

  const filteredUsers = users.filter(user => 
    user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-amazon-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amazon-orange"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* Top Nav */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center space-x-3">
          <Link to="/admin" className="border border-transparent hover:border-white p-1 rounded-sm text-sm">
            <span className="text-xs text-gray-300">Admin</span><br />
            <span className="font-bold">Dashboard</span>
          </Link>
          <button onClick={logout} className="bg-amazon-orange text-amazon-dark px-3 py-1 rounded-full font-bold text-sm">
            Logout
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-amazon-dark">User Management</h1>
          <Link 
            to="/admin" 
            className="text-amazon-orange hover:text-orange-600 font-medium"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md px-4 py-2 border border-amazon-border rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white shadow-lg border border-amazon-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-amazon-border">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Email</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Role</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Phone</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Business</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-900">{user.name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.role}
                        onChange={(e) => updateRole(user.id, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-0 ${roleColors[user.role] || 'bg-gray-100'}`}
                      >
                        <option value="marketer">Marketer</option>
                        <option value="supplier">Supplier</option>
                        <option value="superadmin">Superadmin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.phone || user.whatsapp || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {user.business_name || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm space-x-2">
                      <button
                        onClick={() => {
                          setSelectedUser(user);
                          setShowResetModal(true);
                        }}
                        className="text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Reset Password
                      </button>
                      <button
                        onClick={() => deleteUser(user.id, user.name)}
                        className="text-red-600 hover:text-red-800 font-medium"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow border border-amazon-border">
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-amazon-dark">{users.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-amazon-border">
            <p className="text-sm text-gray-600">Suppliers</p>
            <p className="text-2xl font-bold text-blue-600">{users.filter(u => u.role === 'supplier').length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow border border-amazon-border">
            <p className="text-sm text-gray-600">Marketers</p>
            <p className="text-2xl font-bold text-green-600">{users.filter(u => u.role === 'marketer').length}</p>
          </div>
        </div>
      </div>

      {/* Reset Password Modal */}
      {showResetModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-bold text-amazon-dark mb-4">
              Reset Password for {selectedUser.name}
            </h3>
            <input
              type="password"
              placeholder="Enter new password (min 6 characters)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2 border border-amazon-border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-amazon-orange"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowResetModal(false);
                  setNewPassword('');
                  setSelectedUser(null);
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={resetPassword}
                className="px-4 py-2 bg-amazon-orange text-white rounded-md hover:bg-orange-600"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
