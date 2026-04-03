import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import api from '../api/axios';

export default function SubmitMultiOrder() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [cart, setCart] = useState([]);
  const [shippingRates, setShippingRates] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    client_address: '',
    client_notes: '',
    city: ''
  });
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showProductModal, setShowProductModal] = useState(false);
  
  // Variant state for multi-order
  const [productVariants, setProductVariants] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [variantStock, setVariantStock] = useState({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantError, setVariantError] = useState('');
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [pendingProduct, setPendingProduct] = useState(null);
  
  const { user, role, logout } = useAuth();
  const { city: preferredCity } = useCity();
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
    // Pre-fill city from context if available
    if (preferredCity) {
      setSelectedCity(preferredCity);
      setForm(prev => ({ ...prev, city: preferredCity }));
    }
  }, [preferredCity]);

  const fetchData = async () => {
    try {
      const [productsRes, ratesRes] = await Promise.all([
        api.get('/api/products'),
        api.get('/api/shipping-rates').catch(() => ({ data: [] }))
      ]);
      setProducts(productsRes.data);
      setShippingRates(ratesRes.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async (product) => {
    // Check if cart already has items from a different supplier
    if (cart.length > 0) {
      const existingSupplierId = cart[0].supplier_id;
      if (product.supplier_id !== existingSupplierId) {
        const existingSupplierName = cart[0].supplier_name;
        alert(`Cannot add products from different suppliers in one order.\n\nCurrent order supplier: ${existingSupplierName}\nSelected product supplier: ${product.supplier_name}\n\nPlease create a separate order for products from ${product.supplier_name}.`);
        return;
      }
    }
    
    // Check if product has variants
    setLoadingVariants(true);
    try {
      const { data } = await api.get(`/api/products/${product.id}/variants`);
      if (data.variants && data.variants.length > 0) {
        // Product has variants - show variant selector
        setProductVariants(data.variants);
        setPendingProduct(product);
        
        // Initialize selected variants
        const initial = {};
        data.variants.forEach(v => {
          if (v.is_required) {
            initial[v.variant_name] = null;
          }
        });
        setSelectedVariants(initial);
        
        // Store stock info
        const stockMap = {};
        if (data.stock) {
          data.stock.forEach(s => {
            const key = JSON.stringify(s.combination);
            stockMap[key] = s.stock_quantity;
          });
        }
        setVariantStock(stockMap);
        setVariantError('');
        setShowVariantModal(true);
        return;
      }
    } catch (err) {
      console.error('Failed to check variants:', err);
    } finally {
      setLoadingVariants(false);
    }
    
    // No variants - add directly
    addProductToCart(product, null);
  };
  
  const addProductToCart = (product, variants) => {
    const existingItem = cart.find(item => 
      item.id === product.id && 
      JSON.stringify(item.selected_variants || {}) === JSON.stringify(variants || {})
    );
    if (existingItem) {
      setCart(cart.map(item => 
        item.id === product.id && 
        JSON.stringify(item.selected_variants || {}) === JSON.stringify(variants || {})
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, { ...product, quantity: 1, selected_variants: variants }]);
    }
    setShowVariantModal(false);
    setPendingProduct(null);
    setSelectedVariants({});
    setProductVariants([]);
  };
  
  // Handle variant selection in modal
  const handleVariantSelect = (variantName, option) => {
    setSelectedVariants(prev => ({
      ...prev,
      [variantName]: option
    }));
    setVariantError('');
  };
  
  // Check if all required variants selected
  const areAllVariantsSelected = () => {
    for (const variant of productVariants) {
      if (variant.is_required !== false && !selectedVariants[variant.variant_name]) {
        return false;
      }
    }
    return true;
  };
  
  // Get stock for current combination
  const getCurrentCombinationStock = () => {
    const combo = {};
    for (const [key, value] of Object.entries(selectedVariants)) {
      if (value) combo[key] = value;
    }
    if (Object.keys(combo).length === 0) return null;
    const comboKey = JSON.stringify(combo);
    return variantStock[comboKey] ?? 0;
  };
  
  // Confirm variant selection
  const confirmVariantSelection = () => {
    if (!areAllVariantsSelected()) {
      setVariantError('Please select all required variants');
      return;
    }
    
    const stock = getCurrentCombinationStock();
    if (stock !== null && stock < 1) {
      setVariantError('Out of stock for this variant combination');
      return;
    }
    
    addProductToCart(pendingProduct, selectedVariants);
  };
  
  const closeVariantModal = () => {
    setShowVariantModal(false);
    setPendingProduct(null);
    setSelectedVariants({});
    setProductVariants([]);
    setVariantError('');
  };

  const updateQuantity = (productId, quantity) => {
    if (quantity <= 0) {
      setCart(cart.filter(item => item.id !== productId));
    } else {
      setCart(cart.map(item => 
        item.id === productId 
          ? { ...item, quantity: parseInt(quantity) }
          : item
      ));
    }
  };

  const removeFromCart = (productId) => {
    setCart(cart.filter(item => item.id !== productId));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    
    if (name === 'city') {
      setSelectedCity(value);
      // Filter rates by supplier from cart
      const supplierId = cart.length > 0 ? cart[0].supplier_id : null;
      const rate = shippingRates.find(r => r.city === value && r.supplier_id === supplierId);
      setShippingCost(rate ? rate.cost : 0);
    }
  };

  const openProductDetails = (product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const closeProductModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  const calculateTotals = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalCommission = cart.reduce((sum, item) => {
      const itemTotal = item.price * item.quantity;
      return sum + (itemTotal * item.marketer_commission_rate / 100);
    }, 0);
    return { subtotal, totalCommission, total: subtotal + shippingCost };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (cart.length === 0) {
      setError('Please add at least one product to the order');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      const orderData = {
        items: cart.map(item => ({
          product_id: item.id,
          quantity: item.quantity,
          price: item.price,
          selected_variants: item.selected_variants || null
        })),
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_address: form.client_address,
        client_notes: form.client_notes,
        city: form.city,
        shipment_cost: shippingCost
      };
      
      await api.post('/api/orders', orderData);
      setSuccess(true);
    } catch (err) {
      console.error('Submit order error:', err);
      setError(err.response?.data?.error || 'Failed to submit order');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amazon-light">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amazon-orange"></div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-amazon-light flex items-center justify-center" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
        <div className="bg-white p-8 rounded-sm shadow-amazon max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-amazon-dark mb-2">Order Submitted!</h2>
          <p className="text-gray-600 mb-4">Your order for {cart.length} product(s) has been submitted successfully. The suppliers will review them shortly.</p>
          <div className="flex flex-col gap-2">
            <Link to="/marketer" className="bg-amazon-orange hover:brightness-110 text-amazon-dark py-2 rounded-full font-bold text-sm">
              View My Orders
            </Link>
            <Link to="/marketplace" className="border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-full font-bold text-sm">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { subtotal, totalCommission, total } = calculateTotals();

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* TOP NAV */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <span className="text-sm text-gray-300 mx-4">Submit Multi-Product Order</span>
        <div className="flex-1" />
        <div className="flex items-center space-x-3 text-sm">
          <Link to="/marketplace" className="border border-transparent hover:border-white p-1 rounded-sm">Marketplace</Link>
          <div className="relative group">
            <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
              <span className="text-xs text-gray-300">Hello, {user?.name || 'marketer'}</span><br />
              <span className="font-bold text-sm">Account</span>
            </div>
            <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
              <div className="p-3">
                <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Dashboard</Link>
                <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Orders</Link>
                <Link to="/multi-order" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Multi Products Order</Link>
                <Link to="/marketer?tab=profile" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Profile</Link>
                <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Products List */}
          <div className="lg:col-span-2">
            <div className="bg-white p-6 shadow-amazon rounded-sm">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Select Products</h2>
              {products.length === 0 ? (
                <p className="text-gray-500">No products available.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {products.map((product) => {
                    const cartItem = cart.find(item => item.id === product.id);
                    return (
                      <div key={product.id} className="border border-amazon-border rounded p-4">
                        <div className="aspect-square bg-gray-50 rounded mb-3 overflow-hidden">
                          <img
                            src={product.main_image ? `/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                            alt={product.name} className="w-full h-full object-contain"
                            onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }} />
                        </div>
                        <h3 className="font-semibold text-amazon-dark mb-1 line-clamp-2">{product.name}</h3>
                        <p className="text-sm text-gray-500 mb-2">{product.supplier_name}</p>
                        <p className="text-lg font-bold text-amazon-dark mb-1">{parseFloat(product.price).toFixed(2)} SAR</p>
                        <p className="text-xs text-green-600 mb-1">{product.marketer_commission_rate}% commission</p>
                        <p className={`text-xs mb-2 ${product.stock_quantity > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                          Stock: {product.stock_quantity || 0} available
                        </p>
                        <div className="flex gap-2">
                          <button onClick={() => openProductDetails(product)}
                            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-1.5 rounded text-xs font-medium">
                            Details
                          </button>
                          {cartItem ? (
                            <div className="flex items-center gap-2 flex-1 justify-center">
                              <button onClick={() => updateQuantity(product.id, cartItem.quantity - 1)}
                                className="w-7 h-7 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center text-sm">
                                -
                              </button>
                              <span className="w-8 text-center text-sm">{cartItem.quantity}</span>
                              <button onClick={() => updateQuantity(product.id, cartItem.quantity + 1)}
                                className="w-7 h-7 rounded-full border border-gray-300 hover:border-gray-400 flex items-center justify-center text-sm">
                                +
                              </button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product)}
                              disabled={product.stock_quantity <= 0 || loadingVariants}
                              className="flex-1 bg-amazon-orange hover:brightness-110 disabled:bg-gray-300 disabled:cursor-not-allowed text-amazon-dark py-1.5 rounded text-xs font-bold">
                              {loadingVariants ? 'Loading...' : product.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cart & Order Form */}
          <div className="lg:col-span-1">
            {/* Cart */}
            <div className="bg-white p-6 shadow-amazon rounded-sm mb-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Cart ({cart.length})</h2>
              {cart.length === 0 ? (
                <p className="text-gray-500 text-sm">Your cart is empty</p>
              ) : (
                <div className="space-y-3 mb-4">
                  {cart.map((item) => (
                    <div key={`${item.id}-${JSON.stringify(item.selected_variants || {})}`} className="flex justify-between items-center text-sm">
                      <div className="flex-1">
                        <p className="font-medium line-clamp-1">{item.name}</p>
                        <p className="text-gray-500">{item.quantity} × {parseFloat(item.price).toFixed(2)} SAR</p>
                        {item.selected_variants && Object.keys(item.selected_variants).length > 0 && (
                          <p className="text-xs text-amazon-orange">
                            {Object.entries(item.selected_variants)
                              .map(([k, v]) => `${k}: ${v}`).join(', ')}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{(item.price * item.quantity).toFixed(2)} SAR</span>
                        <button onClick={() => removeFromCart(item.id)}
                          className="text-red-500 hover:text-red-700">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t pt-3">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Subtotal:</span>
                      <span className="font-medium">{subtotal.toFixed(2)} SAR</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Shipping:</span>
                      <span className="font-medium">{shippingCost.toFixed(2)} SAR</span>
                    </div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Your Commission:</span>
                      <span className="font-medium text-green-600">{totalCommission.toFixed(2)} SAR</span>
                    </div>
                    <div className="flex justify-between font-bold border-t pt-2">
                      <span>Total:</span>
                      <span>{total.toFixed(2)} SAR</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Order Form */}
            <div className="bg-white p-6 shadow-amazon rounded-sm">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Client Information</h2>
              {error && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-800 mb-4">
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                  <input type="text" name="client_name" required
                    value={form.client_name} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Phone *</label>
                  <input type="tel" name="client_phone" required
                    value={form.client_phone} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <select name="city" required
                    value={form.city} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white">
                    <option value="">Select City</option>
                    {shippingRates
                      .filter(rate => cart.length === 0 || rate.supplier_id === cart[0].supplier_id)
                      .map(rate => (
                      <option key={rate.id} value={rate.city}>
                        {rate.city} - {parseFloat(rate.cost).toFixed(2)} SAR
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Address</label>
                  <textarea name="client_address" rows="2"
                    value={form.client_address} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"></textarea>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Notes</label>
                  <textarea name="client_notes" rows="2"
                    value={form.client_notes} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"></textarea>
                </div>
                <button type="submit" disabled={submitting || cart.length === 0}
                  className="w-full bg-amazon-orange hover:brightness-110 text-amazon-dark py-2 rounded-full font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'Submitting...' : 'Submit Order'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* Product Details Modal */}
      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-amazon-dark">Product Details</h2>
              <button 
                onClick={closeProductModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="aspect-square bg-gray-50 rounded mb-4 overflow-hidden">
                <img
                  src={selectedProduct.main_image ? `http://localhost:5000/uploads/${selectedProduct.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                  alt={selectedProduct.name} className="w-full h-full object-contain"
                  onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }} />
              </div>
              <h3 className="text-2xl font-bold text-amazon-dark mb-2">{selectedProduct.name}</h3>
              <p className="text-gray-600 mb-4">{selectedProduct.description || 'No description available'}</p>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <span className="text-sm text-gray-500">Price:</span>
                  <p className="text-xl font-bold text-amazon-dark">{parseFloat(selectedProduct.price).toFixed(2)} SAR</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Commission:</span>
                  <p className="text-lg font-medium text-green-600">{selectedProduct.marketer_commission_rate}%</p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Stock Available:</span>
                  <p className={`text-lg font-medium ${selectedProduct.stock_quantity > 0 ? 'text-blue-600' : 'text-red-500'}`}>
                    {selectedProduct.stock_quantity || 0} units
                  </p>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Supplier:</span>
                  <p className="text-lg font-medium text-gray-700">{selectedProduct.supplier_name}</p>
                </div>
              </div>
              <div className="flex gap-3 pt-4 border-t">
                <button 
                  onClick={() => {
                    addToCart(selectedProduct);
                    closeProductModal();
                  }}
                  disabled={selectedProduct.stock_quantity <= 0}
                  className="flex-1 bg-amazon-orange hover:brightness-110 disabled:bg-gray-300 disabled:cursor-not-allowed text-amazon-dark py-2 rounded-full font-bold text-sm"
                >
                  {selectedProduct.stock_quantity > 0 ? 'Add to Cart' : 'Out of Stock'}
                </button>
                <button 
                  onClick={closeProductModal}
                  className="px-6 py-2 border border-gray-300 hover:border-gray-400 rounded-full text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VARIANT SELECTOR MODAL */}
      {showVariantModal && pendingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h2 className="text-xl font-bold text-amazon-dark">Select Variants</h2>
              <button 
                onClick={closeVariantModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <h3 className="font-semibold text-gray-700 mb-4">{pendingProduct.name}</h3>
              
              {variantError && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded mb-4 text-sm">
                  {variantError}
                </div>
              )}
              
              <div className="space-y-4">
                {productVariants.map((variant) => (
                  <div key={variant.variant_name}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      {variant.variant_name}
                      {variant.is_required !== false && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {variant.options.map((option) => {
                        const isSelected = selectedVariants[variant.variant_name] === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => handleVariantSelect(variant.variant_name, option)}
                            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                              isSelected
                                ? 'bg-amazon-orange text-amazon-dark border-2 border-amazon-orange'
                                : 'bg-gray-100 text-gray-700 border-2 border-gray-300 hover:border-amazon-orange'
                            }`}
                          >
                            {option}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Stock info */}
              {areAllVariantsSelected() && (
                <div className="mt-4 pt-3 border-t">
                  <p className="text-sm text-gray-600">
                    Selected: {Object.entries(selectedVariants)
                      .filter(([_, v]) => v)
                      .map(([k, v]) => `${k}: ${v}`).join(', ')}
                  </p>
                  {(() => {
                    const stock = getCurrentCombinationStock();
                    if (stock !== null) {
                      return stock > 0 ? (
                        <p className="text-sm text-green-600 mt-1">
                          {stock} units available
                        </p>
                      ) : (
                        <p className="text-sm text-red-500 mt-1 font-medium">
                          Out of stock for this combination
                        </p>
                      );
                    }
                    return null;
                  })()}
                </div>
              )}
              
              <div className="flex gap-3 pt-4 border-t mt-4">
                <button 
                  onClick={confirmVariantSelection}
                  className="flex-1 bg-amazon-orange hover:brightness-110 text-amazon-dark py-2 rounded-full font-bold text-sm"
                >
                  Add to Cart
                </button>
                <button 
                  onClick={closeVariantModal}
                  className="px-6 py-2 border border-gray-300 hover:border-gray-400 rounded-full text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
