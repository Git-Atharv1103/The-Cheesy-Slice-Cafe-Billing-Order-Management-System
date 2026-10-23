import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus, Minus, X, Filter } from 'lucide-react';
import api from '../lib/api';
import { useCart } from '../contexts/CartContext';
import { formatINR } from '../lib/utils';
import toast from 'react-hot-toast';

interface MenuItem {
  id: string;
  category_id: string;
  name: string;
  price: number;
  is_available: number;
}

interface Category {
  id: string;
  name: string;
  items: MenuItem[];
}

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { items: cartItems, addItem, updateQuantity, removeItem, itemCount, subtotal } = useCart();
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMenu();
  }, []);

  async function loadMenu() {
    try {
      const res = await api.get('/menu');
      setCategories(res.data);
    } catch (err) {
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  }

  const allItems = useMemo(() =>
    categories.flatMap(cat =>
      cat.items.map(item => ({ ...item, category_name: cat.name }))
    ), [categories]);

  const filteredItems = useMemo(() => {
    let items = activeCategory === 'all' ? allItems : allItems.filter(i => i.category_id === activeCategory);
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.category_name.toLowerCase().includes(q));
    }
    return items;
  }, [allItems, activeCategory, search]);

  function getCartQty(itemId: string) {
    return cartItems.find(i => i.menu_item_id === itemId)?.quantity || 0;
  }

  function handleAdd(item: MenuItem & { category_name: string }) {
    addItem({
      menu_item_id: item.id,
      name: item.name,
      category_name: item.category_name,
      unit_price: item.price,
    });
  }

  const handleContinue = () => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one item to the cart');
      return;
    }
    navigate('/cart');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 pb-4 border-b border-[#2a2a2a] bg-[#0a0a0a] sticky top-0 z-10">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">New Order</h1>
            <p className="text-gray-500 text-sm">Select items from the menu</p>
          </div>
          {itemCount > 0 && (
            <div className="text-right">
              <p className="text-gray-400 text-sm">{itemCount} items</p>
              <p className="text-yellow-400 font-bold">{formatINR(subtotal)}</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search menu items..."
            className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-9 pr-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 text-sm"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === 'all' ? 'bg-yellow-400 text-black' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'}`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${activeCategory === cat.id ? 'bg-yellow-400 text-black' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <Filter size={32} className="mx-auto mb-3 opacity-30" />
            <p>No items found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredItems.map(item => {
              const qty = getCartQty(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-[#141414] border rounded-xl p-4 transition-all ${qty > 0 ? 'border-yellow-400/40 bg-yellow-400/5' : 'border-[#2a2a2a] hover:border-[#3a3a3a]'}`}
                >
                  {/* Category badge */}
                  <span className="text-xs text-gray-500 font-medium">{item.category_name}</span>
                  <p className="text-white font-semibold text-sm mt-1 leading-tight">{item.name}</p>
                  <p className="text-yellow-400 font-bold text-base mt-2">{formatINR(item.price)}</p>

                  {/* Add/Qty control */}
                  <div className="mt-3">
                    {qty === 0 ? (
                      <button
                        onClick={() => handleAdd(item)}
                        className="w-full flex items-center justify-center gap-1 bg-yellow-400 text-black font-bold py-1.5 rounded-lg hover:bg-yellow-300 transition-colors text-sm"
                      >
                        <Plus size={15} />
                        Add
                      </button>
                    ) : (
                      <div className="flex items-center justify-between bg-[#1e1e1e] rounded-lg overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.id, qty - 1)}
                          className="px-3 py-1.5 text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                        >
                          <Minus size={15} />
                        </button>
                        <span className="text-white font-bold text-sm">{qty}</span>
                        <button
                          onClick={() => updateQuantity(item.id, qty + 1)}
                          className="px-3 py-1.5 text-yellow-400 hover:bg-yellow-400/10 transition-colors"
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bottom Cart Button */}
      {itemCount > 0 && (
        <div className="p-4 border-t border-[#2a2a2a] bg-[#0a0a0a]">
          <button
            onClick={handleContinue}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-4 rounded-xl flex items-center justify-between px-6 hover:opacity-90 transition-opacity"
          >
            <span className="bg-black/20 rounded-lg px-2.5 py-1 text-sm">{itemCount} items</span>
            <span className="flex items-center gap-2">
              <ShoppingCart size={18} />
              View Cart & Continue
            </span>
            <span>{formatINR(subtotal)}</span>
          </button>
        </div>
      )}
    </div>
  );
}
