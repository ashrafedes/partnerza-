import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCurrency } from '../context/CurrencyContext';
import api from '../api/axios';

const statusColors = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  delivered: 'bg-green-100 text-green-800',
  completed: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-red-100 text-red-800',
  paused: 'bg-gray-100 text-gray-800',
  approved: 'bg-blue-100 text-blue-800',
  paid: 'bg-green-100 text-green-800'
};

const categories = [
  'Bazaar','Fresh',"Today's Deals",'Electronics','Toys & Games',
  'Supermarket','Prime','Fashion','Home','Mobile Phones','Appliances','Video Games'
];

export default function SupplierDashboard() {
  const { user, logout, setUser } = useAuth();
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('supplierActiveTab') || 'products';
  });
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '', description: '', price: '', marketer_commission_rate: '', category: '', stock_quantity: '0'
  });
  const [specs, setSpecs] = useState([{ spec_key: '', spec_value: '' }]);
  const [images, setImages] = useState([]);
  const [video, setVideo] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '', description: '', price: '', marketer_commission_rate: '', category: '', status: 'active', stock_quantity: '0'
  });
  const [editSpecs, setEditSpecs] = useState([{ spec_key: '', spec_value: '' }]);
  const [editImages, setEditImages] = useState([]);
  const [editVideo, setEditVideo] = useState(null);
  const [existingVideo, setExistingVideo] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [selectedPaymentOrders, setSelectedPaymentOrders] = useState([]);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState({
    transactionReference: '',
    paymentDate: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [paymentReceipt, setPaymentReceipt] = useState(null);
  
  // Shipping rates state
  const [shippingRates, setShippingRates] = useState([]);
  const [shippingCountry, setShippingCountry] = useState('Egypt');
  const [newRateForm, setNewRateForm] = useState({ city: '', cost: '' });
  const [availableCities, setAvailableCities] = useState([]);
  
  // Settings state
  const [settingsForm, setSettingsForm] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    telegram: '',
    website: '',
    email: '',
    business_name: '',
    business_email: '',
    business_phone: ''
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Order details modal state
  const [platformSettings, setPlatformSettings] = useState({ default_platform_fee_rate: 5 });
  const [existingImages, setExistingImages] = useState([]);
  const [mainImageId, setMainImageId] = useState(null);
  const [mainMediaType, setMainMediaType] = useState('image');
  const [mainMediaId, setMainMediaId] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  
  // Variant management state
  const [categoryTemplates, setCategoryTemplates] = useState([]);
  const [productVariants, setProductVariants] = useState([]);
  const [variantStock, setVariantStock] = useState({});
  const [loadingVariants, setLoadingVariants] = useState(false);
  
  // Edit form variant state
  const [editProductVariants, setEditProductVariants] = useState([]);
  const [editVariantStock, setEditVariantStock] = useState({});
  const [editCategoryTemplates, setEditCategoryTemplates] = useState([]);
  const [loadingEditVariants, setLoadingEditVariants] = useState(false);
  
  const { currency } = useCurrency();
  const location = useLocation();

  useEffect(() => { 
    fetchProducts(); 
    fetchOrders();
    fetchShippingRates();
    fetchPlatformSettings();
    fetchUserProfile(); // Load profile data on mount
    
    // Check for edit query parameter
    const params = new URLSearchParams(location.search);
    const editId = params.get('edit');
    if (editId) {
      // Find the product and open edit form
      setTimeout(() => {
        const productToEdit = products.find(p => p.id === parseInt(editId));
        if (productToEdit) {
          handleEdit(productToEdit);
        }
      }, 500);
    }
  }, []);

  // Fetch profile when profile tab becomes active
  useEffect(() => {
    if (activeTab === 'profile') {
      fetchUserProfile();
    }
  }, [activeTab]);

  const fetchProducts = async () => {
    try {
      const { data } = await api.get('/api/products/supplier/mine');
      setProducts(data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrders = async () => {
    try {
      const { data } = await api.get('/api/orders');
      setOrders(data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    }
  };

  const fetchPlatformSettings = async () => {
    try {
      const { data } = await api.get('/api/settings');
      if (data.settings && data.settings.default_platform_fee_rate) {
        setPlatformSettings({
          default_platform_fee_rate: parseFloat(data.settings.default_platform_fee_rate)
        });
      }
    } catch (error) {
      console.error('Failed to fetch platform settings:', error);
    }
  };

  const fetchShippingRates = async () => {
    try {
      const { data } = await api.get('/api/shipping-rates/my-rates');
      setShippingRates(data);
    } catch (error) {
      console.error('Failed to fetch shipping rates:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      const { data } = await api.get('/api/auth/me');
      if (data.user) {
        setSettingsForm({
          name: data.user.name || '',
          phone: data.user.phone || '',
          whatsapp: data.user.whatsapp || '',
          telegram: data.user.telegram || '',
          website: data.user.website || '',
          email: data.user.email || '',
          business_name: data.user.business_name || '',
          business_email: data.user.business_email || '',
          business_phone: data.user.business_phone || ''
        });
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  // ============ VARIANT MANAGEMENT FUNCTIONS ============
  
  // Fetch variant templates for a category
  const fetchCategoryTemplates = async (category) => {
    if (!category) return;
    setLoadingVariants(true);
    try {
      const { data } = await api.get(`/api/variants/templates/${encodeURIComponent(category)}`);
      setCategoryTemplates(data.templates || []);
      
      // Initialize product variants from templates
      if (data.templates && data.templates.length > 0) {
        const initialVariants = data.templates.map((t, index) => ({
          variant_name: t.variant_name,
          options: [],
          optionsString: '',
          sort_order: t.sort_order || index,
          is_required: true
        }));
        setProductVariants(initialVariants);
      } else {
        setProductVariants([]);
        setVariantStock({});
      }
    } catch (error) {
      console.error('Failed to fetch category templates:', error);
      setCategoryTemplates([]);
      setProductVariants([]);
    } finally {
      setLoadingVariants(false);
    }
  };

  // Handle category change - fetch templates
  const handleCategoryChange = (e) => {
    const category = e.target.value;
    setFormData({ ...formData, category });
    if (category) {
      fetchCategoryTemplates(category);
    } else {
      setCategoryTemplates([]);
      setProductVariants([]);
      setVariantStock({});
    }
  };

  // Update variant options from comma-separated string
  const updateVariantOptions = (index, optionsString) => {
    const updated = [...productVariants];
    const options = optionsString.split(',').map(s => s.trim()).filter(s => s);
    updated[index] = { ...updated[index], optionsString, options };
    setProductVariants(updated);
    
    // Regenerate stock matrix
    generateStockMatrix(updated);
  };

  // Add a custom variant
  const addCustomVariant = () => {
    setProductVariants([...productVariants, {
      variant_name: '',
      options: [],
      optionsString: '',
      sort_order: productVariants.length,
      is_required: true
    }]);
  };

  // Remove a variant
  const removeVariant = (index) => {
    const updated = productVariants.filter((_, i) => i !== index);
    setProductVariants(updated);
    generateStockMatrix(updated);
  };

  // Update variant name
  const updateVariantName = (index, name) => {
    const updated = [...productVariants];
    updated[index] = { ...updated[index], variant_name: name };
    setProductVariants(updated);
    generateStockMatrix(updated);
  };

  // Generate stock matrix from variants
  const generateStockMatrix = (variants) => {
    // Only generate if we have at least 2 variants with options
    const validVariants = variants.filter(v => v.variant_name && v.options.length > 0);
    
    if (validVariants.length === 0) {
      setVariantStock({});
      return;
    }

    // Build combinations
    const buildCombinations = (variants, current = {}, index = 0) => {
      if (index >= variants.length) {
        return [current];
      }
      
      const variant = variants[index];
      const results = [];
      
      for (const option of variant.options) {
        const newCombo = { ...current, [variant.variant_name]: option };
        results.push(...buildCombinations(variants, newCombo, index + 1));
      }
      
      return results;
    };

    const combinations = buildCombinations(validVariants);
    
    // Create stock entries, preserving existing values
    const newStock = {};
    combinations.forEach(combo => {
      const key = JSON.stringify(combo);
      newStock[key] = variantStock[key] || 0;
    });
    
    setVariantStock(newStock);
  };

  // Update stock quantity for a combination
  const updateStockValue = (combinationKey, value) => {
    setVariantStock({ ...variantStock, [combinationKey]: parseInt(value) || 0 });
  };

  // Get all combinations as array for submission
  const getVariantStockArray = () => {
    return Object.entries(variantStock).map(([combination, stock_quantity]) => ({
      combination: JSON.parse(combination),
      stock_quantity
    }));
  };

  // Reset variant state
  const resetVariants = () => {
    setCategoryTemplates([]);
    setProductVariants([]);
    setVariantStock({});
  };

  // ============ EDIT FORM VARIANT FUNCTIONS ============
  
  // Fetch and load existing variants for edit form
  const loadProductVariants = async (productId) => {
    setLoadingEditVariants(true);
    try {
      const { data } = await api.get(`/api/products/${productId}/variants`);
      
      if (data.variants && data.variants.length > 0) {
        // Transform to edit format
        const variants = data.variants.map(v => ({
          variant_name: v.variant_name,
          options: v.options || [],
          optionsString: (v.options || []).join(', '),
          sort_order: v.sort_order || 0,
          is_required: v.is_required !== 0
        }));
        setEditProductVariants(variants);
        
        // Load stock data
        const stockData = {};
        if (data.stock && data.stock.length > 0) {
          data.stock.forEach(s => {
            const key = JSON.stringify(s.combination);
            stockData[key] = s.stock_quantity;
          });
        }
        setEditVariantStock(stockData);
      } else {
        // No variants, try to load templates for this category
        if (editFormData.category) {
          const { data: templateData } = await api.get(`/api/variants/templates/${encodeURIComponent(editFormData.category)}`);
          setEditCategoryTemplates(templateData.templates || []);
          if (templateData.templates && templateData.templates.length > 0) {
            const initialVariants = templateData.templates.map((t, index) => ({
              variant_name: t.variant_name,
              options: [],
              optionsString: '',
              sort_order: t.sort_order || index,
              is_required: true
            }));
            setEditProductVariants(initialVariants);
          }
        }
      }
    } catch (error) {
      console.error('Failed to load product variants:', error);
    } finally {
      setLoadingEditVariants(false);
    }
  };

  // Update edit form variant options
  const updateEditVariantOptions = (index, optionsString) => {
    const updated = [...editProductVariants];
    const options = optionsString.split(',').map(s => s.trim()).filter(s => s);
    updated[index] = { ...updated[index], optionsString, options };
    setEditProductVariants(updated);
    generateEditStockMatrix(updated);
  };

  // Update edit form variant name
  const updateEditVariantName = (index, name) => {
    const updated = [...editProductVariants];
    updated[index] = { ...updated[index], variant_name: name };
    setEditProductVariants(updated);
    generateEditStockMatrix(updated);
  };

  // Add custom variant to edit form
  const addEditCustomVariant = () => {
    setEditProductVariants([...editProductVariants, {
      variant_name: '',
      options: [],
      optionsString: '',
      sort_order: editProductVariants.length,
      is_required: true
    }]);
  };

  // Remove variant from edit form
  const removeEditVariant = (index) => {
    const updated = editProductVariants.filter((_, i) => i !== index);
    setEditProductVariants(updated);
    generateEditStockMatrix(updated);
  };

  // Generate stock matrix for edit form
  const generateEditStockMatrix = (variants) => {
    const validVariants = variants.filter(v => v.variant_name && v.options.length > 0);
    
    if (validVariants.length === 0) {
      setEditVariantStock({});
      return;
    }

    const buildCombinations = (variants, current = {}, index = 0) => {
      if (index >= variants.length) return [current];
      const variant = variants[index];
      const results = [];
      for (const option of variant.options) {
        const newCombo = { ...current, [variant.variant_name]: option };
        results.push(...buildCombinations(variants, newCombo, index + 1));
      }
      return results;
    };

    const combinations = buildCombinations(validVariants);
    const newStock = {};
    combinations.forEach(combo => {
      const key = JSON.stringify(combo);
      newStock[key] = editVariantStock[key] || 0;
    });
    setEditVariantStock(newStock);
  };

  // Update edit form stock value
  const updateEditStockValue = (combinationKey, value) => {
    setEditVariantStock({ ...editVariantStock, [combinationKey]: parseInt(value) || 0 });
  };

  // Get edit form stock as array
  const getEditVariantStockArray = () => {
    return Object.entries(editVariantStock).map(([combination, stock_quantity]) => ({
      combination: JSON.parse(combination),
      stock_quantity
    }));
  };

  // Handle edit category change
  const handleEditCategoryChange = async (category) => {
    setEditFormData({ ...editFormData, category });
    if (category) {
      try {
        const { data } = await api.get(`/api/variants/templates/${encodeURIComponent(category)}`);
        setEditCategoryTemplates(data.templates || []);
        // Only set templates if we don't have existing variants
        if (editProductVariants.length === 0 && data.templates && data.templates.length > 0) {
          const initialVariants = data.templates.map((t, index) => ({
            variant_name: t.variant_name,
            options: [],
            optionsString: '',
            sort_order: t.sort_order || index,
            is_required: true
          }));
          setEditProductVariants(initialVariants);
        }
      } catch (error) {
        console.error('Failed to fetch category templates:', error);
      }
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSpecChange = (i, field, value) => {
    const updated = [...specs];
    updated[i][field] = value;
    setSpecs(updated);
  };

  const addSpec = () => setSpecs([...specs, { spec_key: '', spec_value: '' }]);
  const removeSpec = (i) => setSpecs(specs.filter((_, idx) => idx !== i));

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    
    if (imageFiles.length > 10) { alert('Maximum 10 images allowed'); return; }
    setImages(imageFiles);
    
    if (videoFiles.length > 1) { alert('Maximum 1 video allowed'); return; }
    if (videoFiles.length > 0) setVideo(videoFiles[0]);
  };

  const handleVideoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 1) { alert('Maximum 1 video allowed'); return; }
    if (files.length > 0) setVideo(files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (images.length === 0) { alert('At least one image is required'); return; }

    const data = new FormData();
    data.append('name', formData.name);
    data.append('description', formData.description);
    data.append('price', formData.price);
    data.append('marketer_commission_rate', formData.marketer_commission_rate);
    data.append('category', formData.category);
    data.append('stock_quantity', formData.stock_quantity || '0');
    
    // Add platform fee from settings
    data.append('platform_fee_rate_override', platformSettings.default_platform_fee_rate);

    const validSpecs = specs.filter(s => s.spec_key && s.spec_value);
    if (validSpecs.length > 0) {
      data.append('specs', JSON.stringify(validSpecs.map((s, i) => ({ ...s, sort_order: i }))));
    }

    images.forEach(img => data.append('images', img));
    if (video) data.append('images', video);

    try {
      const response = await api.post('/api/products', data, { headers: { 'Content-Type': 'multipart/form-data' } });
      const productId = response.data.product_id;
      
      // Save variants if any valid variants exist
      const validVariants = productVariants.filter(v => v.variant_name && v.options.length > 0);
      if (validVariants.length > 0 && productId) {
        const variantsPayload = validVariants.map(v => ({
          variant_name: v.variant_name,
          options: v.options,
          sort_order: v.sort_order,
          is_required: v.is_required
        }));
        
        const stockPayload = getVariantStockArray();
        
        await api.put(`/api/products/${productId}/variants`, {
          variants: variantsPayload,
          variant_stock: stockPayload
        });
      }
      
      alert('Product created successfully');
      setShowForm(false);
      setFormData({ name: '', description: '', price: '', marketer_commission_rate: '', category: '', stock_quantity: '0' });
      setSpecs([{ spec_key: '', spec_value: '' }]);
      setImages([]);
      setVideo(null);
      resetVariants();
      fetchProducts();
    } catch (error) {
      console.error('Failed to create product:', error);
      alert(error.response?.data?.error || 'Failed to create product');
    }
  };

  const toggleStatus = async (productId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'paused' : 'active';
    try {
      await api.put(`/api/products/${productId}`, { status: newStatus });
      fetchProducts();
    } catch (error) {
      console.error('Failed to update product:', error);
    }
  };

  const updateOrderStatus = async (orderId, status) => {
    const note = prompt('Add a note (optional):');
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status, supplier_note: note || '' });
      fetchOrders();
    } catch (error) {
      console.error('Failed to update order:', error);
      const errorMsg = error.response?.data?.error || 'Failed to update order status';
      alert(errorMsg);
      throw error;
    }
  };

  const handleStatusChange = async (orderId, newStatus) => {
    if (newStatus === '') return;
    
    const confirmMessage = `Are you sure you want to change the order status to "${newStatus}"?`;
    if (!confirm(confirmMessage)) return;
    
    try {
      await updateOrderStatus(orderId, newStatus);
    } catch (error) {
      console.error('Status change error:', error);
      alert('Failed to update status: ' + (error.response?.data?.error || error.message));
    }
  };

  // Edit product handlers
  const handleEdit = async (product) => {
    // Fetch full product details including specs and images
    try {
      const { data } = await api.get(`/api/products/${product.id}`);
      setEditingProduct(data);
      setEditFormData({
        name: data.name,
        description: data.description,
        price: data.price,
        marketer_commission_rate: data.marketer_commission_rate,
        category: data.category,
        status: data.status,
        stock_quantity: data.stock_quantity || '0'
      });
      setEditSpecs(data.specs && data.specs.length > 0 ? data.specs : [{ spec_key: '', spec_value: '' }]);
      // Load existing images and videos
      setExistingImages(data.images || []);
      setExistingVideo(data.videos && data.videos.length > 0 ? data.videos[0] : null);
      setMainImageId(data.main_image_id || (data.images && data.images[0]?.id) || null);
      setMainMediaType(data.main_media_type || 'image');
      setMainMediaId(data.main_media_id || (data.images && data.images[0]?.id) || (data.videos && data.videos[0]?.id) || null);
      setEditImages([]);
      setEditVideo(null);
      
      // Load variants for this product
      await loadProductVariants(product.id);
      
      setShowEditForm(true);
    } catch (error) {
      console.error('Failed to fetch product details:', error);
      alert('Failed to load product details');
    }
  };

  const handleUpdateProduct = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append('name', editFormData.name);
      formData.append('description', editFormData.description);
      formData.append('price', editFormData.price);
      formData.append('marketer_commission_rate', editFormData.marketer_commission_rate);
      formData.append('category', editFormData.category);
      formData.append('status', editFormData.status);
      
      formData.append('stock_quantity', editFormData.stock_quantity || '0');
      
      formData.append('main_media_type', mainMediaType);
      if (mainMediaId) {
        formData.append('main_media_id', mainMediaId);
      }
      
      // Add specs
      const validSpecs = editSpecs.filter(s => s.spec_key && s.spec_value);
      formData.append('specs', JSON.stringify(validSpecs));
      
      // Add new images and video if any
      editImages.forEach(img => formData.append('images', img));
      if (editVideo) formData.append('images', editVideo);
      
      await api.put(`/api/products/${editingProduct.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      // Save variants if any valid variants exist
      const validVariants = editProductVariants.filter(v => v.variant_name && v.options.length > 0);
      if (validVariants.length > 0) {
        const variantsPayload = validVariants.map(v => ({
          variant_name: v.variant_name,
          options: v.options,
          sort_order: v.sort_order,
          is_required: v.is_required
        }));
        
        const stockPayload = getEditVariantStockArray();
        
        await api.put(`/api/products/${editingProduct.id}/variants`, {
          variants: variantsPayload,
          variant_stock: stockPayload
        });
      }
      
      alert('Product updated successfully!');
      setShowEditForm(false);
      setEditingProduct(null);
      setExistingImages([]);
      setExistingVideo(null);
      setMainImageId(null);
      setMainMediaType('image');
      setMainMediaId(null);
      setEditVideo(null);
      // Reset variant states
      setEditProductVariants([]);
      setEditVariantStock({});
      setEditCategoryTemplates([]);
      fetchProducts();
    } catch (error) {
      console.error('Failed to update product:', error);
      alert(error.response?.data?.error || 'Failed to update product');
    }
  };

  const addEditSpec = () => setEditSpecs([...editSpecs, { spec_key: '', spec_value: '' }]);
  const removeEditSpec = (i) => setEditSpecs(editSpecs.filter((_, idx) => idx !== i));
  const handleEditSpecChange = (i, field, value) => {
    const updated = [...editSpecs];
    updated[i][field] = value;
    setEditSpecs(updated);
  };
  const handleEditImageChange = (e) => {
    const files = Array.from(e.target.files);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    const videoFiles = files.filter(f => f.type.startsWith('video/'));
    setEditImages([...editImages, ...imageFiles]);
    if (videoFiles.length > 0) setEditVideo(videoFiles[0]);
  };

  const handleEditVideoChange = (e) => {
    const files = Array.from(e.target.files);
    if (files.length > 0) setEditVideo(files[0]);
  };

  const setMainMedia = (type, id) => {
    setMainMediaType(type);
    setMainMediaId(id);
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    
    // Validate that orders are selected
    if (!selectedPaymentOrders || selectedPaymentOrders.length === 0) {
      alert('Please select at least one order to pay for');
      return;
    }
    
    if (!paymentReceipt) {
      alert('Please upload a payment receipt image');
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('order_ids', JSON.stringify(selectedPaymentOrders));
      formData.append('total_amount', selectedPaymentTotal);
      formData.append('payment_method', 'vodafone_cash');
      formData.append('transaction_reference', paymentFormData.transactionReference);
      formData.append('payment_date', paymentFormData.paymentDate);
      formData.append('notes', paymentFormData.notes);
      formData.append('receipt', paymentReceipt);
      
      await api.post('/api/supplier/payments/submit', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      alert('Payment submitted successfully! Awaiting admin verification.');
      setShowPaymentModal(false);
      setSelectedPaymentOrders([]);
      setPaymentFormData({
        transactionReference: '',
        paymentDate: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setPaymentReceipt(null);
      fetchOrders();
    } catch (error) {
      console.error('Failed to submit payment:', error);
      const errorMessage = error.response?.data?.error || error.response?.data?.details || 'Failed to submit payment';
      console.log('Error response:', error.response?.data);
      alert(errorMessage);
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

  // Financial calculations - calculate supplier's portion only
  const confirmedOrders = orders.filter(o => ['confirmed', 'shipped', 'delivered', 'completed'].includes(o.status));
  
  // Calculate payment due orders with supplier's portion only - only completed orders with pending payment status
  const paymentDueOrders = orders.filter(o => {
    if (o.status !== 'completed') return false;
    // Only show orders with pending payment status (null/undefined or 'pending')
    if (o.payment_status && o.payment_status !== 'pending') return false;
    // Check if this supplier has items in this order
    const myItems = o.items ? o.items.filter(item => item.supplier_id === user?.id) : [];
    return myItems.length > 0;
  }).map(order => {
    // Calculate this supplier's portion
    const myItems = order.items ? order.items.filter(item => item.supplier_id === user?.id) : [];
    const myPlatformFee = myItems.reduce((sum, item) => sum + (parseFloat(item.platform_fee_amount) || 0), 0);
    const myCommission = myItems.reduce((sum, item) => sum + (parseFloat(item.marketer_commission_amount) || 0), 0);
    return {
      ...order,
      myPlatformFee,
      myCommission,
      myItems
    };
  });
  
  // Calculate selected payment total after paymentDueOrders is defined
  const selectedPaymentTotal = paymentDueOrders
    .filter(o => selectedPaymentOrders.includes(o.id))
    .reduce((sum, o) => sum + parseFloat(o.myPlatformFee || 0) + parseFloat(o.myCommission || 0), 0);

  const totalCommissionOwed = confirmedOrders.reduce((s, o) => {
    const myItems = o.items ? o.items.filter(item => item.supplier_id === user?.id) : [];
    return s + myItems.reduce((sum, item) => sum + (parseFloat(item.marketer_commission_amount) || 0), 0);
  }, 0);
  
  const totalPlatformFees = confirmedOrders.reduce((s, o) => {
    const myItems = o.items ? o.items.filter(item => item.supplier_id === user?.id) : [];
    return s + myItems.reduce((sum, item) => sum + (parseFloat(item.platform_fee_amount) || 0), 0);
  }, 0);
  
  // Calculate supplierNetRevenue as sum of all Net values from Monthly Summary (completed orders)
  const supplierNetRevenue = (() => {
    const completedOrdersWithMyItems = orders.filter(o => {
      if (o.status !== 'completed') return false;
      const myItems = o.items ? o.items.filter(item => item.supplier_id === user?.id) : [];
      return myItems.length > 0;
    });
    
    // Group by month and calculate total net
    const months = {};
    completedOrdersWithMyItems.forEach(o => {
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!months[key]) months[key] = { revenue: 0, commission: 0, fees: 0 };
      
      const myItems = o.items.filter(item => item.supplier_id === user?.id);
      const myRevenue = myItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
      const myComm = myItems.reduce((sum, item) => sum + (parseFloat(item.marketer_commission_amount) || 0), 0);
      const myFee = myItems.reduce((sum, item) => sum + (parseFloat(item.platform_fee_amount) || 0), 0);
      
      months[key].revenue += myRevenue;
      months[key].commission += myComm;
      months[key].fees += myFee;
    });
    
    // Sum all Net values (Revenue - Commission - Fees) from each month
    return Object.values(months).reduce((total, month) => total + (month.revenue - month.commission - month.fees), 0);
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-amazon-light flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-amazon-orange border-t-transparent"></div>
      </div>
    );
  }

  const tabs = [
    { id: 'products', label: 'Product Management' },
    { id: 'orders', label: `Order Management (${orders.filter(o => o.status === 'pending').length} pending)` },
    { id: 'payments', label: 'Payment Management' },
    { id: 'balance', label: 'Balance' },
    { id: 'shipping', label: `Shipping Rates (${shippingRates.length})` },
    { id: 'profile', label: 'Profile' }
  ];

  return (
    <div className="min-h-screen bg-amazon-light" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* TOP NAV */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <span className="text-sm text-gray-300 mx-4">Supplier Dashboard</span>
        <div className="flex-1" />
        <div className="flex items-center space-x-3 text-sm">
          <Link to="/marketplace" className="border border-transparent hover:border-white p-1 rounded-sm">Marketplace</Link>
          <div className="relative group">
            <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
              <span className="text-xs text-gray-300">Hello, {user?.name || 'supplier'}</span><br />
              <span className="font-bold text-sm">Account</span>
            </div>
            <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
              <div className="p-3">
                <Link to="/supplier" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Dashboard</Link>
                <button onClick={() => { setActiveTab('profile'); localStorage.setItem('supplierActiveTab', 'profile'); }} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Profile</button>
                <button onClick={() => { setActiveTab('orders'); localStorage.setItem('supplierActiveTab', 'orders'); }} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Orders Management</button>
                <button onClick={() => { setActiveTab('payments'); localStorage.setItem('supplierActiveTab', 'payments'); }} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Payment Management</button>
                <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* TABS */}
      <div className="bg-[#232f3e] text-white h-[40px] flex items-center px-4 text-sm overflow-x-auto">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => {
            setActiveTab(tab.id);
            localStorage.setItem('supplierActiveTab', tab.id);
          }}
            className={`px-3 py-1 rounded-sm mr-2 whitespace-nowrap ${activeTab === tab.id ? 'bg-amazon-orange text-amazon-dark' : 'hover:outline hover:outline-1 hover:outline-white'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="max-w-[1400px] mx-auto px-4 py-6">

        {/* ======= TAB 1: PRODUCT MANAGEMENT ======= */}
        {activeTab === 'products' && (
          <>
            <div className="bg-white p-6 shadow-amazon rounded-sm mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-amazon-dark">Product Management</h1>
                  <p className="text-gray-600 mt-1">Manage your products</p>
                </div>
                <button onClick={() => setShowForm(!showForm)}
                  className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">
                  {showForm ? 'Cancel' : 'Add New Product'}
                </button>
              </div>
            </div>

            {showForm && (
              <div className="bg-white p-6 shadow-amazon rounded-sm mb-6">
                <h2 className="text-xl font-bold text-amazon-dark mb-4">Add New Product</h2>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                      <input type="text" name="name" value={formData.name} onChange={handleChange} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                      <select name="category" value={formData.category} onChange={handleCategoryChange} required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white">
                        <option value="">Select a category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {loadingVariants && <p className="text-xs text-gray-500 mt-1">Loading variant templates...</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price ({currency}) *</label>
                      <input type="number" name="price" value={formData.price} onChange={handleChange} required step="0.01" min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marketer Commission Rate (%) *</label>
                      <input type="number" name="marketer_commission_rate" value={formData.marketer_commission_rate} onChange={handleChange}
                        required step="0.1" min="0" max="100"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                      <p className="text-xs text-gray-500 mt-1">This is the commission % that marketers will earn when they sell your product</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                      <input type="number" name="stock_quantity" value={formData.stock_quantity} onChange={handleChange} min="0"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                      <p className="text-xs text-gray-500 mt-1">المخزون المتوفر - Will be reduced when orders are completed</p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea name="description" value={formData.description} onChange={handleChange} rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Specifications</label>
                      <button type="button" onClick={addSpec} className="text-xs text-amazon-orange hover:underline font-medium">+ Add Spec</button>
                    </div>
                    {specs.map((spec, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input type="text" placeholder="Key (e.g. Color)" value={spec.spec_key}
                          onChange={(e) => handleSpecChange(i, 'spec_key', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                        <input type="text" placeholder="Value (e.g. Red)" value={spec.spec_value}
                          onChange={(e) => handleSpecChange(i, 'spec_value', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                        {specs.length > 1 && (
                          <button type="button" onClick={() => removeSpec(i)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* VARIANT EDITOR */}
                  {formData.category && (
                    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                      <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">Product Variants</label>
                        <button type="button" onClick={addCustomVariant} className="text-xs text-amazon-orange hover:underline font-medium">+ Add Custom Variant</button>
                      </div>
                      
                      {categoryTemplates.length > 0 && (
                        <p className="text-xs text-gray-500 mb-3">
                          Templates loaded for {formData.category}: {categoryTemplates.map(t => t.variant_name).join(', ')}
                        </p>
                      )}
                      
                      {productVariants.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">No variants defined. Select a category to auto-load templates or add custom variants.</p>
                      ) : (
                        <div className="space-y-4">
                          {productVariants.map((variant, index) => (
                            <div key={index} className="bg-white p-3 rounded border">
                              <div className="flex gap-2 mb-2">
                                <input
                                  type="text"
                                  placeholder="Variant name (e.g. Color, Size)"
                                  value={variant.variant_name}
                                  onChange={(e) => updateVariantName(index, e.target.value)}
                                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                                />
                                {productVariants.length > 1 && (
                                  <button type="button" onClick={() => removeVariant(index)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                                )}
                              </div>
                              <input
                                type="text"
                                placeholder="Options - comma separated (e.g. Red, Blue, Black)"
                                value={variant.optionsString}
                                onChange={(e) => updateVariantOptions(index, e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                              />
                              {variant.options.length > 0 && (
                                <p className="text-xs text-green-600 mt-1">{variant.options.length} options: {variant.options.join(', ')}</p>
                              )}
                            </div>
                          ))}
                          
                          {/* STOCK MATRIX */}
                          {Object.keys(variantStock).length > 0 && (
                            <div className="mt-4">
                              <label className="block text-sm font-medium text-gray-700 mb-2">Stock per Variant Combination</label>
                              <div className="bg-white rounded border overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="bg-gray-100">
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Combination</th>
                                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Stock Quantity</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {Object.entries(variantStock).map(([combinationKey, stock]) => {
                                      const combo = JSON.parse(combinationKey);
                                      const comboText = Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(', ');
                                      return (
                                        <tr key={combinationKey} className="border-t">
                                          <td className="px-3 py-2 text-gray-700">{comboText}</td>
                                          <td className="px-3 py-2">
                                            <input
                                              type="number"
                                              min="0"
                                              value={stock}
                                              onChange={(e) => updateStockValue(combinationKey, e.target.value)}
                                              className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                                            />
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Images *</label>
                    <input type="file" multiple accept="image/*,video/*" onChange={handleImageChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    <p className="text-xs text-gray-500 mt-1">Maximum 10 images + 1 video. Images and video can be selected together.</p>
                    {images.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {images.map((img, i) => (
                          <div key={i} className="w-16 h-16 border rounded overflow-hidden">
                            <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Product Video (Optional)</label>
                    <input type="file" accept="video/*" onChange={handleVideoChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    <p className="text-xs text-gray-500 mt-1">Maximum 1 video (MP4, WebM, MOV). Max size 50MB.</p>
                    {video && (
                      <div className="mt-2">
                        <video 
                          src={URL.createObjectURL(video)} 
                          controls 
                          className="max-w-xs max-h-32 rounded border"
                        />
                        <p className="text-xs text-gray-500 mt-1">{video.name}</p>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-4">
                    <button type="submit" className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">
                      Create Product
                    </button>
                    <button type="button" onClick={() => setShowForm(false)}
                      className="border border-gray-300 hover:border-gray-400 px-6 py-2 rounded-full text-sm">Cancel</button>
                  </div>
                </form>
              </div>
            )}

            {/* EDIT PRODUCT MODAL */}
            {showEditForm && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                  <div className="p-6 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-amazon-dark">Edit Product</h2>
                    <button 
                      onClick={() => setShowEditForm(false)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="p-6">
                    <form onSubmit={handleUpdateProduct}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                      <input type="text" required value={editFormData.name}
                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Price ({currency}) *</label>
                      <input type="number" step="0.01" required value={editFormData.price}
                        onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Marketer Commission Rate (%) *</label>
                      <input type="number" step="0.01" required value={editFormData.marketer_commission_rate}
                        onChange={(e) => setEditFormData({ ...editFormData, marketer_commission_rate: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                      <p className="text-xs text-gray-500 mt-1">This is the commission % that marketers will earn when they sell your product</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                      <select required value={editFormData.category}
                        onChange={(e) => handleEditCategoryChange(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white">
                        <option value="">Select a category</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      {loadingEditVariants && <p className="text-xs text-gray-500 mt-1">Loading variants...</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                      <select value={editFormData.status}
                        onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange">
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                      <input type="number" required value={editFormData.stock_quantity}
                        onChange={(e) => setEditFormData({ ...editFormData, stock_quantity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                      <p className="text-xs text-gray-500 mt-1">المخزون المتوفر - Will be reduced when orders are completed</p>
                    </div>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea rows="3" value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"></textarea>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700">Specifications</label>
                      <button type="button" onClick={addEditSpec} className="text-xs text-amazon-orange hover:underline font-medium">+ Add Spec</button>
                    </div>
                    {editSpecs.map((spec, i) => (
                      <div key={i} className="flex gap-2 mb-2">
                        <input type="text" placeholder="Key (e.g. Color)" value={spec.spec_key}
                          onChange={(e) => handleEditSpecChange(i, 'spec_key', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                        <input type="text" placeholder="Value (e.g. Red)" value={spec.spec_value}
                          onChange={(e) => handleEditSpecChange(i, 'spec_value', e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                        {editSpecs.length > 1 && (
                          <button type="button" onClick={() => removeEditSpec(i)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* EDIT FORM VARIANT EDITOR */}
                  <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700">Product Variants</label>
                      <button type="button" onClick={addEditCustomVariant} className="text-xs text-amazon-orange hover:underline font-medium">+ Add Custom Variant</button>
                    </div>
                    
                    {editCategoryTemplates.length > 0 && editProductVariants.length === 0 && (
                      <p className="text-xs text-gray-500 mb-3">
                        Templates available for {editFormData.category}: {editCategoryTemplates.map(t => t.variant_name).join(', ')}
                      </p>
                    )}
                    
                    {editProductVariants.length === 0 ? (
                      <p className="text-sm text-gray-500 italic">No variants defined. Select a category to auto-load templates or add custom variants.</p>
                    ) : (
                      <div className="space-y-4">
                        {editProductVariants.map((variant, index) => (
                          <div key={index} className="bg-white p-3 rounded border">
                            <div className="flex gap-2 mb-2">
                              <input
                                type="text"
                                placeholder="Variant name (e.g. Color, Size)"
                                value={variant.variant_name}
                                onChange={(e) => updateEditVariantName(index, e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                              />
                              {editProductVariants.length > 1 && (
                                <button type="button" onClick={() => removeEditVariant(index)} className="text-red-500 hover:text-red-700 px-2">✕</button>
                              )}
                            </div>
                            <input
                              type="text"
                              placeholder="Options - comma separated (e.g. Red, Blue, Black)"
                              value={variant.optionsString}
                              onChange={(e) => updateEditVariantOptions(index, e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                            />
                            {variant.options.length > 0 && (
                              <p className="text-xs text-green-600 mt-1">{variant.options.length} options: {variant.options.join(', ')}</p>
                            )}
                          </div>
                        ))}
                        
                        {/* EDIT FORM STOCK MATRIX */}
                        {Object.keys(editVariantStock).length > 0 && (
                          <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Stock per Variant Combination</label>
                            <div className="bg-white rounded border overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Combination</th>
                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Stock Quantity</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {Object.entries(editVariantStock).map(([combinationKey, stock]) => {
                                    const combo = JSON.parse(combinationKey);
                                    const comboText = Object.entries(combo).map(([k, v]) => `${k}: ${v}`).join(', ');
                                    return (
                                      <tr key={combinationKey} className="border-t">
                                        <td className="px-3 py-2 text-gray-700">{comboText}</td>
                                        <td className="px-3 py-2">
                                          <input
                                            type="number"
                                            min="0"
                                            value={stock}
                                            onChange={(e) => updateEditStockValue(combinationKey, e.target.value)}
                                            className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                                          />
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Existing Images</label>
                    {existingImages.length > 0 ? (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {existingImages.map((img) => (
                          <div 
                            key={img.id} 
                            className={`w-20 h-20 border-2 rounded overflow-hidden cursor-pointer relative ${mainMediaType === 'image' && mainMediaId === img.id ? 'border-amazon-orange ring-2 ring-amazon-orange' : 'border-gray-300'}`}
                            onClick={() => setMainImageId(img.id)}
                            onDoubleClick={() => setMainMedia('image', img.id)}
                          >
                            <img src={`http://localhost:5000/uploads/${img.image_path}`} alt="" className="w-full h-full object-cover"
                            onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxMiIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }} />
                            {mainMediaType === 'image' && mainMediaId === img.id && (
                              <div className="absolute inset-0 bg-amazon-orange/30 flex items-center justify-center border-2 border-amazon-orange">
                                <div className="bg-white rounded-full p-1 shadow-lg">
                                  <span className="text-amazon-orange text-lg">★</span>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No existing images</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">Double-click an image to set as main display</p>
                  </div>

                  {/* Existing Video */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Existing Video</label>
                    {existingVideo ? (
                      <div className="mt-2 relative">
                        <div 
                          className={`inline-block rounded border-2 overflow-hidden ${mainMediaType === 'video' && mainMediaId === existingVideo.id ? 'border-amazon-orange ring-2 ring-amazon-orange' : 'border-gray-300'}`}
                          onDoubleClick={() => setMainMedia('video', existingVideo.id)}
                        >
                          <video 
                            src={`http://localhost:5000/uploads/${existingVideo.video_path}`} 
                            controls 
                            className="max-w-xs max-h-32"
                          />
                        </div>
                        {mainMediaType === 'video' && mainMediaId === existingVideo.id && (
                          <div className="absolute -top-2 -left-2 bg-amazon-orange text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg border-2 border-white">
                            <span className="text-lg">★</span>
                          </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">Double-click video to set as main display</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No existing video</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Add More Images</label>
                    <input type="file" multiple accept="image/*,video/*" onChange={handleEditImageChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    <p className="text-xs text-gray-500 mt-1">Add up to 10 images total + 1 video. New files will be appended.</p>
                    {editImages.length > 0 && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {editImages.map((img, i) => (
                          <div key={i} className="w-16 h-16 border rounded overflow-hidden">
                            <img src={URL.createObjectURL(img)} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Add/Replace Video in Edit Form */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Add/Replace Video (Optional)</label>
                    <input type="file" accept="video/*" onChange={handleEditVideoChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                    <p className="text-xs text-gray-500 mt-1">Maximum 1 video (MP4, WebM, MOV). Max size 50MB.</p>
                    {editVideo && (
                      <div className="mt-2">
                        <video 
                          src={URL.createObjectURL(editVideo)} 
                          controls 
                          className="max-w-xs max-h-32 rounded border"
                        />
                        <p className="text-xs text-gray-500 mt-1">{editVideo.name} (new video to upload)</p>
                      </div>
                    )}
                  </div>

                  <div className="flex space-x-4 pt-4 border-t">
                    <button type="submit" className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">
                      Update Product
                    </button>
                    <button type="button" onClick={() => setShowEditForm(false)}
                      className="border border-gray-300 hover:border-gray-400 px-6 py-2 rounded-full text-sm">Cancel</button>
                  </div>
                </form>
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white p-6 shadow-amazon rounded-sm">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Your Products ({products.length})</h2>
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">No products yet</h3>
                  <p className="text-gray-500 mb-4">Start by adding your first product</p>
                  <button onClick={() => setShowForm(true)}
                    className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">
                    Add Your First Product
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {products.map((product) => (
                    <div key={product.id} className="border border-amazon-border rounded-lg p-4">
                      <div className="aspect-square bg-gray-50 rounded mb-3 overflow-hidden">
                        <img
                          src={product.main_image ? `http://localhost:5000/uploads/${product.main_image}` : 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='}
                          alt={product.name} className="w-full h-full object-contain"
                          onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUwIiBoZWlnaHQ9IjI1MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxOCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg=='; }} />
                      </div>
                      <h3 className="font-semibold text-amazon-dark mb-1 line-clamp-2">{product.name}</h3>
                      <p className="text-sm text-gray-500 mb-2 line-clamp-2">{product.description}</p>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-lg font-bold text-amazon-dark">{parseFloat(product.price).toFixed(2)} {currency}</span>
                        <span className="text-sm text-green-600 font-medium">{product.marketer_commission_rate}%</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-3">
                        <span>{product.image_count || 0} images</span>
                        <span>Stock: {product.stock_quantity || 0}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className={`px-2 py-1 text-xs font-medium rounded ${product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {product.status === 'active' ? 'Active' : 'Paused'}
                        </span>
                        <div className="flex gap-2">
                          <button onClick={() => handleEdit(product)}
                            className="text-sm text-blue-600 hover:text-amazon-orange font-medium">
                            Edit
                          </button>
                          <button onClick={() => toggleStatus(product.id, product.status)}
                            className="text-sm text-blue-600 hover:text-amazon-orange font-medium">
                            {product.status === 'active' ? 'Pause' : 'Activate'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* ======= TAB 2: ORDER MANAGEMENT ======= */}
        {activeTab === 'orders' && (
          <div className="space-y-6">
            {/* Not Completed Orders Grid */}
            <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h1 className="text-xl font-bold text-amazon-dark">Not Completed Orders</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {orders.filter(o => o.status !== 'completed').length} orders pending
                </p>
              </div>
              {orders.filter(o => o.status !== 'completed').length === 0 ? (
                <div className="p-8 text-center text-gray-500">All orders are completed.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Products</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Products Total</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shipping</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Total</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Fee</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Net</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orders.filter(o => o.status !== 'completed').map(order => {
                        const total = parseFloat(order.total_amount || 0);
                        const myItems = order.items ? order.items.filter(item => item.supplier_id === user?.id) : [];
                        const myTotal = myItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                        const myComm = myItems.reduce((sum, item) => sum + (parseFloat(item.marketer_commission_amount) || 0), 0);
                        const myFee = myItems.reduce((sum, item) => sum + (parseFloat(item.platform_fee_amount) || 0), 0);
                        const myNet = myTotal - myComm - myFee;
                        
                        return (
                          <tr key={order.id} className="hover:bg-gray-50">
                            <td className="px-3 py-3 font-medium">#{order.id}</td>
                            <td className="px-3 py-3">{order.marketer_name}</td>
                            <td className="px-3 py-3">
                              <div className="max-w-xs">
                                {myItems.length > 0 ? (
                                  <div className="space-y-1">
                                    {myItems.map((item, idx) => (
                                      <div key={idx} className="text-sm">
                                        <p className="font-medium truncate">{item.product_name}</p>
                                        <p className="text-xs text-gray-500">Qty: {item.quantity} × {parseFloat(item.unit_price).toFixed(2)}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm">No products</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>{order.client_name}</div>
                              <div className="text-xs text-gray-400">{order.client_phone}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm">{order.city || '-'}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm">
                                {myItems.reduce((sum, item) => sum + item.quantity, 0)} items
                              </div>
                            </td>
                            <td className="px-3 py-3 font-medium">{myTotal.toFixed(2)}</td>
                            <td className="px-3 py-3">{parseFloat(order.shipment_cost || 0).toFixed(2)}</td>
                            <td className="px-3 py-3 font-medium">{total.toFixed(2)}</td>
                            <td className="px-3 py-3 text-green-700">{myComm.toFixed(2)}</td>
                            <td className="px-3 py-3 text-blue-700">{myFee.toFixed(2)}</td>
                            <td className="px-3 py-3 font-bold">{myNet.toFixed(2)}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[order.status] || 'bg-gray-100'}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => openOrderModal(order)} className="px-2 py-1 bg-gray-500 text-white text-xs rounded">View</button>
                                <select 
                                  onChange={(e) => {
                                    console.log('Changing status for order', order.id, 'to', e.target.value);
                                    handleStatusChange(order.id, e.target.value);
                                  }}
                                  value=""
                                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white"
                                >
                                  <option value="">Change Status</option>
                                  {order.status !== 'pending' && <option value="pending">Pending</option>}
                                  {order.status !== 'confirmed' && <option value="confirmed">Confirmed</option>}
                                  {order.status !== 'shipped' && <option value="shipped">Shipped</option>}
                                  {order.status !== 'completed' && <option value="completed">Completed</option>}
                                  {order.status !== 'rejected' && <option value="rejected">Rejected</option>}
                                  {order.status !== 'cancelled' && <option value="cancelled">Cancelled</option>}
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Completed Orders Grid */}
            <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
              <div className="p-6 border-b border-gray-200">
                <h1 className="text-xl font-bold text-amazon-dark">Completed Orders</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {orders.filter(o => o.status === 'completed').length} orders completed
                </p>
              </div>
              {orders.filter(o => o.status === 'completed').length === 0 ? (
                <div className="p-8 text-center text-gray-500">No completed orders yet.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">ID</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Products</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Items</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Products Total</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Shipping</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Total</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Fee</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Supplier Net</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                        <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orders.filter(o => o.status === 'completed').map(order => {
                        const total = parseFloat(order.total_amount || 0);
                        const myItems = order.items ? order.items.filter(item => item.supplier_id === user?.id) : [];
                        const myTotal = myItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                        const myComm = myItems.reduce((sum, item) => sum + (parseFloat(item.marketer_commission_amount) || 0), 0);
                        const myFee = myItems.reduce((sum, item) => sum + (parseFloat(item.platform_fee_amount) || 0), 0);
                        const myNet = myTotal - myComm - myFee;
                        
                        return (
                          <tr key={order.id} className="hover:bg-gray-50 bg-green-50/30">
                            <td className="px-3 py-3 font-medium">#{order.id}</td>
                            <td className="px-3 py-3">{order.marketer_name}</td>
                            <td className="px-3 py-3">
                              <div className="max-w-xs">
                                {myItems.length > 0 ? (
                                  <div className="space-y-1">
                                    {myItems.map((item, idx) => (
                                      <div key={idx} className="text-sm">
                                        <p className="font-medium truncate">{item.product_name}</p>
                                        <p className="text-xs text-gray-500">Qty: {item.quantity} × {parseFloat(item.unit_price).toFixed(2)}</p>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-sm">No products</span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <div>{order.client_name}</div>
                              <div className="text-xs text-gray-400">{order.client_phone}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm">{order.city || '-'}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-sm">
                                {myItems.reduce((sum, item) => sum + item.quantity, 0)} items
                              </div>
                            </td>
                            <td className="px-3 py-3 font-medium">{myTotal.toFixed(2)}</td>
                            <td className="px-3 py-3">{parseFloat(order.shipment_cost || 0).toFixed(2)}</td>
                            <td className="px-3 py-3 font-medium">{total.toFixed(2)}</td>
                            <td className="px-3 py-3 text-green-700">{myComm.toFixed(2)}</td>
                            <td className="px-3 py-3 text-blue-700">{myFee.toFixed(2)}</td>
                            <td className="px-3 py-3 font-bold">{myNet.toFixed(2)}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${statusColors[order.status] || 'bg-gray-100'}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <div className="flex gap-1">
                                <button onClick={() => openOrderModal(order)} className="px-2 py-1 bg-gray-500 text-white text-xs rounded">View</button>
                                <select 
                                  onChange={(e) => {
                                    console.log('Changing status for order', order.id, 'to', e.target.value);
                                    handleStatusChange(order.id, e.target.value);
                                  }}
                                  value=""
                                  className="px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white"
                                >
                                  <option value="">Change Status</option>
                                  {order.status !== 'pending' && <option value="pending">Pending</option>}
                                  {order.status !== 'confirmed' && <option value="confirmed">Confirmed</option>}
                                  {order.status !== 'shipped' && <option value="shipped">Shipped</option>}
                                  {order.status !== 'completed' && <option value="completed">Completed</option>}
                                  {order.status !== 'rejected' && <option value="rejected">Rejected</option>}
                                  {order.status !== 'cancelled' && <option value="cancelled">Cancelled</option>}
                                </select>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======= TAB 3: PAYMENT MANAGEMENT ======= */}
        {activeTab === 'payments' && (
          <div className="space-y-6">
            {/* Payment Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white shadow-amazon rounded-sm p-4">
                <p className="text-sm text-gray-500 mb-1">Orders Awaiting Payment</p>
                <p className="text-2xl font-bold text-amazon-dark">{paymentDueOrders.length}</p>
                <p className="text-xs text-gray-400 mt-1">Completed Orders</p>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-4">
                <p className="text-sm text-gray-500 mb-1">Platform Fees Due</p>
                <p className="text-2xl font-bold text-blue-600">
                  {paymentDueOrders.reduce((s, o) => s + parseFloat(o.myPlatformFee || 0), 0).toFixed(2)} 
                  <span className="text-sm font-normal">{currency}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">5% per order</p>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-4">
                <p className="text-sm text-gray-500 mb-1">Marketer Commissions</p>
                <p className="text-2xl font-bold text-green-700">
                  {paymentDueOrders.reduce((s, o) => s + parseFloat(o.myCommission || 0), 0).toFixed(2)} 
                  <span className="text-sm font-normal">{currency}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">To be released</p>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-4">
                <p className="text-sm text-gray-500 mb-1">Total Amount Due</p>
                <p className="text-2xl font-bold text-red-600">
                  {paymentDueOrders.reduce((s, o) => s + parseFloat(o.myPlatformFee || 0) + parseFloat(o.myCommission || 0), 0).toFixed(2)} 
                  <span className="text-sm font-normal">{currency}</span>
                </p>
                <p className="text-xs text-gray-400 mt-1">Pay within 7 days of completion</p>
              </div>
            </div>

            {/* Pending Payments GridView */}
            <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-amazon-dark">Pending Payments to Platform</h2>
                  {selectedPaymentOrders.length > 0 && (
                    <p className="text-sm text-gray-500 mt-1">
                      {selectedPaymentOrders.length} order(s) selected - Total: {selectedPaymentTotal.toFixed(2)} {currency}
                    </p>
                  )}
                </div>
                <button 
                  onClick={() => setShowPaymentModal(true)}
                  disabled={selectedPaymentOrders.length === 0}
                  className={`px-4 py-2 rounded-full font-bold text-sm ${
                    selectedPaymentOrders.length > 0 
                      ? 'bg-amazon-orange hover:brightness-110 text-amazon-dark' 
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Make Payment ({selectedPaymentOrders.length})
                </button>
              </div>
              {paymentDueOrders.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <p className="mb-2">No completed orders with pending payments.</p>
                  <p className="text-xs text-gray-400">Orders will appear here when marked as completed.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">
                          <input 
                            type="checkbox" 
                            checked={selectedPaymentOrders.length === paymentDueOrders.filter(o => !o.payment_status || o.payment_status === 'pending').length && paymentDueOrders.filter(o => !o.payment_status || o.payment_status === 'pending').length > 0}
                            onChange={(e) => {
                              const pendingOrders = paymentDueOrders.filter(o => !o.payment_status || o.payment_status === 'pending');
                              if (e.target.checked) {
                                setSelectedPaymentOrders(pendingOrders.map(o => o.id));
                              } else {
                                setSelectedPaymentOrders([]);
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-amazon-orange focus:ring-amazon-orange"
                          />
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Delivery Date</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Total</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Fee</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer Commission</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Due</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Payment Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {paymentDueOrders.map(o => {
                        const myItems = o.myItems || [];
                        const myTotal = myItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                        const platformFee = parseFloat(o.myPlatformFee || 0);
                        const commission = parseFloat(o.myCommission || 0);
                        const totalDue = platformFee + commission;
                        const daysSinceDelivery = Math.floor((new Date() - new Date(o.updated_at)) / (1000 * 60 * 60 * 24));
                        // Use database payment_status if available, otherwise calculate from days
                        const dbPaymentStatus = o.payment_status || 'pending';
                        const displayStatus = dbPaymentStatus === 'pending' 
                          ? (daysSinceDelivery > 7 ? 'overdue' : 'pending')
                          : dbPaymentStatus === 'waiting_verification' 
                            ? 'Pending_verification'
                            : dbPaymentStatus;
                        const isSelected = selectedPaymentOrders.includes(o.id);
                        
                        return (
                          <tr key={o.id} className={`hover:bg-gray-50 ${isSelected ? 'bg-orange-50' : ''}`}>
                            <td className="px-4 py-3">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                disabled={dbPaymentStatus !== 'pending'}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedPaymentOrders([...selectedPaymentOrders, o.id]);
                                  } else {
                                    setSelectedPaymentOrders(selectedPaymentOrders.filter(id => id !== o.id));
                                  }
                                }}
                                className="w-4 h-4 rounded border-gray-300 text-amazon-orange focus:ring-amazon-orange disabled:opacity-50"
                              />
                            </td>
                            <td className="px-4 py-3 font-medium">#{o.id}</td>
                            <td className="px-4 py-3">{new Date(o.updated_at).toLocaleDateString()}</td>
                            <td className="px-4 py-3">
                              <div>{o.client_name}</div>
                              <div className="text-xs text-gray-400">{o.client_phone}</div>
                            </td>
                            <td className="px-4 py-3 font-medium">{myTotal.toFixed(2)} {currency}</td>
                            <td className="px-4 py-3 text-blue-700">{platformFee.toFixed(2)} {currency}</td>
                            <td className="px-4 py-3 text-green-700">{commission.toFixed(2)} {currency}</td>
                            <td className="px-4 py-3 font-bold text-red-600">{totalDue.toFixed(2)} {currency}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                                displayStatus === 'overdue' ? 'bg-red-100 text-red-800' : 
                                displayStatus === 'Pending_verification' ? 'bg-yellow-100 text-yellow-800' :
                                displayStatus === 'paid' ? 'bg-green-100 text-green-800' :
                                displayStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                                'bg-orange-100 text-orange-800'
                              }`}>
                                {displayStatus === 'overdue' ? `Overdue (${daysSinceDelivery} days)` : displayStatus.replace('_', ' ')}
                              </span>
                              {o.payment_note && (
                                <p className="text-xs text-red-600 mt-1">{o.payment_note}</p>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 font-bold">
                        <td className="px-4 py-3"></td>
                        <td className="px-4 py-3" colSpan="3">TOTALS</td>
                        <td className="px-4 py-3">
                          {paymentDueOrders.reduce((s, o) => {
                            const myItems = o.myItems || [];
                            return s + myItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                          }, 0).toFixed(2)} {currency}
                        </td>
                        <td className="px-4 py-3 text-blue-700">
                          {paymentDueOrders.reduce((s, o) => s + parseFloat(o.myPlatformFee || 0), 0).toFixed(2)} {currency}
                        </td>
                        <td className="px-4 py-3 text-green-700">
                          {paymentDueOrders.reduce((s, o) => s + parseFloat(o.myCommission || 0), 0).toFixed(2)} {currency}
                        </td>
                        <td className="px-4 py-3 text-red-600">
                          {paymentDueOrders.reduce((s, o) => s + parseFloat(o.myPlatformFee || 0) + parseFloat(o.myCommission || 0), 0).toFixed(2)} {currency}
                        </td>
                        <td className="px-4 py-3"></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Payment History */}
            <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-xl font-bold text-amazon-dark">Payment History</h2>
              </div>
              {(() => {
                const paidOrders = orders.filter(o => o.payment_status === 'paid');
                if (paidOrders.length === 0) {
                  return (
                    <div className="p-8 text-center text-gray-500">
                      <p>No paid orders recorded yet.</p>
                      <p className="text-sm text-gray-400 mt-2">Payments will appear here after admin verification.</p>
                    </div>
                  );
                }
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order ID</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Client</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Order Total</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Fee</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Marketer Commission</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Paid</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Paid Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paidOrders.map(o => {
                          const total = parseFloat(o.total_amount || 0);
                          const platformFee = parseFloat(o.total_platform_fee || 0);
                          const commission = parseFloat(o.total_commission || 0);
                          const totalPaid = platformFee + commission;
                          return (
                            <tr key={o.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium">#{o.id}</td>
                              <td className="px-4 py-3">
                                <div>{o.client_name}</div>
                                <div className="text-xs text-gray-400">{o.client_phone}</div>
                              </td>
                              <td className="px-4 py-3 font-medium">{total.toFixed(2)} {currency}</td>
                              <td className="px-4 py-3 text-blue-700">{platformFee.toFixed(2)} {currency}</td>
                              <td className="px-4 py-3 text-green-700">{commission.toFixed(2)} {currency}</td>
                              <td className="px-4 py-3 font-bold text-red-600">{totalPaid.toFixed(2)} {currency}</td>
                              <td className="px-4 py-3">
                                <span className="px-2 py-1 rounded-full text-xs font-medium capitalize bg-green-100 text-green-800">
                                  Paid
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500">
                                {o.payment_date ? new Date(o.payment_date).toLocaleDateString() : '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Payment Instructions */}
            <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 text-sm text-blue-800">
              <strong>Payment Instructions:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Transfer the total due amount via Vodafone Cash</li>
                <li>Payment is due within 7 days of order delivery</li>
                <li>Late payments incur 1% penalty per week</li>
                <li>Include your Supplier ID and Order numbers in the transfer note</li>
                <li>Upload payment receipt for faster verification</li>
              </ul>
              <div className="mt-3 pt-3 border-t border-blue-200">
                <strong>Vodafone Cash:</strong>
                <p>Phone: +20 10 37450540</p>
                <p>Name: Partnerza Platform</p>
              </div>
            </div>
          </div>
        )}

        {/* ======= TAB 4: BALANCE ======= */}
        {activeTab === 'balance' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Total Commission Owed to Marketers</p>
                <p className="text-3xl font-bold text-green-700">{totalCommissionOwed.toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <p className="text-xs text-gray-400 mt-1">On all confirmed/shipped/delivered/completed orders</p>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Total Platform Fees Due</p>
                <p className="text-3xl font-bold text-blue-600">{totalPlatformFees.toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <p className="text-xs text-gray-400 mt-1">On all confirmed/shipped/delivered/completed orders</p>
              </div>
              <div className="bg-white shadow-amazon rounded-sm p-6">
                <p className="text-sm text-gray-500 mb-1">Supplier Net Revenue</p>
                <p className="text-3xl font-bold text-amazon-dark">{supplierNetRevenue.toFixed(2)} <span className="text-sm font-normal">{currency}</span></p>
                <p className="text-xs text-gray-400 mt-1">Your earnings (completed orders only)</p>
              </div>
            </div>

            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Monthly Summary (Completed Orders)</h2>
              {(() => {
                // Get all completed orders with this supplier's items
                const completedOrdersWithMyItems = orders.filter(o => {
                  if (o.status !== 'completed') return false;
                  const myItems = o.items ? o.items.filter(item => item.supplier_id === user?.id) : [];
                  return myItems.length > 0;
                });
                
                if (completedOrdersWithMyItems.length === 0) {
                  return <p className="text-gray-500 text-sm">No completed orders with your products yet.</p>;
                }
                
                // Group by month
                const months = {};
                completedOrdersWithMyItems.forEach(o => {
                  const d = new Date(o.created_at);
                  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                  if (!months[key]) months[key] = { count: 0, revenue: 0, commission: 0, fees: 0, net: 0 };
                  
                  const myItems = o.items.filter(item => item.supplier_id === user?.id);
                  const myRevenue = myItems.reduce((sum, item) => sum + (parseFloat(item.total_amount) || 0), 0);
                  const myComm = myItems.reduce((sum, item) => sum + (parseFloat(item.marketer_commission_amount) || 0), 0);
                  const myFee = myItems.reduce((sum, item) => sum + (parseFloat(item.platform_fee_amount) || 0), 0);
                  
                  months[key].count++;
                  months[key].revenue += myRevenue;
                  months[key].commission += myComm;
                  months[key].fees += myFee;
                  months[key].net += (myRevenue - myComm - myFee);  // Net = Revenue - Commission - Platform Fees
                });
                
                return (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Month</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Orders</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Revenue ({currency})</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Commission ({currency})</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Platform Fees ({currency})</th>
                          <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Net ({currency})</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {Object.entries(months).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6).map(([month, data]) => (
                          <tr key={month} className="hover:bg-gray-50">
                            <td className="px-4 py-3 font-medium">{month}</td>
                            <td className="px-4 py-3">{data.count}</td>
                            <td className="px-4 py-3">{data.revenue.toFixed(2)}</td>
                            <td className="px-4 py-3 text-green-700">{data.commission.toFixed(2)}</td>
                            <td className="px-4 py-3 text-blue-700">{data.fees.toFixed(2)}</td>
                            <td className="px-4 py-3 font-bold">{data.net.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded p-4 text-sm text-yellow-800">
              <strong>Note:</strong> These calculations show your portion only (products you supplied). Commission and fees are what you owe to marketers and the platform.
            </div>
          </div>
        )}

        {/* ======= TAB 5: SHIPPING RATES ======= */}
        {activeTab === 'shipping' && (
          <div className="bg-white shadow-amazon rounded-sm overflow-hidden">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-amazon-dark">Shipping Rates Management</h2>
              <p className="text-sm text-gray-500 mt-1">Set shipping costs per city for your products</p>
            </div>
            
            {/* Country Selection */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Select Country</label>
                  <select 
                    value={shippingCountry}
                    onChange={(e) => setShippingCountry(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white"
                  >
                    <option value="Egypt">Egypt</option>
                    <option value="Saudi Arabia">Saudi Arabia</option>
                    <option value="United Arab Emirates">United Arab Emirates</option>
                    <option value="Kuwait">Kuwait</option>
                    <option value="Qatar">Qatar</option>
                    <option value="Bahrain">Bahrain</option>
                    <option value="Oman">Oman</option>
                    <option value="Jordan">Jordan</option>
                    <option value="Lebanon">Lebanon</option>
                    <option value="Iraq">Iraq</option>
                    <option value="Morocco">Morocco</option>
                    <option value="Turkey">Turkey</option>
                  </select>
                </div>
                <button 
                  onClick={async () => {
                    try {
                      const res = await api.get(`/api/shipping-rates/cities-by-country/${encodeURIComponent(shippingCountry)}`);
                      setAvailableCities(res.data);
                      alert(`Loaded ${res.data.length} cities for ${shippingCountry}. Now add shipping prices for each city.`);
                    } catch (err) {
                      alert('Failed to load cities');
                    }
                  }}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                >
                  Load Cities
                </button>
              </div>
            </div>

            {/* Add New Rate Form */}
            <div className="p-4 bg-gray-50 border-b border-gray-200">
              <form onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await api.post('/api/shipping-rates/single', {
                    city: newRateForm.city,
                    cost: parseFloat(newRateForm.cost),
                    country: shippingCountry
                  });
                  setNewRateForm({ city: '', cost: '' });
                  fetchShippingRates();
                  alert('Shipping rate added successfully');
                } catch (err) {
                  alert(err.response?.data?.error || 'Failed to add shipping rate');
                }
              }} className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">City</label>
                  <select 
                    value={newRateForm.city}
                    onChange={(e) => setNewRateForm({ ...newRateForm, city: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange bg-white min-w-[200px]"
                  >
                    <option value="">Select City</option>
                    {availableCities.map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Shipping Cost ({currency})</label>
                  <input type="number" step="0.01" min="0" required placeholder="0.00"
                    value={newRateForm.cost}
                    onChange={(e) => setNewRateForm({ ...newRateForm, cost: e.target.value })}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                </div>
                <button type="submit"
                  className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm">
                  Add Rate
                </button>
              </form>
            </div>

            {/* Quick Add All Cities */}
            {availableCities.length > 0 && (
              <div className="p-4 bg-blue-50 border-b border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Quick Setup: Set Same Price for All Cities</h3>
                <div className="flex flex-wrap gap-4 items-end">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Default Cost for All Cities ({currency})</label>
                    <input type="number" step="0.01" min="0" id="bulkCost"
                      placeholder="0.00"
                      className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <button 
                    onClick={async () => {
                      const cost = document.getElementById('bulkCost').value;
                      if (!cost || isNaN(parseFloat(cost))) {
                        alert('Please enter a valid cost');
                        return;
                      }
                      try {
                        const rates = availableCities.map(city => ({
                          city,
                          cost: parseFloat(cost)
                        }));
                        await api.post('/api/shipping-rates/bulk', {
                          country: shippingCountry,
                          rates
                        });
                        fetchShippingRates();
                        alert(`Set ${cost} {currency} shipping for all ${availableCities.length} cities`);
                      } catch (err) {
                        alert('Failed to save bulk rates');
                      }
                    }}
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Apply to All Cities
                  </button>
                </div>
              </div>
            )}

            {/* Shipping Rates Table */}
            {shippingRates.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <p>No shipping rates configured yet.</p>
                <p className="text-sm text-gray-400 mt-2">Select a country and add shipping costs for each city.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">City</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Country</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Cost ({currency})</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {shippingRates.map(rate => (
                      <tr key={rate.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-medium">{rate.city}</td>
                        <td className="px-4 py-3">{rate.country}</td>
                        <td className="px-4 py-3">{parseFloat(rate.cost).toFixed(2)} {currency}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1">
                            <button 
                              onClick={async () => {
                                const newCost = prompt('Enter new shipping cost:', rate.cost);
                                if (newCost && !isNaN(parseFloat(newCost))) {
                                  try {
                                    await api.post('/api/shipping-rates/single', {
                                      city: rate.city,
                                      cost: parseFloat(newCost),
                                      country: rate.country
                                    });
                                    fetchShippingRates();
                                    alert('Rate updated');
                                  } catch (err) {
                                    alert('Failed to update rate');
                                  }
                                }
                              }}
                              className="px-2 py-1 bg-yellow-500 text-white text-xs rounded">
                              Edit
                            </button>
                            <button 
                              onClick={async () => {
                                if (!confirm(`Delete shipping rate for ${rate.city}?`)) return;
                                try {
                                  await api.delete(`/api/shipping-rates/${encodeURIComponent(rate.city)}`);
                                  fetchShippingRates();
                                  alert('Rate deleted');
                                } catch (err) {
                                  alert('Failed to delete rate');
                                }
                              }}
                              className="px-2 py-1 bg-red-500 text-white text-xs rounded">
                              Delete
                            </button>
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

        {/* ======= TAB 6: PROFILE ======= */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            {/* User Information */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-amazon-orange flex items-center justify-center text-amazon-dark font-bold text-lg">
                  {settingsForm.name ? settingsForm.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amazon-dark">معلومات المستخدم - User Information</h2>
                  <p className="text-xs text-gray-500">Your personal account details</p>
                </div>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSavingSettings(true);
                try {
                  const { data } = await api.patch('/api/auth/profile', settingsForm);
                  alert('Profile updated successfully');
                  // Update auth context so nav bar shows new name
                  if (data.user && setUser) {
                    setUser(data.user);
                  }
                  fetchUserProfile();
                } catch (err) {
                  alert(err.response?.data?.error || 'Failed to update profile');
                } finally {
                  setSavingSettings(false);
                }
              }} className="max-w-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الاسم - Name *</label>
                    <input type="text" required
                      value={settingsForm.name}
                      onChange={(e) => setSettingsForm({...settingsForm, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">البريد الإلكتروني - Email *</label>
                    <input type="email" required
                      value={settingsForm.email}
                      onChange={(e) => setSettingsForm({...settingsForm, email: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">الهاتف - Phone</label>
                    <input type="tel"
                      value={settingsForm.phone}
                      onChange={(e) => setSettingsForm({...settingsForm, phone: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">واتساب - WhatsApp</label>
                    <input type="tel"
                      value={settingsForm.whatsapp}
                      onChange={(e) => setSettingsForm({...settingsForm, whatsapp: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={savingSettings}
                    className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50">
                    {savingSettings ? 'Saving...' : 'Save User Info'}
                  </button>
                </div>
              </form>
            </div>

            {/* Business Information */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-amazon-dark">معلومات النشاط التجاري - Business Information</h2>
                  <p className="text-xs text-gray-500">Your business/company details shown to marketers</p>
                </div>
              </div>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setSavingSettings(true);
                try {
                  await api.patch('/api/auth/profile', settingsForm);
                  alert('Business info updated successfully');
                  fetchUserProfile();
                } catch (err) {
                  alert(err.response?.data?.error || 'Failed to update business info');
                } finally {
                  setSavingSettings(false);
                }
              }} className="max-w-2xl space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">اسم النشاط التجاري - Business Name</label>
                    <input type="text"
                      value={settingsForm.business_name}
                      onChange={(e) => setSettingsForm({...settingsForm, business_name: e.target.value})}
                      placeholder="e.g., My Store LLC"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">البريد التجاري - Business Email</label>
                    <input type="email"
                      value={settingsForm.business_email}
                      onChange={(e) => setSettingsForm({...settingsForm, business_email: e.target.value})}
                      placeholder="info@mybusiness.com"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">هاتف العمل - Business Phone</label>
                    <input type="tel"
                      value={settingsForm.business_phone}
                      onChange={(e) => setSettingsForm({...settingsForm, business_phone: e.target.value})}
                      placeholder="+20 2 1234 5678"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">تيليجرام - Telegram</label>
                    <input type="text" placeholder="@username"
                      value={settingsForm.telegram}
                      onChange={(e) => setSettingsForm({...settingsForm, telegram: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">الموقع الإلكتروني - Website URL</label>
                    <input type="url" placeholder="https://..."
                      value={settingsForm.website}
                      onChange={(e) => setSettingsForm({...settingsForm, website: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                  </div>
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={savingSettings}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50">
                    {savingSettings ? 'Saving...' : 'Save Business Info'}
                  </button>
                </div>
              </form>
            </div>

            {/* Change Password */}
            <div className="bg-white shadow-amazon rounded-sm p-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Change Password</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  alert('New passwords do not match');
                  return;
                }
                setChangingPassword(true);
                try {
                  await api.post('/api/auth/change-password', {
                    currentPassword: passwordForm.currentPassword,
                    newPassword: passwordForm.newPassword
                  });
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  alert('Password changed successfully');
                } catch (err) {
                  alert(err.response?.data?.error || 'Failed to change password');
                } finally {
                  setChangingPassword(false);
                }
              }} className="max-w-md space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
                  <input type="password" required
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input type="password" required minLength="6"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
                  <input type="password" required
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange" />
                </div>
                <div className="pt-4">
                  <button type="submit" disabled={changingPassword}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50">
                    {changingPassword ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal */}
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-amazon-dark">Make Payment</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Paying for {selectedPaymentOrders.length} order(s) - Total: {selectedPaymentTotal.toFixed(2)} {currency}
                </p>
              </div>
              <form onSubmit={handlePaymentSubmit} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded border">
                    <span className="font-medium">Vodafone Cash</span>
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">+20 10 37450540</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Receipt *</label>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    required
                    onChange={(e) => setPaymentReceipt(e.target.files[0])}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                  <p className="text-xs text-gray-500 mt-1">Upload transfer receipt image or PDF</p>
                  {paymentReceipt && (
                    <p className="text-xs text-green-600 mt-1">Selected: {paymentReceipt.name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Transaction Reference *</label>
                  <input
                    type="text"
                    required
                    value={paymentFormData.transactionReference}
                    onChange={(e) => setPaymentFormData({...paymentFormData, transactionReference: e.target.value})}
                    placeholder="e.g., TRX123456789"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={paymentFormData.paymentDate}
                    onChange={(e) => setPaymentFormData({...paymentFormData, paymentDate: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                  <textarea
                    rows="2"
                    value={paymentFormData.notes}
                    onChange={(e) => setPaymentFormData({...paymentFormData, notes: e.target.value})}
                    placeholder="Any additional information..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-amazon-orange hover:brightness-110 text-amazon-dark px-4 py-2 rounded-full font-bold text-sm"
                  >
                    Submit Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentModal(false)}
                    className="flex-1 border border-gray-300 hover:border-gray-400 px-4 py-2 rounded-full text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </form>
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

                    {/* Marketer Info */}
                    <div className="bg-blue-50 p-3 rounded">
                      <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Marketer</h4>
                      <div className="text-sm">
                        <p className="font-medium">{orderDetails.marketer_name}</p>
                      </div>
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
                          <span>Marketer Commission:</span>
                          <span>{parseFloat(orderDetails.total_commission || 0).toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between text-blue-700">
                          <span>Platform Fee:</span>
                          <span>{parseFloat(orderDetails.total_platform_fee || 0).toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between font-bold text-amazon-dark border-t pt-2">
                          <span>Supplier Net:</span>
                          <span>{(parseFloat(orderDetails.total_amount || 0) - parseFloat(orderDetails.total_commission || 0) - parseFloat(orderDetails.total_platform_fee || 0)).toFixed(2)} {currency}</span>
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
