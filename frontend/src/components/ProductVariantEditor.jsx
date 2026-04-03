import { useState, useEffect } from 'react';
import api from '../api/axios';

/**
 * ProductVariantEditor Component
 * 
 * Props:
 * - category: string (product category)
 * - productId: number|null (null for new products, id for existing)
 * - onVariantsChange: function({ variants, stock })
 * 
 * Manages variant types, options, and stock matrix
 */
export default function ProductVariantEditor({ category, productId, onVariantsChange }) {
  const [templates, setTemplates] = useState([]);
  const [variants, setVariants] = useState([]);
  const [stock, setStock] = useState({});
  const [loading, setLoading] = useState(false);
  const [showStockMatrix, setShowStockMatrix] = useState(false);

  // Fetch templates when category changes
  useEffect(() => {
    if (!category) return;
    
    const fetchTemplates = async () => {
      try {
        setLoading(true);
        const res = await api.get(`/api/variants/templates/${category}`);
        if (res.data.templates.length > 0) {
          // Auto-populate variants from templates
          const newVariants = res.data.templates.map((t, idx) => ({
            variant_name: t.variant_name,
            options: '', // Comma-separated values
            is_required: true,
            sort_order: idx
          }));
          setVariants(newVariants);
        }
      } catch (err) {
        console.error('Failed to fetch templates:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, [category]);

  // Fetch existing variants if editing
  useEffect(() => {
    if (!productId) return;
    
    const fetchProductVariants = async () => {
      try {
        const res = await api.get(`/api/products/${productId}/variants`);
        if (res.data.variants.length > 0) {
          const existingVariants = res.data.variants.map(v => ({
            variant_name: v.variant_name,
            options: v.options.join(', '),
            is_required: v.is_required,
            sort_order: v.sort_order
          }));
          setVariants(existingVariants);
          
          // Populate stock
          const stockMap = {};
          res.data.stock.forEach(s => {
            const key = Object.entries(s.combination)
              .map(([k, v]) => `${k}:${v}`)
              .join('|');
            stockMap[key] = s.stock_quantity;
          });
          setStock(stockMap);
          setShowStockMatrix(true);
        }
      } catch (err) {
        console.error('Failed to fetch product variants:', err);
      }
    };

    fetchProductVariants();
  }, [productId]);

  // Notify parent of changes
  useEffect(() => {
    const formattedVariants = variants.map(v => ({
      variant_name: v.variant_name,
      options: v.options.split(',').map(o => o.trim()).filter(o => o),
      is_required: v.is_required,
      sort_order: v.sort_order
    }));

    const formattedStock = Object.entries(stock).map(([combination, quantity]) => {
      const comboObj = {};
      combination.split('|').forEach(part => {
        const [key, val] = part.split(':');
        comboObj[key] = val;
      });
      return { combination: comboObj, stock_quantity: parseInt(quantity) || 0 };
    });

    onVariantsChange?.({ variants: formattedVariants, stock: formattedStock });
  }, [variants, stock]);

  const addVariant = () => {
    setVariants([...variants, {
      variant_name: '',
      options: '',
      is_required: true,
      sort_order: variants.length
    }]);
  };

  const removeVariant = (index) => {
    const updated = variants.filter((_, i) => i !== index);
    setVariants(updated);
    setShowStockMatrix(false);
  };

  const updateVariant = (index, field, value) => {
    const updated = [...variants];
    updated[index][field] = value;
    setVariants(updated);
    setShowStockMatrix(false);
  };

  const generateStockMatrix = () => {
    const validVariants = variants.filter(v => 
      v.variant_name.trim() && 
      v.options.split(',').some(o => o.trim())
    );
    
    if (validVariants.length === 0) {
      alert('Please add at least one variant with options');
      return;
    }

    setShowStockMatrix(true);
  };

  const getAllCombinations = () => {
    const validVariants = variants.filter(v => 
      v.variant_name.trim() && 
      v.options.split(',').some(o => o.trim())
    );

    if (validVariants.length === 0) return [];

    const variantArrays = validVariants.map(v => 
      v.options.split(',').map(o => o.trim()).filter(o => o).map(val => ({
        [v.variant_name]: val
      }))
    );

    // Cartesian product
    return variantArrays.reduce((acc, curr) => {
      const result = [];
      acc.forEach(a => {
        curr.forEach(c => {
          result.push({ ...a, ...c });
        });
      });
      return result;
    }, [{}]);
  };

  const updateStock = (combinationKey, value) => {
    setStock({ ...stock, [combinationKey]: value });
  };

  const combinations = getAllCombinations();

  if (!category) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg text-gray-500 text-sm">
        Select a category to configure product variants
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Product Variants</h3>
        <button
          type="button"
          onClick={addVariant}
          className="text-sm text-amazon-orange hover:underline font-medium"
        >
          + Add Variant
        </button>
      </div>

      {loading && (
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amazon-orange"></div>
        </div>
      )}

      {/* Variant Definitions */}
      <div className="space-y-3">
        {variants.map((variant, idx) => (
          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
            <div className="flex gap-3 items-start">
              <div className="flex-1">
                <input
                  type="text"
                  placeholder="Variant name (e.g., Color, Size)"
                  value={variant.variant_name}
                  onChange={(e) => updateVariant(idx, 'variant_name', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm mb-2"
                />
                <input
                  type="text"
                  placeholder="Options (comma-separated: Red, Blue, Black)"
                  value={variant.options}
                  onChange={(e) => updateVariant(idx, 'options', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={variant.is_required}
                    onChange={(e) => updateVariant(idx, 'is_required', e.target.checked)}
                  />
                  Required
                </label>
                <button
                  type="button"
                  onClick={() => removeVariant(idx)}
                  className="text-red-500 hover:text-red-700 text-xs"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {variants.length === 0 && !loading && (
        <p className="text-sm text-gray-400 italic">
          No variants defined. Add variants to track stock per combination.
        </p>
      )}

      {/* Generate Stock Matrix Button */}
      {variants.length > 0 && !showStockMatrix && (
        <button
          type="button"
          onClick={generateStockMatrix}
          className="w-full py-2 bg-blue-50 text-blue-600 rounded-md text-sm font-medium hover:bg-blue-100"
        >
          Generate Stock Matrix
        </button>
      )}

      {/* Stock Matrix */}
      {showStockMatrix && combinations.length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Stock Matrix</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead className="bg-gray-100">
                <tr>
                  {variants.filter(v => v.variant_name.trim()).map((v, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-gray-700">
                      {v.variant_name}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-left font-medium text-gray-700">
                    Stock Quantity
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {combinations.map((combo, idx) => {
                  const comboKey = Object.entries(combo)
                    .map(([k, v]) => `${k}:${v}`)
                    .join('|');
                  
                  return (
                    <tr key={idx} className="hover:bg-gray-50">
                      {Object.entries(combo).map(([key, val], i) => (
                        <td key={i} className="px-3 py-2 text-gray-600">
                          {val}
                        </td>
                      ))}
                      <td className="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          value={stock[comboKey] || ''}
                          onChange={(e) => updateStock(comboKey, e.target.value)}
                          className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                          placeholder="0"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Enter stock quantity for each variant combination. Leave blank for 0.
          </p>
        </div>
      )}

      {showStockMatrix && combinations.length === 0 && (
        <p className="text-sm text-amber-600">
          Please define variant names and options first.
        </p>
      )}
    </div>
  );
}
