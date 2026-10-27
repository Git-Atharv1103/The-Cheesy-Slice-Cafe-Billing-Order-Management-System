import React, { useEffect, useState, useRef } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatINR, formatDateTime } from '../lib/utils';
import { CheckCircle, Printer, Plus, ArrowRight } from 'lucide-react';
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
  const { logoUrl, settings } = useCafe();
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
    return (
      <div className="flex items-center justify-center h-96 bg-white">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const cashPayment = (order.payments || []).filter(p => p.payment_method === 'cash').reduce((s, p) => s + Number(p.amount), 0);
  const onlinePayment = (order.payments || []).filter(p => p.payment_method === 'online' || p.payment_method === 'upi').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="min-h-screen p-4 md:p-6 bg-[#F9FAFB] text-gray-900">
      <div className="max-w-lg mx-auto">
        {/* Success Banner */}
        <div className="text-center mb-6 no-print">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircle size={36} className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-black text-gray-900 tracking-tight">Order Placed & Sent to Kitchen!</h1>
          <p className="text-gray-600 text-sm mt-1">
            Order <strong className="text-amber-600 font-extrabold">#{order.daily_order_number}</strong> confirmed for {order.customer_name}
          </p>
        </div>

        {/* Printable Receipt */}
        <div ref={printRef} className="bg-white text-gray-900 rounded-3xl overflow-hidden shadow-xl border border-gray-200">
          {/* Receipt Header */}
          <div className="bg-white border-b border-gray-200 text-center py-6 px-4">
            <div className="w-14 h-14 rounded-2xl bg-white border border-gray-200 flex items-center justify-center mx-auto mb-3 overflow-hidden p-1 shadow-xs">
              <img
                src={logoUrl}
                alt="The Cheesy Slice"
                className="w-full h-full object-contain"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/logo.png';
                }}
              />
            </div>
            <h2 className="text-xl font-black text-gray-900">{settings.cafe_name || 'The Cheesy Slice'}</h2>
            <p className="text-amber-600 text-xs font-bold mt-0.5">{settings.tagline || 'Loaded with Love & Cheese!'}</p>
            <p className="text-gray-500 text-xs mt-1">{settings.address || 'FC Road, Pune, Maharashtra, India'}</p>
          </div>

          {/* Order Info */}
          <div className="p-5 border-b border-gray-100">
            <div className="grid grid-cols-2 gap-3 text-xs md:text-sm">
              <div>
                <p className="text-gray-500">Order #</p>
                <p className="font-black text-xl text-amber-600">#{order.daily_order_number}</p>
              </div>
              <div>
                <p className="text-gray-500">Date & Time</p>
                <p className="font-semibold text-gray-800 text-xs">{formatDateTime(order.created_at)}</p>
              </div>
              <div>
                <p className="text-gray-500">Customer</p>
                <p className="font-bold text-gray-900">{order.customer_name}</p>
              </div>
              {order.customer_phone && (
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="font-medium text-gray-800">{order.customer_phone}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items */}
          <div className="p-5 border-b border-gray-100">
            <table className="w-full text-xs md:text-sm">
              <thead>
                <tr className="text-gray-500 border-b border-gray-200 text-left">
                  <th className="py-1.5 font-bold">Item</th>
                  <th className="text-center py-1.5 font-bold">Qty</th>
                  <th className="text-right py-1.5 font-bold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(order.items || []).map((item, i) => (
                  <tr key={i}>
                    <td className="py-2.5 text-gray-900 font-semibold">{item.name}</td>
                    <td className="py-2.5 text-center text-gray-600 font-bold">×{item.quantity}</td>
                    <td className="py-2.5 text-right font-black text-gray-900">{formatINR(Number(item.total_price))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="p-5 border-b border-gray-100 text-xs md:text-sm space-y-2">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span className="font-semibold">{formatINR(Number(order.subtotal))}</span>
            </div>
            {Number(order.discount) > 0 && (
              <div className="flex justify-between text-emerald-600 font-semibold">
                <span>Discount</span>
                <span>-{formatINR(Number(order.discount))}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-lg border-t border-gray-200 pt-2 text-gray-900">
              <span>Total Bill</span>
              <span className="text-amber-600 font-black">{formatINR(Number(order.total))}</span>
            </div>
          </div>

          {/* Payment */}
          <div className="p-5 border-b border-gray-100 text-xs md:text-sm">
            <p className="font-extrabold text-gray-900 mb-2">Payment Details</p>
            {cashPayment > 0 && (
              <div className="flex justify-between text-gray-600 py-0.5">
                <span>Cash Paid</span>
                <span className="font-semibold text-emerald-600">{formatINR(cashPayment)}</span>
              </div>
            )}
            {onlinePayment > 0 && (
              <div className="flex justify-between text-gray-600 py-0.5">
                <span>UPI / Online</span>
                <span className="font-semibold text-blue-600">{formatINR(onlinePayment)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold mt-2 border-t border-gray-100 pt-2 text-gray-900">
              <span>Total Paid</span>
              <span className={Number(order.balance_due) > 0 ? 'text-amber-600' : 'text-emerald-600 font-black'}>
                {formatINR(Number(order.total_paid))}
              </span>
            </div>
            {Number(order.balance_due) > 0 && (
              <div className="flex justify-between font-black text-red-600 mt-1">
                <span>Balance Due</span>
                <span>{formatINR(Number(order.balance_due))}</span>
              </div>
            )}
          </div>

          {/* Status & Footer */}
          <div className="p-5 text-center text-xs text-gray-500 bg-gray-50/50">
            <div className={`inline-block px-3.5 py-1 rounded-full font-extrabold text-xs mb-2.5 ${
              order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' :
              order.payment_status === 'partial' ? 'bg-amber-100 text-amber-800' :
              'bg-red-100 text-red-800'
            }`}>
              {order.payment_status === 'paid' ? '✓ FULLY PAID' : order.payment_status === 'partial' ? 'PARTIALLY PAID' : 'PAYMENT PENDING'}
            </div>
            <p className="font-semibold text-gray-700">{settings.receipt_footer || 'Thank you for visiting The Cheesy Slice!'}</p>
            <p className="mt-0.5 text-gray-400">Please collect your order at the counter when ready.</p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 space-y-3 no-print">
          <button
            type="button"
            onClick={handlePrint}
            className="w-full flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-800 font-bold py-3.5 rounded-2xl shadow-xs transition-colors"
          >
            <Printer size={18} />
            <span>Print Receipt</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/new-order')}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-black py-3.5 rounded-2xl shadow-md transition-all active:scale-[0.99]"
          >
            <Plus size={18} />
            <span>Create Another Order</span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="w-full flex items-center justify-center gap-1.5 text-gray-500 hover:text-gray-900 font-bold text-xs py-2 transition-colors"
          >
            <span>View All Orders</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
