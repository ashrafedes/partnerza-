import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const categories = [
  'Bazaar','Fresh',"Today's Deals",'Electronics','Toys & Games',
  'Supermarket','Prime','Fashion','Home','Mobile Phones','Appliances','Video Games'
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mainImage, setMainImage] = useState(0);
  const [showGallery, setShowGallery] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    price: '',
    marketer_commission_rate: '',
    category: '',
    stock_quantity: '0',
    status: 'active'
  });
  const [editSpecs, setEditSpecs] = useState([]);
  const [editImages, setEditImages] = useState([]);
  const [editVideo, setEditVideo] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const { user, role, logout } = useAuth();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const { data } = await api.get(`/api/products/${id}`);
        console.log('ProductDetail - Product data:', data);
        console.log('ProductDetail - main_media_type:', data.main_media_type, 'main_media_id:', data.main_media_id);
        console.log('ProductDetail - images:', data.images);
        setProduct(data);
        // Set initial main image based on main_media_id
        if (data.main_media_type === 'image' && data.main_media_id && data.images) {
          const mainIndex = data.images.findIndex(img => String(img.id) === String(data.main_media_id));
          console.log('ProductDetail - mainIndex found:', mainIndex);
          if (mainIndex >= 0) {
            setMainImage(mainIndex);
          }
        }
      } catch (err) {
        console.error('Failed to load product:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const openGallery = (index) => {
    setGalleryIndex(index);
    setShowGallery(true);
  };

  const closeGallery = () => setShowGallery(false);

  const nextImage = () => {
    if (product?.images?.length) {
      setGalleryIndex((prev) => (prev + 1) % product.images.length);
    }
  };

  const prevImage = () => {
    if (product?.images?.length) {
      setGalleryIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
    }
  };

  const openEditModal = () => {
    setEditFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price || '',
      marketer_commission_rate: product.marketer_commission_rate || '',
      category: product.category || '',
      stock_quantity: product.stock_quantity || '0',
      status: product.status || 'active'
    });
    setEditSpecs(product.specs && product.specs.length > 0 ? product.specs : [{ spec_key: '', spec_value: '' }]);
    setExistingImages(product.images || []);
    setEditImages([]);
    setEditVideo(null);
    setShowEditModal(true);
  };

  const handleEditFormChange = (e) => {
    setEditFormData({ ...editFormData, [e.target.name]: e.target.value });
  };

  const handleEditSpecChange = (index, field, value) => {
    const newSpecs = [...editSpecs];
    newSpecs[index][field] = value;
    setEditSpecs(newSpecs);
  };

  const addEditSpec = () => {
    setEditSpecs([...editSpecs, { spec_key: '', spec_value: '' }]);
  };

  const removeEditSpec = (index) => {
    setEditSpecs(editSpecs.filter((_, i) => i !== index));
  };

  const handleEditImageChange = (e) => {
    setEditImages([...editImages, ...Array.from(e.target.files)]);
  };

  const handleEditVideoChange = (e) => {
    if (e.target.files[0]) setEditVideo(e.target.files[0]);
  };

  const removeExistingImage = (imageId) => {
    setExistingImages(existingImages.filter(img => img.id !== imageId));
  };

  const removeNewImage = (index) => {
    setEditImages(editImages.filter((_, i) => i !== index));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setSavingProduct(true);
    try {
      const formData = new FormData();
      formData.append('name', editFormData.name);
      formData.append('description', editFormData.description);
      formData.append('price', editFormData.price);
      formData.append('marketer_commission_rate', editFormData.marketer_commission_rate);
      formData.append('category', editFormData.category);
      formData.append('stock_quantity', editFormData.stock_quantity);
      formData.append('status', editFormData.status);
      
      // Add specs
      const validSpecs = editSpecs.filter(s => s.spec_key && s.spec_value);
      if (validSpecs.length > 0) {
        formData.append('specs', JSON.stringify(validSpecs));
      }
      
      // Add existing images to keep
      formData.append('existing_image_ids', JSON.stringify(existingImages.map(img => img.id)));
      
      // Add new images
      editImages.forEach(file => formData.append('images', file));
      
      // Add new video
      if (editVideo) formData.append('video', editVideo);
      
      await api.put(`/api/products/${id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      alert('Product updated successfully');
      setShowEditModal(false);
      // Refresh product data
      const { data } = await api.get(`/api/products/${id}`);
      setProduct(data);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update product');
    } finally {
      setSavingProduct(false);
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
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amazon-dark mb-2">Product Not Found</h2>
          <Link to="/marketplace" className="text-amazon-orange hover:underline">Back to Marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-amazon-light print:bg-white" style={{ fontFamily: "'Amazon Ember', Arial, sans-serif" }}>
      {/* NAV - hidden on print */}
      <nav className="bg-amazon-dark text-white h-[60px] flex items-center px-4 sticky top-0 z-50 print:hidden">
        <Link to="/" className="flex items-center mr-4 border border-transparent hover:border-white p-1 rounded-sm">
          <span className="text-xl font-bold text-white">Partnerza</span>
          <span className="text-amazon-orange text-xs ml-0.5">.sa</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center space-x-3 text-sm">
          {user ? (
            <div className="relative group">
              <div className="border border-transparent hover:border-white p-1 rounded-sm cursor-pointer leading-tight">
                <span className="text-xs text-gray-300">Hello, {user.name}</span><br />
                <span className="font-bold text-sm">Account</span>
              </div>
              <div className="absolute right-0 mt-0 w-52 bg-white rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-50 border border-gray-200">
                <div className="p-3">
                  <Link to="/marketplace" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Marketplace</Link>
                  {role === 'marketer' && <Link to="/marketer" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">My Dashboard</Link>}
                  {role === 'supplier' && <Link to="/supplier" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Dashboard</Link>}
                  {role === 'superadmin' && <Link to="/admin" className="block px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded">Admin</Link>}
                  <button onClick={logout} className="block w-full text-left px-2 py-1 text-sm text-gray-700 hover:bg-gray-100 rounded border-t mt-2 pt-2">Sign Out</button>
                </div>
              </div>
            </div>
          ) : (
            <Link to="/login" className="border border-transparent hover:border-white p-1 rounded-sm">Sign In</Link>
          )}
        </div>
      </nav>

      {/* Breadcrumb - hidden on print */}
      <div className="max-w-[1400px] mx-auto px-4 py-2 text-sm text-gray-500 print:hidden">
        <Link to="/marketplace" className="hover:text-amazon-orange">Marketplace</Link>
        <span className="mx-1">›</span>
        <span>{product.category || 'Product'}</span>
        <span className="mx-1">›</span>
        <span className="text-gray-700">{product.name}</span>
      </div>

      {/* Product Detail */}
      <div className="max-w-[1400px] mx-auto px-4 py-4">
        <div className="bg-white rounded-sm shadow-amazon p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Image/Video Gallery */}
            <div>
              {/* Main Image with Gallery Trigger */}
              <div 
                className="border border-gray-200 rounded-sm mb-3 flex items-center justify-center bg-gray-50 aspect-square overflow-hidden cursor-zoom-in group relative"
                onClick={() => openGallery(mainImage)}
              >
                {product.main_media_type === 'video' && product.videos && product.videos.length > 0 ? (
                  <video
                    src={`http://localhost:5000/uploads/${product.videos[0]?.video_path}`}
                    controls
                    className="max-w-full max-h-full object-contain"
                  />
                ) : product.images && product.images.length > 0 ? (
                  <>
                    <img
                      src={`http://localhost:5000/uploads/${product.images[mainImage]?.image_path || product.images[mainImage]}`}
                      alt={product.name}
                      className="max-w-full max-h-full object-contain transition-transform group-hover:scale-105"
                      onError={(e) => { e.target.style.display='none'; e.target.parentElement.innerHTML='<div class="text-gray-400 text-sm">Failed to load image</div>'; }}
                    />
                    <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                      <div className="opacity-0 group-hover:opacity-100 bg-white rounded-full p-3 shadow-lg transition-opacity">
                        <svg className="w-8 h-8 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                        </svg>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-gray-400 text-sm">No media</div>
                )}
              </div>
              
              {/* Thumbnails Grid */}
              {product.images && product.images.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {product.images.map((img, i) => (
                    <button
                      key={i}
                      onClick={() => setMainImage(i)}
                      className={`aspect-square border-2 rounded-sm overflow-hidden relative ${i === mainImage ? 'border-amazon-orange ring-2 ring-amazon-orange' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                      <img 
                        src={`http://localhost:5000/uploads/${img?.image_path || img}`} 
                        alt="" 
                        className="w-full h-full object-cover"
                        onError={(e) => { e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjBmMGYwIi8+PC9zdmc+'; }}
                      />
                      {product.main_media_type === 'image' && product.main_media_id === img.id && (
                        <div className="absolute top-0 right-0 bg-amazon-orange text-white text-[8px] px-1 rounded-bl">★</div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              
              {/* Video Section */}
              {product.videos && product.videos.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Product Video</h4>
                  <video
                    src={`http://localhost:5000/uploads/${product.videos[0]?.video_path}`}
                    controls
                    className="w-full max-h-64 rounded border"
                  />
                </div>
              )}
            </div>

            {/* Product Info */}
            <div>
              <h1 className="text-2xl font-bold text-amazon-dark mb-2">{product.name}</h1>
              <p className="text-sm text-gray-500 mb-1">by <span className="text-amazon-orange">{product.supplier_name}</span></p>
              {product.category && (
                <span className="inline-block bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded mb-3">{product.category}</span>
              )}

              <div className="border-t border-b border-gray-200 py-3 my-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm text-gray-500">Price:</span>
                  <span className="text-3xl font-bold text-amazon-dark">{parseFloat(product.price).toFixed(2)}</span>
                  <span className="text-lg text-gray-600">SAR</span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-sm text-gray-500">Commission Rate:</span>
                  <span className="text-lg font-semibold text-green-700">{product.marketer_commission_rate}%</span>
                  <span className="text-sm text-gray-400">({(product.price * product.marketer_commission_rate / 100).toFixed(2)} SAR per unit)</span>
                </div>
              </div>

              {product.description && (
                <div className="mb-4">
                  <h3 className="font-semibold text-amazon-dark mb-1">Description</h3>
                  <p className="text-gray-700 text-sm whitespace-pre-wrap">{product.description}</p>
                </div>
              )}

              {/* Action Buttons - hidden on print */}
              <div className="flex flex-col gap-3 mt-4 print:hidden">
                {role === 'marketer' && (
                  <button
                    onClick={() => navigate(`/products/${product.id}/order`)}
                    className="w-full bg-amazon-orange hover:brightness-110 text-amazon-dark py-3 rounded-full font-bold text-sm"
                  >
                    Submit Order for Client
                  </button>
                )}
                {role === 'supplier' && user && user.id === product.supplier_id && (
                  <button
                    onClick={openEditModal}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-full font-bold text-sm"
                  >
                    Edit Product
                  </button>
                )}
                <button
                  onClick={() => window.print()}
                  className="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 py-2 rounded-full font-bold text-sm"
                >
                  Print / Share Specs
                </button>
                <Link to="/marketplace" className="text-amazon-orange text-sm hover:underline text-center">
                  ← Back to Marketplace
                </Link>
              </div>
            </div>
          </div>

          {/* Specifications Table */}
          {product.specs && product.specs.length > 0 && (
            <div className="mt-8 border-t border-gray-200 pt-6">
              <h2 className="text-xl font-bold text-amazon-dark mb-4">Specifications</h2>
              <table className="w-full text-sm">
                <tbody>
                  {product.specs.map((spec, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                      <td className="py-2 px-4 font-semibold text-gray-700 w-1/3 border border-gray-200">{spec.spec_key}</td>
                      <td className="py-2 px-4 text-gray-600 border border-gray-200">{spec.spec_value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Gallery Modal */}
      {showGallery && product?.images?.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeGallery}
            className="absolute top-4 right-4 text-white hover:text-gray-300 z-50 p-2"
          >
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Image Counter */}
          <div className="absolute top-4 left-4 text-white text-sm">
            {galleryIndex + 1} / {product.images.length}
          </div>

          {/* Previous Button */}
          <button
            onClick={prevImage}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 bg-black bg-opacity-50 rounded-full"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Main Gallery Image */}
          <div className="max-w-[90vw] max-h-[80vh] flex items-center justify-center">
            <img
              src={`http://localhost:5000/uploads/${product.images[galleryIndex]?.image_path || product.images[galleryIndex]}`}
              alt={product.name}
              className="max-w-full max-h-[80vh] object-contain"
              onError={(e) => { e.target.style.display='none'; }}
            />
          </div>

          {/* Next Button */}
          <button
            onClick={nextImage}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:text-gray-300 p-2 bg-black bg-opacity-50 rounded-full"
          >
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Thumbnails at Bottom */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 max-w-[90vw] overflow-x-auto px-4">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setGalleryIndex(i)}
                className={`w-16 h-16 border-2 rounded overflow-hidden flex-shrink-0 ${i === galleryIndex ? 'border-amazon-orange' : 'border-gray-600 hover:border-gray-400'}`}
              >
                <img
                  src={`http://localhost:5000/uploads/${img?.image_path || img}`}
                  alt=""
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-amazon-dark">Edit Product</h2>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    name="name"
                    value={editFormData.name}
                    onChange={handleEditFormChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    name="category"
                    value={editFormData.category}
                    onChange={handleEditFormChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  >
                    <option value="">Select category</option>
                    {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              </div>

              {/* Price & Commission */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price *</label>
                  <input
                    type="number"
                    name="price"
                    value={editFormData.price}
                    onChange={handleEditFormChange}
                    required
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Commission Rate *</label>
                  <input
                    type="number"
                    name="marketer_commission_rate"
                    value={editFormData.marketer_commission_rate}
                    onChange={handleEditFormChange}
                    required
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    name="stock_quantity"
                    value={editFormData.stock_quantity}
                    onChange={handleEditFormChange}
                    min="0"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  name="status"
                  value={editFormData.status}
                  onChange={handleEditFormChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                >
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  name="description"
                  value={editFormData.description}
                  onChange={handleEditFormChange}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                />
              </div>

              {/* Specifications */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specifications</label>
                {editSpecs.map((spec, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Key"
                      value={spec.spec_key}
                      onChange={(e) => handleEditSpecChange(index, 'spec_key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                    />
                    <input
                      type="text"
                      placeholder="Value"
                      value={spec.spec_value}
                      onChange={(e) => handleEditSpecChange(index, 'spec_value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                    />
                    <button
                      type="button"
                      onClick={() => removeEditSpec(index)}
                      className="text-red-600 hover:text-red-800 px-2"
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addEditSpec}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Add Specification
                </button>
              </div>

              {/* Existing Images */}
              {existingImages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Images</label>
                  <div className="flex flex-wrap gap-2">
                    {existingImages.map((img) => (
                      <div key={img.id} className="relative">
                        <img
                          src={`http://localhost:5000/uploads/${img.image_path}`}
                          alt=""
                          className="w-20 h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeExistingImage(img.id)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* New Images */}
              {editImages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Images to Add</label>
                  <div className="flex flex-wrap gap-2">
                    {editImages.map((file, index) => (
                      <div key={index} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt=""
                          className="w-20 h-20 object-cover rounded border"
                        />
                        <button
                          type="button"
                          onClick={() => removeNewImage(index)}
                          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 text-xs flex items-center justify-center hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Add Images */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Add New Images</label>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleEditImageChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                />
              </div>

              {/* Video */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Video (optional)</label>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleEditVideoChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amazon-orange"
                />
                {editVideo && <p className="text-sm text-gray-500 mt-1">Selected: {editVideo.name}</p>}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="flex-1 px-4 py-2 bg-amazon-orange text-amazon-dark rounded-md font-bold hover:brightness-110 disabled:opacity-50"
                >
                  {savingProduct ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
