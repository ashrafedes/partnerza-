import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import api from '../api/axios';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCategory, setSearchCategory] = useState('All');
  const { user, role, logout } = useAuth();
  const { city, loading: cityLoading, setShowSelector } = useCity();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProducts();
  }, []);

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

  // Group products by category
  const grouped = {};
  products.forEach((p) => {
    const cat = p.category || 'General';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(p);
  });
  const categoryNames = Object.keys(grouped);

  // Build card sections from real categories (max 4 per row) - only include categories with products
  const cardSections = categoryNames
    .filter((cat) => grouped[cat].length > 0) // Only categories with products
    .map((cat) => ({
      title: cat,
      items: grouped[cat].slice(0, 4),
    }));

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

        {/* Search Bar */}
        <form onSubmit={(e) => {
          e.preventDefault();
          const params = new URLSearchParams();
          if (searchCategory !== 'All') params.set('category', searchCategory);
          if (searchTerm.trim()) params.set('search', searchTerm.trim());
          navigate(`/marketplace${params.toString() ? '?' + params.toString() : ''}`);
        }} className="flex flex-1 max-w-3xl h-[40px] rounded-md overflow-hidden">
          <select className="bg-gray-200 text-gray-800 text-xs px-2 border-r border-gray-300 focus:outline-none rounded-l-md"
            value={searchCategory} onChange={(e) => setSearchCategory(e.target.value)}>
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
          <input
            type="text"
            placeholder="Search Partnerza"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 text-sm text-gray-900 focus:outline-none"
          />
          <button type="submit" className="bg-amazon-orange hover:brightness-110 px-4 rounded-r-md">
            <svg className="w-5 h-5 text-amazon-dark" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </form>

        {/* Right side */}
        <div className="flex items-center ml-4 space-x-1 text-sm">
          {/* Super Admin Menu */}
          {role === 'superadmin' && (
            <div className="relative group">
              <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
                <span className="text-xs text-gray-300">Hello, {user ? user.name : 'Admin'}</span>
                <br />
                <span className="font-bold text-sm flex items-center">
                  Admin Menu
                  <svg className="w-3 h-3 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                </span>
              </div>
              <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
                <div className="p-3">
                  <Link to="/admin" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Admin Dashboard</Link>
                  <Link to="/admin?tab=orders" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Manage Orders</Link>
                  <Link to="/admin?tab=users" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Manage Users</Link>
                  <Link to="/admin?tab=settings" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Settings & Variants</Link>
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
        <button className="flex items-center font-bold hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm mr-2">
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          All
        </button>
        {categoryNames
          .filter(cat => grouped[cat].length > 0) // Only show categories with products
          .slice(0, 10) // Limit to first 10 categories
          .map((label) => (
            <Link key={label} to={`/marketplace?category=${encodeURIComponent(label)}`} className="hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm mr-1">{label}</Link>
          ))}
        <div className="ml-auto flex items-center space-x-2">
          {role === 'marketer' && user && (
            <Link to="/marketer?tab=orders" className="hover:outline hover:outline-1 hover:outline-white px-2 py-1 rounded-sm mr-2">My Orders</Link>
          )}
          <div className="hidden lg:flex items-center space-x-4 text-xs">
            {!user && (
              <Link to="/register" className="hover:underline font-bold">Start selling on Partnerza today &gt;</Link>
            )}
          </div>
        </div>
      </div>

      {/* ===== HERO BANNER ===== */}
      <div className="relative">
        <div className="h-[200px] md:h-[240px] bg-gradient-to-r from-[#e47911] via-[#f0a040] to-[#ffb366] overflow-hidden relative">
          {/* Decorative pattern overlay */}
          <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.3) 2px, transparent 0)', backgroundSize: '20px 20px'}}></div>
          <div className="max-w-7xl mx-auto px-4 h-full flex items-center relative z-10">
            <div className="text-white">
              <h1 className="text-3xl md:text-4xl font-bold leading-tight drop-shadow-md">
                Start Earning Commissions Today
              </h1>
              <p className="text-lg md:text-xl mt-2 font-medium opacity-95">
                Browse products &amp; submit orders for clients
              </p>
              <Link to="/marketplace" className="inline-block mt-3 bg-white text-[#e47911] px-6 py-2 rounded-full font-bold text-sm hover:shadow-lg hover:scale-105 transition-all">
                Browse Products →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ===== CATEGORY CARDS (below hero) ===== */}
      <div className="max-w-[1400px] mx-auto px-4 mt-6 relative z-10">
        {/* First row of cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
          {cardSections.slice(0, 4).map((section) => (
            <CategoryCard
              key={section.title}
              title={section.title}
              items={section.items}
            />
          ))}

          {/* If fewer than 4 categories and user not logged in, fill with a promo card */}
          {cardSections.length < 4 && !user && (
            <div className="bg-white p-5 shadow-amazon">
              <h3 className="text-lg font-bold text-amazon-dark mb-3">Become a Marketer</h3>
              <div className="bg-amazon-orange rounded p-6 flex flex-col items-center justify-center h-[260px]">
                <p className="text-white text-3xl font-bold text-center leading-tight">Earn<br />Commissions</p>
                <p className="text-white text-xl font-bold mt-2">on every sale</p>
              </div>
              <Link to="/register" className="text-blue-700 hover:text-amazon-orange hover:underline text-sm mt-3 inline-block">
                Sign up now
              </Link>
            </div>
          )}
        </div>

        {/* Second row of cards if more than 4 categories */}
        {cardSections.length > 4 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-5">
            {cardSections.slice(4, 8).map((section) => (
              <CategoryCard
                key={section.title}
                title={section.title}
                items={section.items}
              />
            ))}
          </div>
        )}

        {/* All Products section */}
        <div className="bg-white p-5 shadow-amazon mb-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-amazon-dark">All Products</h2>
            <Link to="/marketplace" className="text-blue-700 hover:text-amazon-orange hover:underline text-sm">See all products</Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {products.slice(0, 12).map((product) => (
              <Link key={product.id} to={`/products/${product.id}`} className="group cursor-pointer">
                <div className="bg-gray-50 rounded overflow-hidden aspect-square flex items-center justify-center p-2">
                  <img
                    src={product.main_image ? `http://localhost:5000/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                    alt={product.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                    onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }}
                  />
                </div>
                <p className="text-sm text-blue-700 hover:text-amazon-orange mt-2 line-clamp-2">{product.name}</p>
                <p className="text-lg font-bold text-amazon-dark">{parseFloat(product.price).toFixed(2)} <span className="text-xs font-normal">SAR</span></p>
                <p className="text-xs text-green-700 font-medium">{product.marketer_commission_rate}% commission</p>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="bg-[#232f3e] text-white mt-8">
        <div className="text-center py-3 bg-[#37475a] hover:bg-[#485769] cursor-pointer text-sm">Back to top</div>
        <div className="max-w-[1400px] mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
          <div>
            <h4 className="font-bold mb-3">Get to Know Us</h4>
            <ul className="space-y-2 text-gray-300">
              <li><Link to="#" className="hover:underline">About Partnerza</Link></li>
              <li><Link to="#" className="hover:underline">Careers</Link></li>
              <li><Link to="#" className="hover:underline">Press Releases</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3">Make Money with Us</h4>
            <ul className="space-y-2 text-gray-300">
              <li><Link to="/register" className="hover:underline">Sell on Partnerza</Link></li>
              <li><Link to="/register" className="hover:underline">Become a Sales Agent</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3">Payment Products</h4>
            <ul className="space-y-2 text-gray-300">
              <li><Link to="#" className="hover:underline">Reload Your Balance</Link></li>
              <li><Link to="#" className="hover:underline">Shop with Points</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold mb-3">Let Us Help You</h4>
            <ul className="space-y-2 text-gray-300">
              <li><Link to="/marketplace" className="hover:underline">Your Account</Link></li>
              <li><Link to="/marketer" className="hover:underline">Your Orders</Link></li>
              <li><Link to="#" className="hover:underline">Shipping Rates</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-600 text-center py-4 text-xs text-gray-400">
          &copy; 2024 Partnerza.sa — Direct Sales Agent Platform
        </div>
      </div>
    </div>
  );
}

/* ===== Category Card Component ===== */
function CategoryCard({ title, items }) {
  return (
    <div className="bg-white p-5 shadow-amazon">
      <h3 className="text-lg font-bold text-amazon-dark mb-3">{title}</h3>
      <div className="grid grid-cols-2 gap-3">
        {items.map((product) => (
          <Link key={product.id} to={`/products/${product.id}`} className="cursor-pointer group">
            <div className="bg-gray-50 rounded overflow-hidden aspect-square flex items-center justify-center p-1">
              <img
                src={product.main_image ? `http://localhost:5000/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                alt={product.name}
                className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-200"
                onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }}
              />
            </div>
            <p className="text-xs text-gray-700 mt-1 line-clamp-1">{product.name}</p>
          </Link>
        ))}
      </div>
      <Link to={`/marketplace?category=${encodeURIComponent(title)}`} className="text-blue-700 hover:text-amazon-orange hover:underline text-sm mt-3 inline-block">
        See more
      </Link>
    </div>
  );
}
