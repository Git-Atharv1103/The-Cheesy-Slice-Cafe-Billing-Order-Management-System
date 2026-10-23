import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useRealtime } from '../contexts/RealtimeContext';
import { formatINR, formatDateTime, getISTDate, getPaymentStatusColor, getOrderStatusColor } from '../lib/utils';
import { Search, Filter, Eye, ChevronDown, RefreshCw } from 'lucide-react';
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
    <div className="p-4 md:p-6 pb-24 md:pb-8">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Orders</h1>
          <p className="text-gray-500 text-xs md:text-sm">{orders.length} orders found</p>
        </div>
        <button onClick={() => loadOrders(false)} className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs md:text-sm bg-surface px-3 py-1.5 rounded-lg border border-[#2a2a2a] transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-3 md:p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
          <input
            type="date"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
            className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs md:text-sm focus:outline-none focus:border-yellow-400"
          />
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search order #, customer..."
              className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg pl-9 pr-3 py-2 text-white text-xs md:text-sm focus:outline-none focus:border-yellow-400"
            />
          </div>
          <select
            value={paymentStatus}
            onChange={e => setPaymentStatus(e.target.value)}
            className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs md:text-sm focus:outline-none focus:border-yellow-400"
          >
            <option value="">All Payment Status</option>
            {PAYMENT_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <select
            value={orderStatus}
            onChange={e => setOrderStatus(e.target.value)}
            className="bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-xs md:text-sm focus:outline-none focus:border-yellow-400"
          >
            <option value="">All Order Status</option>
            {ORDER_STATUSES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="flex gap-2 mt-3 items-center">
          <button onClick={() => setDateFilter(getISTDate())} className="text-xs text-yellow-400 hover:underline">Today</button>
          <span className="text-gray-600">|</span>
          <button onClick={() => { const y = new Date(); y.setDate(y.getDate()-1); setDateFilter(y.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})); }} className="text-xs text-yellow-400 hover:underline">Yesterday</button>
          <span className="text-gray-600">|</span>
          <button onClick={() => setDateFilter('')} className="text-xs text-gray-400 hover:text-white">All Dates</button>
        </div>
      </div>

      {/* Orders Content */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-48 bg-[#141414] border border-[#2a2a2a] rounded-xl">
            <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 text-gray-500 bg-[#141414] border border-[#2a2a2a] rounded-xl">
            <Filter size={32} className="mx-auto mb-3 opacity-30" />
            <p>No orders found for the selected filters</p>
          </div>
        ) : (
          <>
            {/* Mobile Card View (< md) */}
            <div className="md:hidden space-y-3">
              {orders.map(order => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 active:border-yellow-400/50 transition-all cursor-pointer shadow-sm"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-yellow-400/10 text-yellow-400 font-bold text-sm px-2.5 py-1 rounded-lg border border-yellow-400/20">
                        #{order.daily_order_number}
                      </span>
                      <div>
                        <p className="text-white font-semibold text-sm leading-tight">{order.customer_name}</p>
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
                  <div className="bg-[#1e1e1e] rounded-lg px-2.5 py-1.5 mb-2.5 text-xs text-gray-300">
                    <p className="truncate">
                      {order.items?.map(i => `${i.name} × ${i.quantity}`).join(', ') || 'No items listed'}
                    </p>
                  </div>

                  {/* Financial Row */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-[#222]">
                    <div className="flex items-center gap-3">
                      <div>
                        <span className="text-gray-500 text-[10px] block">TOTAL</span>
                        <span className="text-white font-bold">{formatINR(Number(order.total))}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 text-[10px] block">PAID</span>
                        <span className="text-green-400 font-semibold">{formatINR(Number(order.total_paid))}</span>
                      </div>
                      {Number(order.balance_due) > 0 && (
                        <div>
                          <span className="text-red-400 text-[10px] block font-medium">DUE</span>
                          <span className="text-red-400 font-bold">{formatINR(Number(order.balance_due))}</span>
                        </div>
                      )}
                    </div>
                    <span className="text-yellow-400 font-medium text-xs flex items-center gap-0.5">
                      View <Eye size={12} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-[#2a2a2a]">
                    <tr className="text-gray-500">
                      <th className="text-left px-4 py-3">#</th>
                      <th className="text-left px-4 py-3">Customer</th>
                      <th className="text-left px-4 py-3">Date & Time</th>
                      <th className="text-left px-4 py-3">Items</th>
                      <th className="text-right px-4 py-3">Total</th>
                      <th className="text-right px-4 py-3">Paid</th>
                      <th className="text-right px-4 py-3">Balance</th>
                      <th className="text-center px-4 py-3">Payment</th>
                      <th className="text-center px-4 py-3">Status</th>
                      <th className="text-center px-4 py-3">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2a2a2a]">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-white/3 transition-colors">
                        <td className="px-4 py-3">
                          <span className="bg-yellow-400/10 text-yellow-400 font-bold text-xs px-2 py-1 rounded">
                            #{order.daily_order_number}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-white font-medium">{order.customer_name}</p>
                          {order.customer_phone && <p className="text-gray-500 text-xs">{order.customer_phone}</p>}
                        </td>
                        <td className="px-4 py-3 text-gray-400 text-xs">
                          {formatDateTime(order.created_at)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 max-w-xs">
                          <p className="truncate text-xs">
                            {order.items?.slice(0, 2).map(i => `${i.name}×${i.quantity}`).join(', ')}
                            {order.items?.length > 2 && ` +${order.items.length - 2} more`}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-right text-white font-semibold">{formatINR(Number(order.total))}</td>
                        <td className="px-4 py-3 text-right text-green-400">{formatINR(Number(order.total_paid))}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={Number(order.balance_due) > 0 ? 'text-red-400' : 'text-gray-500'}>
                            {formatINR(Number(order.balance_due))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                            {order.payment_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getOrderStatusColor(order.order_status)}`}>
                            {order.order_status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors mx-auto text-xs"
                          >
                            <Eye size={14} /> View
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
