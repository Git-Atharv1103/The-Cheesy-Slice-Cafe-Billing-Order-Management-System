import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, Plus, Minus, Filter, ArrowRight } from 'lucide-react';
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

// In-memory cache for menu data so subsequent visits are instant (0ms)
let cachedMenuCategories: Category[] | null = null;

export default function NewOrderPage() {
  const navigate = useNavigate();
  const { items: cartItems, addItem, updateQuantity, itemCount, subtotal } = useCart();
  const [categories, setCategories] = useState<Category[]>(cachedMenuCategories || []);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(!cachedMenuCategories);
  const lastAddTimestamp = useRef<Record<string, number>>({});

  useEffect(() => {
    loadMenu();
  }, []);

  async function loadMenu() {
    try {
      const res = await api.get('/menu');
      cachedMenuCategories = res.data;
      setCategories(res.data);
    } catch (err) {
      if (!cachedMenuCategories) {
        toast.error('Failed to load menu. Please refresh.');
      }
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
    // Fast double-click throttle: ignore rapid taps within 150ms on the exact same item
    const now = Date.now();
    if (now - (lastAddTimestamp.current[item.id] || 0) < 150) {
      return;
    }
    lastAddTimestamp.current[item.id] = now;

    addItem({
      menu_item_id: item.id,
      name: item.name,
      category_name: item.category_name,
      unit_price: item.price,
    });
  }

  const handleNext = () => {
    if (cartItems.length === 0) {
      toast.error('Please add at least one item to your cart before proceeding.');
      return;
    }
    navigate('/cart');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 bg-white">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB]">
      {/* Sticky Top Header */}
      <div className="p-4 md:p-6 pb-4 border-b border-gray-200 bg-white sticky top-0 z-20 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Quick Add / Menu</h1>
            <p className="text-gray-500 text-xs">Tap items to add directly to order</p>
          </div>
          {itemCount > 0 && (
            <div className="text-right">
              <span className="text-xs text-gray-500 font-semibold">{itemCount} items</span>
              <p className="text-amber-600 font-black text-base">{formatINR(subtotal)}</p>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search pizza, sandwich, coffee, pasta..."
            className="w-full bg-white border border-gray-300 rounded-xl pl-10 pr-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm shadow-xs transition-colors"
          />
        </div>

        {/* Category tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setActiveCategory('all')}
            className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold transition-all ${
              activeCategory === 'all'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
            }`}
          >
            All Items
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs md:text-sm font-bold transition-all ${
                activeCategory === cat.id
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'bg-white border border-gray-200 text-gray-600 hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Menu Grid */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28">
        {filteredItems.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white rounded-2xl border border-gray-200 p-8 shadow-xs">
            <Filter size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-semibold text-gray-700">No items match your search</p>
            <p className="text-xs text-gray-400 mt-1">Try another category or search term</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            {filteredItems.map(item => {
              const qty = getCartQty(item.id);
              return (
                <div
                  key={item.id}
                  className={`bg-white border rounded-2xl p-4 transition-all shadow-xs flex flex-col justify-between ${
                    qty > 0
                      ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20'
                      : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <div>
                    {/* Category badge */}
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-100/60 px-2 py-0.5 rounded-md">
                      {item.category_name}
                    </span>
                    <p className="text-gray-900 font-bold text-sm mt-2 leading-snug">{item.name}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
                    <p className="text-amber-600 font-black text-base">{formatINR(item.price)}</p>

                    {/* Add / Qty Control */}
                    <div className="flex-shrink-0">
                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => handleAdd(item)}
                          className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold px-3 py-1.5 rounded-xl transition-all text-xs shadow-xs"
                        >
                          <Plus size={14} />
                          <span>Add</span>
                        </button>
                      ) : (
                        <div className="flex items-center bg-gray-100 border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, qty - 1)}
                            className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 transition-colors"
                            title="Decrease"
                          >
                            <Minus size={13} />
                          </button>
                          <span className="text-gray-900 font-black text-xs px-2 min-w-[20px] text-center">{qty}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, qty + 1)}
                            className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 transition-colors"
                            title="Increase"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sticky Bottom Next Button */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 p-3 md:p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 z-30 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <button
            type="button"
            onClick={handleNext}
            className={`w-full py-3.5 px-6 rounded-2xl font-black text-sm md:text-base flex items-center justify-between transition-all shadow-md ${
              itemCount > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-[0.99]'
                : 'bg-gray-100 text-gray-400 border border-gray-200 cursor-not-allowed'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`rounded-xl px-2.5 py-1 text-xs font-black ${itemCount > 0 ? 'bg-black/20 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {itemCount} {itemCount === 1 ? 'item' : 'items'}
              </span>
              <span className="flex items-center gap-1.5">
                <ShoppingCart size={18} />
                <span>Next: Review Cart</span>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-base font-black">{formatINR(subtotal)}</span>
              <ArrowRight size={18} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
