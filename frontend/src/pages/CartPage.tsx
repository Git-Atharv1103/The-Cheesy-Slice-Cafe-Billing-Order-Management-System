import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { formatINR } from '../lib/utils';
import { ArrowLeft, Minus, Plus, Trash2, Tag, ShoppingCart, ArrowRight, User } from 'lucide-react';
import toast from 'react-hot-toast';

const QUICK_TABLE_PRESETS = ['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Table 5', 'Takeaway', 'Parcel'];

export default function CartPage() {
  const navigate = useNavigate();
  const {
    items, customerName, customerPhone, discount, specialInstructions,
    updateQuantity, removeItem,
    setCustomerName, setCustomerPhone, setDiscount, setSpecialInstructions,
    subtotal, total, itemCount
  } = useCart();

  const [discountInput, setDiscountInput] = useState(discount > 0 ? String(discount / 100) : '');

  const handleDiscountChange = (val: string) => {
    setDiscountInput(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0) {
      const discountPaise = Math.round(parsed * 100);
      if (discountPaise <= subtotal) {
        setDiscount(discountPaise);
      } else {
        toast.error('Discount cannot exceed subtotal');
      }
    } else if (val === '' || val === '0') {
      setDiscount(0);
    }
  };

  const handleProceed = () => {
    if (!customerName.trim()) {
      toast.error('Please enter a customer name or select a table preset');
      return;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty. Please add menu items.');
      navigate('/new-order');
      return;
    }
    navigate('/payment');
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] text-gray-900">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-xs">
        <div className="flex items-center gap-4 max-w-3xl mx-auto w-full">
          <button
            type="button"
            onClick={() => navigate('/new-order')}
            className="text-gray-500 hover:text-gray-900 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
            title="Back to menu"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Cart & Customer Details</h1>
            <p className="text-gray-500 text-xs">{itemCount} {itemCount === 1 ? 'item' : 'items'} in order</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Customer / Order Details Card */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-gray-900 font-extrabold text-sm flex items-center gap-2">
                <User size={16} className="text-amber-600" />
                <span>Customer / Table Information *</span>
              </h2>
            </div>

            {/* Quick table presets */}
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-hide">
              {QUICK_TABLE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setCustomerName(preset)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors border ${
                    customerName === preset
                      ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-700 font-bold mb-1.5 block">
                  Customer Name or Table Number *
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Table 3, Rahul Sharma, Takeaway Order"
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm shadow-xs transition-colors"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1.5 block">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 text-sm shadow-xs transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1.5 block">Special Instructions (Optional)</label>
                  <input
                    type="text"
                    value={specialInstructions}
                    onChange={e => setSpecialInstructions(e.target.value)}
                    placeholder="e.g. Less spicy, extra cheese on top"
                    className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 text-sm shadow-xs transition-colors"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cart Items Card */}
          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="flex items-center justify-between p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
              <h2 className="text-gray-900 font-extrabold text-sm">Selected Order Items ({itemCount})</h2>
              <button
                type="button"
                onClick={() => navigate('/new-order')}
                className="flex items-center gap-1.5 text-amber-600 hover:text-amber-700 font-bold text-xs bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200 transition-colors"
              >
                <ShoppingCart size={14} />
                <span>+ Add More Items</span>
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <ShoppingCart size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="font-semibold text-gray-700">Your cart is empty</p>
                <button
                  type="button"
                  onClick={() => navigate('/new-order')}
                  className="mt-3 bg-amber-500 text-white font-bold px-4 py-2 rounded-xl text-xs"
                >
                  Go to Menu
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {items.map(item => (
                  <div key={item.menu_item_id} className="flex items-center gap-3 p-4 hover:bg-gray-50/60 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-bold truncate">{item.name}</p>
                      <p className="text-gray-500 text-xs">{formatINR(item.unit_price)} each</p>
                    </div>

                    {/* Qty control */}
                    <div className="flex items-center bg-gray-100 border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                        className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 transition-colors"
                        title="Decrease"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-gray-900 font-black text-xs px-2 min-w-[20px] text-center">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                        className="px-2.5 py-1 text-gray-700 hover:bg-gray-200 transition-colors"
                        title="Increase"
                      >
                        <Plus size={13} />
                      </button>
                    </div>

                    <p className="text-gray-900 font-black text-sm w-20 text-right">{formatINR(item.total_price)}</p>

                    <button
                      type="button"
                      onClick={() => removeItem(item.menu_item_id)}
                      className="text-gray-400 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors ml-1"
                      title="Remove item"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs space-y-4">
            <h2 className="text-gray-900 font-extrabold text-sm">Bill Calculation</h2>

            {/* Discount input */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 min-w-[100px]">
                <Tag size={15} className="text-amber-500" />
                <span>Discount (₹):</span>
              </div>
              <input
                type="number"
                value={discountInput}
                onChange={e => handleDiscountChange(e.target.value)}
                placeholder="0.00"
                min="0"
                step="1"
                className="flex-1 bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 text-sm shadow-xs"
              />
            </div>

            <div className="space-y-2 text-sm pt-2 border-t border-gray-100">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal ({itemCount} items)</span>
                <span className="font-semibold text-gray-800">{formatINR(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-600 font-semibold">
                  <span>Discount</span>
                  <span>- {formatINR(discount)}</span>
                </div>
              )}

              <div className="border-t border-gray-200 pt-3 flex justify-between items-center text-gray-900 font-black text-lg">
                <span>Total Payable</span>
                <span className="text-2xl text-amber-600 font-black">{formatINR(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Proceed Button */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 p-3 md:p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 z-30 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <button
            type="button"
            onClick={handleProceed}
            disabled={items.length === 0}
            className="w-full py-3.5 px-6 rounded-2xl font-black text-sm md:text-base flex items-center justify-between transition-all bg-amber-500 hover:bg-amber-600 text-white shadow-md active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span>Proceed to Payment</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-black">{formatINR(total)}</span>
              <ArrowRight size={18} />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
