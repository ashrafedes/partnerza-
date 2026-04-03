import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCity } from '../context/CityContext';
import api from '../api/axios';

export default function SubmitOrder() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [shippingRates, setShippingRates] = useState([]);
  const [selectedCity, setSelectedCity] = useState('');
  const [shippingCost, setShippingCost] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    client_name: '',
    client_phone: '',
    quantity: 1,
    client_address: '',
    client_notes: '',
    city: '',
    country: ''
  });
  const [cities, setCities] = useState([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const { user, role, logout } = useAuth();
  const { city: preferredCity } = useCity();
  const navigate = useNavigate();

  // Variant state
  const [productVariants, setProductVariants] = useState([]);
  const [selectedVariants, setSelectedVariants] = useState({});
  const [variantStock, setVariantStock] = useState({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [variantError, setVariantError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [productRes, userRes] = await Promise.all([
          api.get(`/api/products/${id}`),
          api.get('/api/auth/me').catch(() => ({ data: { user: { country: 'Egypt' } } }))
        ]);
        setProduct(productRes.data);
        // Set country from supplier's country and pre-fill city from context
        const supplierCountry = productRes.data?.supplier_country || 'Egypt';
        setForm(prev => ({ 
          ...prev, 
          country: supplierCountry,
          city: preferredCity || ''
        }));
        if (preferredCity) {
          setSelectedCity(preferredCity);
        }
        
        // Fetch product variants
        fetchProductVariants(id);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  // Fetch product variants
  const fetchProductVariants = async (productId) => {
    setLoadingVariants(true);
    try {
      const { data } = await api.get(`/api/products/${productId}/variants`);
      console.log('Variants API response:', data);
      if (data.variants && data.variants.length > 0) {
        console.log('Setting variants:', data.variants);
        setProductVariants(data.variants);
        // Initialize selected variants
        const initial = {};
        data.variants.forEach(v => {
          if (v.is_required !== 0 && v.is_required !== false) {
            initial[v.variant_name] = null;
          }
        });
        console.log('Initial selected variants:', initial);
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
      } else {
        console.log('No variants found in response');
      }
    } catch (err) {
      console.error('Failed to load variants:', err);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Handle variant selection
  const handleVariantSelect = (variantName, option) => {
    setSelectedVariants(prev => ({
      ...prev,
      [variantName]: option
    }));
    setVariantError('');
  };

  // Get stock for current combination
  const getCurrentCombinationStock = () => {
    if (Object.keys(selectedVariants).length === 0) return null;
    const combo = {};
    for (const [key, value] of Object.entries(selectedVariants)) {
      if (value) combo[key] = value;
    }
    if (Object.keys(combo).length === 0) return null;
    const comboKey = JSON.stringify(combo);
    return variantStock[comboKey] ?? 0;
  };

  // Check if all required variants are selected
  const areAllVariantsSelected = () => {
    for (const variant of productVariants) {
      // is_required comes as 0/1 from SQLite, convert to boolean
      const isRequired = variant.is_required !== 0 && variant.is_required !== false;
      if (isRequired && !selectedVariants[variant.variant_name]) {
        return false;
      }
    }
    return true;
  };

  // Fetch cities when country changes (using supplier's country)
  useEffect(() => {
    const fetchCities = async () => {
      const country = product?.supplier_country;
      const supplierId = product?.supplier_id;
      console.log('Fetching cities for:', { country, supplierId, product });
      if (!country) return;
      
      setLoadingCities(true);
      try {
        const res = await api.get(`/api/cities/${encodeURIComponent(country)}`);
        console.log('Cities loaded:', res.data);
        setCities(res.data);
        // Fetch shipping rates for this country filtered by supplier
        const ratesRes = await api.get(`/api/shipping-rates?country=${encodeURIComponent(country)}&supplier_id=${supplierId}`);
        console.log('Shipping rates loaded:', ratesRes.data);
        setShippingRates(ratesRes.data);
      } catch (err) {
        console.error('Failed to load cities or rates:', err);
        setCities([]);
        setShippingRates([]);
      } finally {
        setLoadingCities(false);
      }
    };
    fetchCities();
  }, [product]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    
    // Update shipping cost when city changes (filtered by supplier)
    if (name === 'city') {
      setSelectedCity(value);
      console.log('City selected:', JSON.stringify(value));
      console.log('All rates:', shippingRates.map(r => ({ city: r.city, supplier_id: r.supplier_id, cost: r.cost })));
      const rate = shippingRates.find(r => {
        const match = r.city === value && (r.supplier_id == product?.supplier_id || r.supplier_id === null);
        console.log(`Checking: ${r.city} vs ${value} = ${r.city === value}, supplier: ${r.supplier_id} vs ${product?.supplier_id} = ${r.supplier_id == product?.supplier_id || r.supplier_id === null}, match=${match}`);
        return match;
      });
      console.log('Found rate:', rate);
      setShippingCost(rate ? rate.cost : 0);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate variant selections
    if (productVariants.length > 0) {
      if (!areAllVariantsSelected()) {
        setVariantError('Please select all required variants');
        return;
      }
      
      // Check stock for variant combination
      const stock = getCurrentCombinationStock();
      if (stock !== null && stock < parseInt(form.quantity)) {
        setVariantError(`Only ${stock} units available for this variant combination`);
        return;
      }
    }
    
    setSubmitting(true);
    setError('');
    try {
      const orderData = {
        product_id: parseInt(id),
        quantity: parseInt(form.quantity),
        client_name: form.client_name,
        client_phone: form.client_phone,
        client_address: form.client_address,
        client_notes: form.client_notes,
        city: form.city,
        shipment_cost: shippingCost
      };
      
      // Add selected variants if any
      if (productVariants.length > 0 && areAllVariantsSelected()) {
        orderData.selected_variants = selectedVariants;
      }
      
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

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-amazon-light">
        <p className="text-gray-600">Product not found. <Link to="/marketplace" className="text-amazon-orange hover:underline">Back to Marketplace</Link></p>
      </div>
    );
  }

  const itemsTotal = (product.price * (parseInt(form.quantity) || 1));
  const totalAmount = (itemsTotal + shippingCost).toFixed(2);
  const estimatedCommission = (itemsTotal * product.marketer_commission_rate / 100).toFixed(2);

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
          <p className="text-gray-600 mb-4">Your order for <strong>{product.name}</strong> has been submitted successfully. The supplier will review it shortly.</p>
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
                <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Orders</Link>
                <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[900px] mx-auto px-4 py-6">
        <div className="mb-4 text-sm text-gray-500">
          <Link to="/marketplace" className="hover:text-amazon-orange">Marketplace</Link>
          <span className="mx-1">›</span>
          <Link to={`/products/${product.id}`} className="hover:text-amazon-orange">{product.name}</Link>
          <span className="mx-1">›</span>
          <span className="text-gray-700">Submit Order</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Order Form */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-sm shadow-amazon p-6">
              <h1 className="text-xl font-bold text-amazon-dark mb-4">Submit Order for Client</h1>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded mb-4 text-sm">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Name *</label>
                  <input
                    type="text" name="client_name" value={form.client_name} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange text-sm"
                    placeholder="Enter client's full name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Phone *</label>
                  <input
                    type="text" name="client_phone" value={form.client_phone} onChange={handleChange} required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange text-sm"
                    placeholder="e.g. 966501234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity *</label>
                  <input
                    type="number" name="quantity" value={form.quantity} onChange={handleChange} min="1" required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange text-sm"
                  />
                </div>

                {/* VARIANT SELECTORS */}
                {loadingVariants ? (
                  <div className="py-4 text-center">
                    <div className="animate-spin inline-block w-5 h-5 border-2 border-amazon-orange border-t-transparent rounded-full"></div>
                    <p className="text-xs text-gray-500 mt-1">Loading variants...</p>
                  </div>
                ) : productVariants.length > 0 ? (
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <h3 className="text-sm font-semibold text-gray-700 mb-3">Select Product Variants</h3>
                    
                    {variantError && (
                      <div className="bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded mb-3 text-sm">
                        {variantError}
                      </div>
                    )}
                    
                    <div className="space-y-4">
                      {productVariants.map((variant) => {
                        const isRequired = variant.is_required !== 0 && variant.is_required !== false;
                        return (
                          <div key={variant.variant_name}>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              {variant.variant_name}
                              {isRequired && <span className="text-red-500 ml-1">*</span>}
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
                                        : 'bg-white text-gray-700 border-2 border-gray-300 hover:border-amazon-orange'
                                    }`}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Stock info for selected combination */}
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
                  </div>
                ) : null}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Country *</label>
                  <input
                    type="text"
                    value={product?.supplier_country || 'Loading...'}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100 text-gray-600 text-sm"
                  />
                  <input type="hidden" name="country" value={form.country} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <select
                    name="city" value={form.city} onChange={handleChange} required
                    disabled={!form.country || loadingCities || cities.length === 0}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange text-sm bg-white disabled:bg-gray-100 disabled:cursor-not-allowed"
                  >
                    <option value="">
                      {loadingCities ? 'Loading cities...' : 
                       !form.country ? 'Select country first' : 
                       cities.length === 0 ? 'No cities available' : 'Select City'}
                    </option>
                    {cities.map(city => {
                      const rate = shippingRates.find(r => r.city === city && r.supplier_id === product?.supplier_id);
                      return (
                        <option key={city} value={city}>
                          {city} {rate ? `- ${parseFloat(rate.cost).toFixed(2)} SAR` : ''}
                        </option>
                      );
                    })}
                  </select>
                  {cities.length === 0 && form.country && !loadingCities && (
                    <p className="text-xs text-red-500 mt-1">
                      No cities found for this country. Cities will be imported when you save settings in your profile.
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Delivery Address</label>
                  <input
                    type="text" name="client_address" value={form.client_address} onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange text-sm"
                    placeholder="Client's delivery address"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <textarea
                    name="client_notes" value={form.client_notes} onChange={handleChange} rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange text-sm"
                    placeholder="Any special instructions or notes"
                  />
                </div>

                <button
                  type="submit" disabled={submitting}
                  className="w-full bg-amazon-orange hover:brightness-110 text-amazon-dark py-3 rounded-full font-bold text-sm disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Place Order'}
                </button>
              </form>
            </div>
          </div>

          {/* Order Summary */}
          <div>
            <div className="bg-white rounded-sm shadow-amazon p-4">
              <h3 className="font-bold text-amazon-dark mb-3">Order Summary</h3>
              <div className="flex gap-3 mb-3">
                {(() => {
                  // Get main image or first image
                  let imgSrc = null;
                  if (product.main_media_type === 'image' && product.main_media_id && product.images) {
                    const mainImg = product.images.find(img => img.id === product.main_media_id);
                    if (mainImg) imgSrc = mainImg.image_path || mainImg;
                  } else if (product.images && product.images.length > 0) {
                    imgSrc = product.images[0].image_path || product.images[0];
                  }
                  return imgSrc ? (
                    <img src={`http://localhost:5000/uploads/${imgSrc}`} alt="" className="w-16 h-16 object-cover rounded border" />
                  ) : product.videos && product.videos.length > 0 ? (
                    <div className="w-16 h-16 bg-gray-100 rounded border flex items-center justify-center">
                      <span className="text-xs text-gray-500">Video</span>
                    </div>
                  ) : null;
                })()}
                <div>
                  <p className="text-sm font-semibold text-amazon-dark">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.supplier_name}</p>
                </div>
              </div>
              <div className="border-t border-gray-200 pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Unit Price</span>
                  <span>{parseFloat(product.price).toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Quantity</span>
                  <span>{parseInt(form.quantity) || 1}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Subtotal</span>
                  <span>{itemsTotal.toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Shipping</span>
                  <span>{shippingCost.toFixed(2)} SAR</span>
                </div>
                <div className="flex justify-between font-bold text-amazon-dark border-t pt-2">
                  <span>Total</span>
                  <span>{totalAmount} SAR</span>
                </div>
                <div className="flex justify-between text-green-700 border-t pt-2">
                  <span>Your Commission ({product.marketer_commission_rate}%)</span>
                  <span className="font-semibold">{estimatedCommission} SAR</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
