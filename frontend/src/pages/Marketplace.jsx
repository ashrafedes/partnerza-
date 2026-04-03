import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import { useCity } from '../context/CityContext';
import api from '../api/axios';

export default function Marketplace() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedCategory, setSelectedCategory] = useState(() => {
    return searchParams.get('category') || 'All';
  });
  const [searchTerm, setSearchTerm] = useState(() => {
    return searchParams.get('search') || '';
  });
  const { user, role, logout } = useAuth();
  const { currency } = useCurrency();
  const { city, loading: cityLoading, setShowSelector } = useCity();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const urlSearch = searchParams.get('search') || '';
    const urlCategory = searchParams.get('category') || 'All';
    setSearchTerm(urlSearch);
    setSelectedCategory(urlCategory);
  }, [searchParams]);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/api/products');
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (selectedCategory !== 'All') params.set('category', selectedCategory);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    setSearchParams(params);
  };

  const getDashboardLink = () => {
    if (role === 'superadmin') return '/admin';
    if (role === 'supplier') return '/supplier';
    return '/marketer';
  };

  // Get unique categories from actual products
  const uniqueCategories = [...new Set(products.map((p) => p.category || 'General'))].filter(c => c);
  const categories = ['All', ...uniqueCategories];
  let filtered = selectedCategory === 'All' ? products : products.filter((p) => (p.category || 'General') === selectedCategory);
  if (searchTerm.trim()) {
    const term = searchTerm.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      (p.name && p.name.toLowerCase().includes(term)) ||
      (p.description && p.description.toLowerCase().includes(term))
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-amazon-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amazon-orange border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>

      {/* ===== TOP NAV ===== */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
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

        <form onSubmit={handleSearch} className="flex flex-1 max-w-3xl h-[40px] rounded-md overflow-hidden mx-4">
          <select className="bg-gray-200 text-gray-800 text-xs px-2 border-r border-gray-300 focus:outline-none rounded-l-md"
            value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="All">All</option>
            <option value="Bazaar">Bazaar</option>
            <option value="Fresh">Fresh</option>
            <option value="Today's Deals">Today's Deals</option>
            <option value="Electronics">Electronics</option>
            <option value="Toys & Games">Toys & Games</option>
            <option value="Supermarket">Supermarket</option>
            <option value="Prime">Prime</option>
            <option value="Fashion">Fashion</option>
            <option value="Home">Home</option>
            <option value="Mobile Phones">Mobile Phones</option>
            <option value="Appliances">Appliances</option>
            <option value="Video Games">Video Games</option>
          </select>
          <input type="text" placeholder="Search Partnerza" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 px-3 text-sm text-gray-900 focus:outline-none" />
          <button type="submit" className="bg-amazon-orange hover:brightness-110 px-4 rounded-r-md">
            <svg className="w-5 h-5 text-amazon-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </form>

        <div className="flex items-center ml-4 space-x-1 text-sm">
          {/* Admin Menu for superadmin */}
          {role === 'superadmin' && (
            <div className="relative group">
              <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
                <span className="text-xs text-gray-300">Hello, {user ? user.name : 'Admin'}</span>
                <br />
                <span className="font-bold text-sm flex items-center">
                  Admin Panel
                  <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </span>
              </div>
              <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
                <div className="p-3">
                  <Link to="/admin" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Admin Dashboard</Link>
                  <Link to="/admin?tab=orders" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Orders</Link>
                  <Link to="/admin?tab=products" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Products</Link>
                  <Link to="/admin?tab=settings" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Platform Settings</Link>
                  <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
                </div>
              </div>
            </div>
          )}

          {/* Account - Hidden for superadmin */}
          {role !== 'superadmin' && (
            <div className="relative group">
              <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
                <span className="text-xs text-gray-300">Hello, {user ? user.name : 'sign in'}</span>
                <br />
                <span className="font-bold text-sm flex items-center">
                  Account &amp; Lists
                  <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </span>
              </div>
              <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
                {!user ? (
                  <div className="p-3">
                    <Link to="/login" className="block w-full text-center bg-amazon-orange hover:brightness-110 text-amazon-dark text-sm font-bold py-2 rounded-md mb-2">Sign in</Link>
                    <p className="text-xs text-gray-500 text-center">New customer? <Link to="/register" className="text-blue-600 hover:underline">Start here.</Link></p>
                  </div>
                ) : (
                  <div className="p-3">
                    {role === 'marketer' ? (
                      <>
                        <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Dashboard</Link>
                        <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Orders</Link>
                        <Link to="/multi-order" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Multi Products Order</Link>
                        <Link to="/marketer?tab=settings" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Profile</Link>
                        <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
                      </>
                    ) : (
                      <>
                        <Link to={role === 'superadmin' ? '/admin' : role === 'supplier' ? '/supplier' : '/marketer'} className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Dashboard</Link>
                        <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders - Hidden for superadmin */}
          {role !== 'superadmin' && (
            <Link to={user ? '/marketer' : '/login'} className="border border-transparent hover:border-white p-1 rounded-sm leading-tight hidden md:block">
              <span className="text-xs text-gray-300">Returns</span>
              <br />
              <span className="font-bold text-sm">&amp; Orders</span>
            </Link>
          )}

          {/* Cart - Hidden for superadmin */}
          {role !== 'superadmin' && (
            <Link to="/marketplace" className="border border-transparent hover:border-white p-1 rounded-sm flex items-end">
              <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" /></svg>
              <span className="font-bold text-sm -mb-0.5">Cart</span>
            </Link>
          )}
        </div>
      </nav>

      {/* ===== SECONDARY NAV ===== */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm overflow-x-auto whitespace-nowrap">
        <button onClick={() => setSelectedCategory('All')} className={`flex items-center font-bold px-2 py-1 rounded-sm mr-2 ${selectedCategory === 'All' ? 'bg-amazon-orange text-amazon-dark' : 'hover:outline hover:outline-1 hover:outline-white'}`}>
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          All
        </button>
        {uniqueCategories
          .filter(cat => cat && cat.trim() !== '')
          .slice(0, 10)
          .map((label) => (
            <button key={label} onClick={() => setSelectedCategory(label)}
              className={`px-2 py-1 rounded-sm mr-1 ${selectedCategory === label ? 'bg-amazon-orange text-amazon-dark' : 'hover:outline hover:outline-1 hover:outline-white'}`}>{label}</button>
          ))}
        {role === 'marketer' && <Link to="/marketer" className="ml-auto hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm">My Orders</Link>}
      </div>

      {/* ===== RESULTS HEADER ===== */}
      <div className="bg-white border-b border-amazon-border px-4 py-3">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing <span className="font-bold text-amazon-dark">{filtered.length}</span> results
            {searchTerm.trim() && <span> for "<span className="font-bold">{searchTerm.trim()}</span>"</span>}
            {selectedCategory !== 'All' && <span> in <span className="font-bold">{selectedCategory}</span></span>}
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="max-w-[1400px] mx-auto px-4 py-4 flex gap-4">
        {/* Sidebar Filters */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="bg-white p-4 shadow-amazon rounded-sm">
            <h3 className="font-bold text-amazon-dark mb-3">Category</h3>
            <ul className="space-y-1 text-sm">
              {categories.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => setSelectedCategory(cat)}
                    className={`block w-full text-left px-2 py-1 rounded ${selectedCategory === cat ? 'font-bold text-amazon-orange bg-orange-50' : 'text-gray-700 hover:text-amazon-orange'}`}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((product) => (
              <div key={product.id} className="bg-white p-4 shadow-amazon hover:shadow-amazon-hover transition-shadow rounded-sm">
                {/* Image */}
                <Link to={`/products/${product.id}`}>
                  <div className="aspect-square bg-gray-50 rounded overflow-hidden flex items-center justify-center p-2 mb-3 cursor-pointer">
                    <img
                      src={product.main_image ? `http://localhost:5000/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                      alt={product.name}
                      className="max-w-full max-h-full object-contain hover:scale-105 transition-transform duration-200"
                      onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }}
                    />
                  </div>
                </Link>

                {/* Info */}
                <Link to={`/products/${product.id}`}>
                  <h3 className="text-sm text-blue-700 hover:text-amazon-orange cursor-pointer line-clamp-2 mb-1">
                    {product.name}
                  </h3>
                </Link>

                <p className="text-xs text-gray-500 mb-1">by {product.supplier_name || 'Unknown'}</p>

                <div className="flex items-baseline space-x-1 mb-1">
                  <span className="text-xs align-top">{currency}</span>
                  <span className="text-xl font-bold text-amazon-dark">{parseFloat(product.price).toFixed(2)}</span>
                </div>

                <div className="bg-green-50 border border-green-200 rounded px-2 py-1 mb-3">
                  <p className="text-xs text-green-700 font-medium">{product.marketer_commission_rate}% commission &middot; Earn {(product.price * product.marketer_commission_rate / 100).toFixed(2)} {currency}</p>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col gap-2">
                  <Link to={`/products/${product.id}`}
                    className="w-full text-center border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-full text-sm font-bold transition-all">
                    View Details
                  </Link>
                  {role === 'marketer' && (
                    <button
                      onClick={() => navigate(`/products/${product.id}/order`)}
                      className="w-full bg-amazon-orange hover:brightness-110 text-amazon-dark py-2 rounded-full text-sm font-bold transition-all">
                      Submit Order
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Empty State */}
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-500 text-lg">No products found.</p>
              {selectedCategory !== 'All' && (
                <button onClick={() => setSelectedCategory('All')} className="text-blue-700 hover:underline mt-2 text-sm">Show all products</button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
