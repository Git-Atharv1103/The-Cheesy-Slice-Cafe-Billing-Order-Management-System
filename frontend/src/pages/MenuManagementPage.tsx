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
      toast.success(`${item.name} ${item.is_available ? 'hidden' : 'shown'}`);
      loadMenu();
    } catch {
      toast.error('Failed to update');
    }
  }

  async function handleSaveItem() {
    if (!editingItem) return;
    try {
      await api.put(`/menu/items/${editingItem.id}`, {
        ...editingItem,
        price: editingItem.price / 100,
      });
      toast.success('Item updated!');
      setEditingItem(null);
      loadMenu();
    } catch {
      toast.error('Update failed');
    }
  }

  async function handleAddItem(categoryId: string) {
    if (!newItem.name || !newItem.price) {
      toast.error('Name and price required');
      return;
    }
    try {
      await api.post('/menu/items', {
        category_id: categoryId,
        name: newItem.name,
        description: newItem.description,
        price: parseFloat(newItem.price),
      });
      toast.success('Item added!');
      setAddingItem(null);
      setNewItem({ name: '', price: '', description: '' });
      loadMenu();
    } catch {
      toast.error('Failed to add item');
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Menu Management</h1>
        <p className="text-gray-500 text-sm">Manage items, prices, and availability</p>
      </div>

      <div className="space-y-6">
        {categories.map(cat => (
          <div key={cat.id} className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <h2 className="text-white font-semibold">{cat.name}</h2>
              <button
                onClick={() => { setAddingItem(cat.id); setNewItem({ name: '', price: '', description: '' }); }}
                className="flex items-center gap-1 text-yellow-400 text-sm hover:underline"
              >
                <Plus size={14} /> Add Item
              </button>
            </div>

            {/* Add Item Form */}
            {addingItem === cat.id && (
              <div className="p-4 bg-yellow-400/5 border-b border-[#2a2a2a]">
                <div className="flex gap-3 flex-wrap">
                  <input
                    type="text"
                    value={newItem.name}
                    onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                    placeholder="Item name"
                    className="flex-1 min-w-40 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                  <input
                    type="number"
                    value={newItem.price}
                    onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                    placeholder="Price (₹)"
                    className="w-32 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                  <button onClick={() => handleAddItem(cat.id)} className="bg-green-500 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-green-600">
                    <Check size={16} />
                  </button>
                  <button onClick={() => setAddingItem(null)} className="text-gray-400 px-3 py-2 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Items */}
            <div className="divide-y divide-[#2a2a2a]">
              {cat.items.map(item => (
                <div key={item.id} className={`flex items-center gap-4 p-4 ${!item.is_available ? 'opacity-50' : ''}`}>
                  {editingItem?.id === item.id ? (
                    <>
                      <input
                        type="text"
                        value={editingItem.name}
                        onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="flex-1 bg-[#1e1e1e] border border-yellow-400 rounded px-2 py-1 text-white text-sm"
                      />
                      <input
                        type="number"
                        value={editingItem.price / 100}
                        onChange={e => setEditingItem({ ...editingItem, price: Math.round(parseFloat(e.target.value) * 100) })}
                        className="w-24 bg-[#1e1e1e] border border-yellow-400 rounded px-2 py-1 text-white text-sm"
                      />
                      <button onClick={handleSaveItem} className="text-green-400 hover:text-green-300"><Check size={16} /></button>
                      <button onClick={() => setEditingItem(null)} className="text-red-400 hover:text-red-300"><X size={16} /></button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1">
                        <p className="text-white text-sm font-medium">{item.name}</p>
                        {item.description && <p className="text-gray-500 text-xs">{item.description}</p>}
                      </div>
                      <p className="text-yellow-400 font-semibold text-sm">{formatINR(item.price)}</p>
                      <button onClick={() => setEditingItem({ ...item })} className="text-gray-400 hover:text-white transition-colors">
                        <Edit2 size={15} />
                      </button>
                      <button onClick={() => handleToggleAvailability(item)} className={`transition-colors ${item.is_available ? 'text-green-400 hover:text-red-400' : 'text-gray-600 hover:text-green-400'}`}>
                        {item.is_available ? <Eye size={15} /> : <EyeOff size={15} />}
                      </button>
                    </>
                  )}
                </div>
              ))}
              {cat.items.length === 0 && (
                <p className="text-gray-600 text-sm p-4">No items in this category</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
