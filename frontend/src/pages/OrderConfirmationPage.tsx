import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatINR, formatDateTime } from '../lib/utils';
import { CheckCircle, Printer, ChefHat, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCafe } from '../contexts/CafeContext';

interface OrderItem { name: string; quantity: number; unit_price: number; total_price: number; }
interface Payment { payment_method: string; amount: number; reference: string; created_at: string; }
interface Order {
  id: string; daily_order_number: string; customer_name: string; customer_phone: string;
  order_date: string; created_at: string; subtotal: number; discount: number;
  total: number; total_paid: number; balance_due: number; payment_status: string;
  order_status: string; items: OrderItem[]; payments: Payment[];
  special_instructions: string;
}

export default function OrderConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { logoUrl } = useCafe();
  const [order, setOrder] = useState<Order | null>(location.state?.order || null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!order && id) {
      api.get(`/orders/${id}`).then(res => setOrder(res.data)).catch(() => toast.error('Order not found'));
    }
  }, [id]);

  const handlePrint = () => {
    window.print();
  };

  if (!order) {
    return <div className="flex items-center justify-center h-96">
      <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
    </div>;
  }

  const cashPayment = order.payments.filter(p => p.payment_method === 'cash').reduce((s, p) => s + Number(p.amount), 0);
  const onlinePayment = order.payments.filter(p => p.payment_method === 'online').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-lg mx-auto">
        {/* Success Banner */}
        <div className="text-center mb-8 no-print">
          <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={36} className="text-green-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Order Placed!</h1>
          <p className="text-gray-400 mt-1">Order #{order.daily_order_number} has been confirmed</p>
        </div>

        {/* Receipt */}
        <div ref={printRef} className="bg-white text-black rounded-2xl overflow-hidden shadow-2xl">
          {/* Receipt Header */}
          <div className="bg-[#0a0a0a] text-white text-center py-6 px-4">
            <div className="w-14 h-14 rounded-xl bg-surface border border-gray-800 flex items-center justify-center mx-auto mb-3 overflow-hidden p-1 shadow-lg">
              <img src={logoUrl} alt="The Cheesy Slice" className="w-full h-full object-contain" />
            </div>
            <h2 className="text-xl font-bold">The Cheesy Slice</h2>
            <p className="text-yellow-400 text-sm">Loaded with Love & Cheese!</p>
            <p className="text-gray-400 text-xs mt-1">FC Road, Pune, Maharashtra</p>
          </div>

          {/* Order Info */}
          <div className="p-5 border-b border-gray-200">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500">Order #</p>
                <p className="font-bold text-lg">{order.daily_order_number}</p>
              </div>
              <div>
                <p className="text-gray-500">Date & Time</p>
                <p className="font-medium text-xs">{formatDateTime(order.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-semibold">{order.customer_name}</p>
              </div>
              {order.customer_phone && (
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium">{order.customer_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="p-5 border-b border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-100">
                  <th className="text-left py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Amount</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-800">{item.name}</td>
                    <td className="py-2 text-center text-gray-600">×{item.quantity}</td>
                    <td className="py-2 text-right font-medium">{formatINR(Number(item.total_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-5 border-b border-gray-200 text-sm space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{formatINR(Number(order.subtotal))}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-{formatINR(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-lg border-t border-gray-200 pt-2">
              <span>Total</span><span>{formatINR(Number(order.total))}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="p-5 border-b border-gray-200 text-sm">
            <p className="font-semibold text-gray-700 mb-2">Payment Details</p>
            {cashPayment > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Cash</span><span>{formatINR(cashPayment)}</span>
              </div>
            )}
            {onlinePayment > 0 && (
              <div className="flex justify-between text-gray-600">
                <span>Online/UPI</span><span>{formatINR(onlinePayment)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold mt-2 border-t border-gray-100 pt-2">
              <span>Total Paid</span>
              <span className={Number(order.balance_due) > 0 ? 'text-orange-600' : 'text-green-600'}>
                {formatINR(Number(order.total_paid))}
              </span>
            </div>
            {Number(order.balance_due) > 0 && (
              <div className="flex justify-between font-bold text-red-600 mt-1">
                <span>Balance Due</span><span>{formatINR(Number(order.balance_due))}</span>
              </div>
            )}
          </div>

          {/* Status & Footer */}
          <div className="p-5 text-center text-xs text-gray-500">
            <div className={`inline-block px-3 py-1 rounded-full font-semibold mb-3 ${
              order.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
              order.payment_status === 'partial' ? 'bg-orange-100 text-orange-700' :
              'bg-red-100 text-red-700'
            }`}>
              {order.payment_status === 'paid' ? '✓ PAID' : order.payment_status === 'partial' ? 'PARTIAL PAYMENT' : 'PAYMENT PENDING'}
            </div>
            <p className="font-medium">Thank you for visiting The Cheesy Slice!</p>
            <p className="mt-0.5">FC Road, Pune, Maharashtra, India</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3 no-print">
          <button
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 bg-[#141414] border border-[#2a2a2a] text-white font-semibold py-3 rounded-xl hover:bg-[#1e1e1e] transition-colors"
          >
            <Printer size={18} />
            Print Receipt
          </button>
          <button
            onClick={() => navigate('/new-order')}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            New Order
          </button>
          <button
            onClick={() => navigate('/orders')}
            className="w-full text-gray-400 text-sm hover:text-white py-2 transition-colors"
          >
            View All Orders →
          </button>
        </div>
      </div>
    </div>
  );
}
