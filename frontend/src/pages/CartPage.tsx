import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { formatINR } from '../lib/utils';
import { ArrowLeft, Minus, Plus, Trash2, Tag, ShoppingCart } from 'lucide-react';
import toast from 'react-hot-toast';

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
      toast.error('Please enter customer/order name');
      return;
    }
    if (items.length === 0) {
      toast.error('Cart is empty');
      return;
    }
    navigate('/payment');
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="p-6 border-b border-[#2a2a2a] bg-[#0a0a0a] sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/new-order')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-white">Cart & Order Details</h1>
            <p className="text-gray-500 text-sm">{itemCount} items selected</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Customer Details */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Customer / Order Details</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Order Name / Customer Name *</label>
                <input
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Table 5, Rahul, Delivery Order"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Phone (Optional)</label>
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="+91 XXXXX XXXXX"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 transition-colors text-sm"
                />
              </div>
              <div>
                <label className="text-sm text-gray-400 mb-1.5 block">Special Instructions (Optional)</label>
                <textarea
                  value={specialInstructions}
                  onChange={e => setSpecialInstructions(e.target.value)}
                  placeholder="Any special requests..."
                  rows={2}
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 transition-colors text-sm resize-none"
                />
              </div>
            </div>
          </div>

          {/* Cart Items */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-[#2a2a2a]">
              <h2 className="text-white font-semibold">Order Items</h2>
              <button
                onClick={() => navigate('/new-order')}
                className="flex items-center gap-1 text-yellow-400 text-sm hover:underline"
              >
                <ShoppingCart size={14} />
                Add more
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-8 text-center text-gray-500">Cart is empty</div>
            ) : (
              <div className="divide-y divide-[#2a2a2a]">
                {items.map(item => (
                  <div key={item.menu_item_id} className="flex items-center gap-4 p-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      <p className="text-gray-500 text-xs">{formatINR(item.unit_price)} each</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity - 1)}
                        className="w-7 h-7 rounded-md bg-[#2a2a2a] text-white flex items-center justify-center hover:bg-[#3a3a3a] transition-colors"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-white font-medium w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.menu_item_id, item.quantity + 1)}
                        className="w-7 h-7 rounded-md bg-[#2a2a2a] text-white flex items-center justify-center hover:bg-[#3a3a3a] transition-colors"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <p className="text-yellow-400 font-semibold text-sm w-20 text-right">{formatINR(item.total_price)}</p>
                    <button
                      onClick={() => removeItem(item.menu_item_id)}
                      className="text-red-400 hover:text-red-300 transition-colors ml-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bill Summary */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Bill Summary</h2>

            {/* Discount */}
            <div className="flex items-center gap-3 mb-4">
              <Tag size={16} className="text-yellow-400" />
              <input
                type="number"
                value={discountInput}
                onChange={e => handleDiscountChange(e.target.value)}
                placeholder="Discount amount (₹)"
                min="0"
                step="0.01"
                className="flex-1 bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 text-sm"
              />
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal ({itemCount} items)</span>
                <span>{formatINR(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div className="flex justify-between text-green-400">
                  <span>Discount</span>
                  <span>- {formatINR(discount)}</span>
                </div>
              )}
              <div className="border-t border-[#2a2a2a] pt-3 flex justify-between text-white font-bold text-lg">
                <span>Total Payable</span>
                <span className="text-yellow-400">{formatINR(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="p-4 border-t border-[#2a2a2a] bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto">
          <button
            onClick={handleProceed}
            className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-4 rounded-xl flex items-center justify-between px-6 hover:opacity-90 transition-opacity"
          >
            <span>Proceed to Payment</span>
            <span className="text-lg">{formatINR(total)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
