import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useRealtime } from '../contexts/RealtimeContext';
import { formatINR, formatDateTime, getISTDate, getPaymentStatusColor, getOrderStatusColor } from '../lib/utils';
import { Search, Filter, Eye, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

interface Order {
  id: string; daily_order_number: string; customer_name: string; customer_phone: string;
  order_date: string; created_at: string; total: number; total_paid: number; balance_due: number;
  payment_status: string; order_status: string; items: { name: string; quantity: number }[];
}

const PAYMENT_STATUSES = ['', 'pending', 'partial', 'paid'];
const ORDER_STATUSES = ['', 'new', 'preparing', 'ready', 'completed', 'cancelled'];

export default function OrdersPage() {
  const navigate = useNavigate();
  const { lastEventTime } = useRealtime();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFilter, setDateFilter] = useState(getISTDate());
  const [paymentStatus, setPaymentStatus] = useState('');
  const [orderStatus, setOrderStatus] = useState('');
  const isFirstLoad = useRef(true);

  // 300ms debounce to prevent API thrashing while cashier types
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  const loadOrders = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFilter) params.set('date', dateFilter);
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (paymentStatus) params.set('payment_status', paymentStatus);
      if (orderStatus) params.set('order_status', orderStatus);
      params.set('limit', '200');

      const res = await api.get(`/orders?${params.toString()}`);
      setOrders(res.data);
    } catch (err) {
      if (!silent) toast.error('Failed to load orders');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [dateFilter, debouncedSearch, paymentStatus, orderStatus]);

  // Initial and filter changes
  useEffect(() => {
    loadOrders(false);
  }, [loadOrders]);

  // Background real-time update without screen-flashing spinner
  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    loadOrders(true);
  }, [lastEventTime, loadOrders]);

  return (
    <div className="p-4 md:p-6 pb-24 md:pb-8 bg-[#F9FAFB] text-gray-900 min-h-screen">
      <div className="flex items-center justify-between mb-4 md:mb-6 max-w-7xl mx-auto">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Orders History</h1>
          <p className="text-gray-500 text-xs md:text-sm">{orders.length} {orders.length === 1 ? 'order' : 'orders'} found</p>
        </div>
        <button
          type="button"
          onClick={() => loadOrders(false)}
          className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900 text-xs md:text-sm bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs hover:bg-gray-50 transition-colors font-semibold"
        >
          <RefreshCw size={14} className="text-amber-600" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters Card */}
      <div className="max-w-7xl mx-auto bg-white border border-gray-200 rounded-2xl p-4 mb-5 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs md:text-sm focus:outline-none focus:border-amber-500 shadow-xs"
          />
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search order #, customer..."
              className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-gray-900 text-xs md:text-sm focus:outline-none focus:border-amber-500 shadow-xs"
            />
          </div>
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs md:text-sm focus:outline-none focus:border-amber-500 shadow-xs"
          >
            <option value="">All Payment Statuses</option>
            {PAYMENT_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
          <select
            value={orderStatus}
            onChange={e => setOrderStatus(e.target.value)}
            className="bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs md:text-sm focus:outline-none focus:border-amber-500 shadow-xs"
          >
            <option value="">All Kitchen Statuses</option>
            {ORDER_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-3 items-center text-xs font-semibold">
          <button type="button" onClick={() => setDateFilter(getISTDate())} className="text-amber-700 hover:underline">Today</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => { const y = new Date(); y.setDate(y.getDate()-1); setDateFilter(y.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})); }} className="text-amber-700 hover:underline">Yesterday</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => setDateFilter('')} className="text-gray-500 hover:text-gray-800">All Dates</button>
        </div>
      </div>

      {/* Orders Content */}
      <div className="max-w-7xl mx-auto space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 bg-white border border-gray-200 rounded-2xl shadow-xs">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-white border border-gray-200 rounded-2xl p-6 shadow-xs">
            <Filter size={32} className="mx-auto mb-3 text-gray-300" />
            <p className="font-bold text-gray-700">No orders found</p>
            <p className="text-xs text-gray-400 mt-1">Try clearing filters or search query</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="md:hidden space-y-3">
              {orders.map(order => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs hover:border-gray-300 transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-amber-100 text-amber-900 font-black text-sm px-2.5 py-1 rounded-xl border border-amber-200">
                        #{order.daily_order_number}
                      </span>
                      <div>
                        <p className="text-gray-900 font-extrabold text-sm leading-tight">{order.customer_name}</p>
                        <p className="text-gray-500 text-[11px]">{formatDateTime(order.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${getOrderStatusColor(order.order_status)}`}>
                        {order.order_status}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${getPaymentStatusColor(order.payment_status)}`}>
                        {order.payment_status}
                      </span>
                    </div>
                  </div>

                  {/* Items summary */}
                  <div className="bg-gray-50 rounded-xl px-3 py-2 mb-2.5 text-xs text-gray-700 border border-gray-100">
                    <p className="truncate font-medium">
                      {order.items?.map(i => `${i.name} × ${i.quantity}`).join(', ') || 'No items listed'}
                    </p>
                  </div>

                  {/* Financial Row */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-gray-500 text-[10px] block font-semibold">TOTAL</span>
                        <span className="text-gray-900 font-black">{formatINR(Number(order.total))}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block font-semibold">PAID</span>
                        <span className="text-emerald-600 font-bold">{formatINR(Number(order.total_paid))}</span>
                      </div>
                      {Number(order.balance_due) > 0 && (
                        <div>
                          <span className="text-red-500 text-[10px] block font-semibold">DUE</span>
                          <span className="text-red-600 font-black">{formatINR(Number(order.balance_due))}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-amber-700 font-bold text-xs flex items-center gap-0.5">
                      Details <Eye size={13} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-200 bg-gray-50/70">
                    <tr className="text-gray-600 text-xs uppercase tracking-wider font-bold">
                      <th className="text-left px-4 py-3.5">#</th>
                      <th className="text-left px-4 py-3.5">Customer</th>
                      <th className="text-left px-4 py-3.5">Date & Time</th>
                      <th className="text-left px-4 py-3.5">Items</th>
                      <th className="text-right px-4 py-3.5">Total</th>
                      <th className="text-right px-4 py-3.5">Paid</th>
                      <th className="text-right px-4 py-3.5">Balance</th>
                      <th className="text-center px-4 py-3.5">Payment</th>
                      <th className="text-center px-4 py-3.5">Status</th>
                      <th className="text-center px-4 py-3.5">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-amber-50/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className="bg-amber-100 text-amber-900 font-black text-xs px-2.5 py-1 rounded-lg border border-amber-200">
                            #{order.daily_order_number}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="text-gray-900 font-bold">{order.customer_name}</p>
                          {order.customer_phone && <p className="text-gray-500 text-xs">{order.customer_phone}</p>}
                        </td>
                        <td className="px-4 py-3.5 text-gray-500 text-xs font-medium">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 max-w-xs">
                          <p className="truncate text-xs font-medium">
                            {order.items?.slice(0, 2).map(i => `${i.name} × ${i.quantity}`).join(', ')}
                            {order.items?.length > 2 && ` +${order.items.length - 2} more`}
                          </p>
                        </td>
                        <td className="px-4 py-3.5 text-right text-gray-900 font-black">{formatINR(Number(order.total))}</td>
                        <td className="px-4 py-3.5 text-right text-emerald-600 font-bold">{formatINR(Number(order.total_paid))}</td>
                        <td className="px-4 py-3.5 text-right">
                          <span className={Number(order.balance_due) > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}>
                            {formatINR(Number(order.balance_due))}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getPaymentStatusColor(order.payment_status)}`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${getOrderStatusColor(order.order_status)}`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="flex items-center gap-1 text-amber-700 hover:text-amber-800 font-bold transition-colors mx-auto text-xs bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg border border-amber-200"
                          >
                            <Eye size={14} />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
