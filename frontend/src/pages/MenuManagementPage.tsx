import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatINR } from '../lib/utils';
import { Plus, Edit2, Check, X, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

interface MenuItem {
  id: string; category_id: string; name: string; description: string;
  price: number; is_available: number; display_order: number;
}
interface Category {
  id: string; name: string; display_order: number; is_active: number;
  items: MenuItem[];
}

export default function MenuManagementPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [addingItem, setAddingItem] = useState<string | null>(null); // category_id
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '' });

  useEffect(() => { loadMenu(); }, []);

  async function loadMenu() {
    try {
      const res = await api.get('/menu/all');
      setCategories(res.data);
    } catch (err) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleAvailability(item: MenuItem) {
    try {
      await api.put(`/menu/items/${item.id}`, {
        ...item,
        price: item.price / 100,
        is_available: item.is_available ? 0 : 1,
      });
      toast.success(`${item.name} ${item.is_available ? 'hidden from cashier menu' : 'made available'}`);
      loadMenu();
    } catch {
      toast.error('Failed to update item availability');
    }
  }

  async function handleSaveItem() {
    if (!editingItem) return;
    try {
      await api.put(`/menu/items/${editingItem.id}`, {
        ...editingItem,
        price: editingItem.price / 100,
      });
      toast.success('Item updated successfully!');
      setEditingItem(null);
      loadMenu();
    } catch {
      toast.error('Update failed');
    }
  }

  async function handleAddItem(categoryId: string) {
    if (!newItem.name || !newItem.price) {
      toast.error('Item name and price are required');
      return;
    }
    try {
      await api.post('/menu/items', {
        category_id: categoryId,
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        price: parseFloat(newItem.price),
      });
      toast.success('New menu item added!');
      setAddingItem(null);
      setNewItem({ name: '', price: '', description: '' });
      loadMenu();
    } catch {
      toast.error('Failed to add menu item');
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96 bg-white">
      <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-[#F9FAFB] text-gray-900 min-h-screen">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Menu Management</h1>
          <p className="text-gray-500 text-sm">Configure menu categories, item prices, and live availability</p>
        </div>

        <div className="space-y-6">
          {categories.map(cat => (
            <div key={cat.id} className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
                <div className="flex items-center gap-2">
                  <h2 className="text-gray-900 font-extrabold text-base">{cat.name}</h2>
                  <span className="text-xs text-gray-500 bg-gray-200/60 px-2 py-0.5 rounded-full font-bold">
                    {cat.items.length} items
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => { setAddingItem(cat.id); setNewItem({ name: '', price: '', description: '' }); }}
                  className="flex items-center gap-1.5 text-amber-700 hover:text-amber-800 text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 px-3 py-1.5 rounded-xl transition-colors"
                >
                  <Plus size={14} />
                  <span>Add Item</span>
                </button>
              </div>

              {/* Add Item Form */}
              {addingItem === cat.id && (
                <div className="p-4 bg-amber-50/40 border-b border-gray-200">
                  <p className="text-xs font-bold text-gray-700 mb-2">New Item in {cat.name}</p>
                  <div className="flex gap-2.5 flex-wrap">
                    <input
                      type="text"
                      value={newItem.name}
                      onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                      placeholder="Item name (e.g. Cheese Burst Pizza)"
                      className="flex-1 min-w-44 bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                    <input
                      type="number"
                      value={newItem.price}
                      onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                      placeholder="Price in ₹"
                      className="w-28 bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-amber-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddItem(cat.id)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs"
                    >
                      <Check size={14} />
                      <span>Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddingItem(null)}
                      className="text-gray-500 px-2 py-2 hover:text-gray-800 text-xs font-semibold"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* Items List */}
              <div className="divide-y divide-gray-100">
                {cat.items.map(item => (
                  <div key={item.id} className={`flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors ${!item.is_available ? 'opacity-50 bg-gray-50/80' : ''}`}>
                    {editingItem?.id === item.id ? (
                      <>
                        <input
                          type="text"
                          value={editingItem.name}
                          onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                          className="flex-1 bg-white border border-amber-500 rounded-xl px-3 py-1.5 text-gray-900 text-sm shadow-xs"
                        />
                        <input
                          type="number"
                          value={editingItem.price / 100}
                          onChange={e => setEditingItem({ ...editingItem, price: Math.round(parseFloat(e.target.value) * 100) })}
                          className="w-24 bg-white border border-amber-500 rounded-xl px-3 py-1.5 text-gray-900 text-sm shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={handleSaveItem}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white p-2 rounded-xl"
                          title="Save changes"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingItem(null)}
                          className="text-red-500 hover:text-red-700 p-2"
                          title="Cancel"
                        >
                          <X size={14} />
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 text-sm font-bold truncate">{item.name}</p>
                          {item.description && <p className="text-gray-500 text-xs mt-0.5">{item.description}</p>}
                        </div>
                        <p className="text-amber-700 font-black text-sm">{formatINR(item.price)}</p>
                        <button
                          type="button"
                          onClick={() => setEditingItem({ ...item })}
                          className="text-gray-400 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                          title="Edit price or name"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleAvailability(item)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            item.is_available
                              ? 'text-emerald-600 hover:text-red-600 hover:bg-red-50'
                              : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={item.is_available ? 'Item is live (click to hide)' : 'Item is hidden (click to make live)'}
                        >
                          {item.is_available ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </>
                    )}
                  </div>
                ))}
                {cat.items.length === 0 && (
                  <p className="text-gray-400 text-xs p-5 text-center">No items in this category yet</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
