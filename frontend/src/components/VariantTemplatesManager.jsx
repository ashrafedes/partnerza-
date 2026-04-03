import { useState, useEffect } from 'react';
import api from '../api/axios';

// Predefined product categories
const PREDEFINED_CATEGORIES = [
  'Bazaar', 'Fresh', "Today's Deals", 'Electronics', 'Toys & Games',
  'Supermarket', 'Prime', 'Fashion', 'Home', 'Mobile Phones', 'Appliances', 'Video Games'
];

export default function VariantTemplatesManager() {
  const [templates, setTemplates] = useState([]);
  const [groupedTemplates, setGroupedTemplates] = useState({});
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState('');
  const [newVariantName, setNewVariantName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/variants/templates');
      setTemplates(res.data.templates || []);
      setGroupedTemplates(res.data.grouped || {});
    } catch (err) {
      console.error('Failed to fetch templates:', err);
      setError('Failed to load variant templates');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleAddTemplate = async (e) => {
    e.preventDefault();
    if (!newCategory.trim() || !newVariantName.trim()) return;

    try {
      setSaving(true);
      await api.post('/api/variants/templates', {
        category: newCategory.trim(),
        variant_name: newVariantName.trim()
      });
      setNewCategory('');
      setNewVariantName('');
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to add template:', err);
      alert(err.response?.data?.error || 'Failed to add template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Are you sure you want to delete this variant template?')) return;

    try {
      await api.delete(`/api/variants/templates/${id}`);
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
      alert('Failed to delete template');
    }
  };

  const categories = Object.keys(groupedTemplates).sort();
  
  // Combine predefined categories with any custom ones that have templates
  const allCategories = [...new Set([...PREDEFINED_CATEGORIES, ...categories])].sort();

  return (
    <div className="bg-white shadow-amazon rounded-sm p-6">
      <h2 className="text-xl font-bold text-amazon-dark mb-4">Category Variant Templates</h2>
      <p className="text-sm text-gray-500 mb-6">
        Define which variant types each product category should have (e.g., Shoes → Color, Size).
        Suppliers will see these as default options when creating products.
      </p>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded p-3 mb-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Add New Template Form */}
      <form onSubmit={handleAddTemplate} className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add New Template</h3>
        <div className="flex gap-3 flex-wrap">
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 min-w-[150px] bg-white"
            required
          >
            <option value="">Select Category</option>
            {allCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Variant Name (e.g., Color)"
            value={newVariantName}
            onChange={(e) => setNewVariantName(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm flex-1 min-w-[150px]"
            required
          />
          <button
            type="submit"
            disabled={saving}
            className="bg-amazon-orange hover:brightness-110 text-amazon-dark px-6 py-2 rounded-full font-bold text-sm disabled:opacity-50"
          >
            {saving ? 'Adding...' : 'Add Template'}
          </button>
        </div>
      </form>

      {/* Templates List */}
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amazon-orange"></div>
        </div>
      ) : categories.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No variant templates defined yet.</p>
      ) : (
        <div className="space-y-4">
          {categories.map(category => (
            <div key={category} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-100 px-4 py-3 flex items-center justify-between">
                <h3 className="font-semibold text-amazon-dark">{category}</h3>
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded">
                  {groupedTemplates[category].length} variant{groupedTemplates[category].length !== 1 ? 's' : ''}
                </span>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2">
                  {groupedTemplates[category].map(template => (
                    <div
                      key={template.id}
                      className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5"
                    >
                      <span className="text-sm text-blue-800 font-medium">{template.variant_name}</span>
                      <button
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-blue-400 hover:text-blue-600"
                        title="Delete template"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Default Templates Info */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h3 className="text-sm font-semibold text-yellow-800 mb-2">Default Templates</h3>
        <p className="text-xs text-yellow-700">
          The system comes with pre-configured templates for common categories:
        </p>
        <ul className="mt-2 text-xs text-yellow-700 space-y-1">
          <li>• <strong>Shoes:</strong> Color, Size</li>
          <li>• <strong>Fashion:</strong> Color, Size, Material</li>
          <li>• <strong>Electronics:</strong> Color, Storage</li>
          <li>• <strong>Mobile Phones:</strong> Color, Storage, RAM</li>
        </ul>
      </div>
    </div>
  );
}
