import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../lib/api';
import { useRealtime } from '../contexts/RealtimeContext';
import { formatTimeOnly, getElapsedMinutes } from '../lib/utils';
import { 
  ChefHat, Clock, CheckCircle2, CheckSquare, Square, Play, Bell, 
  Volume2, VolumeX, RefreshCw, AlertCircle, ShoppingBag, 
  Check, ArrowRight, Sparkles 
} from 'lucide-react';
import toast from 'react-hot-toast';

export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface KitchenOrderItem {
  id: string;
  order_id: string;
  name: string;
  quantity: number;
  category_name?: string;
  unit_price?: number;
  status: ItemStatus;
  ready_at?: string | null;
  served_at?: string | null;
}

export interface KitchenOrder {
  id: string;
  daily_order_number: string;
  customer_name: string;
  customer_phone?: string;
  special_instructions?: string;
  order_status: 'new' | 'preparing' | 'ready' | 'completed' | 'cancelled';
  payment_status: string;
  total: number;
  created_at: string;
  items: KitchenOrderItem[];
}

type TabFilter = 'all_active' | 'new' | 'in_progress' | 'partially_ready' | 'ready' | 'completed';

export default function KitchenPage() {
  const { 
    lastEventTime, 
    audioEnabled, 
    setAudioEnabled, 
    playChime,
    audioBlocked,
    unlockAudio,
    testChime 
  } = useRealtime();
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('all_active');
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const loadKitchenOrders = useCallback(async () => {
    try {
      const res = await api.get('/orders?limit=150');
      setOrders(res.data);
    } catch (err) {
      console.error('Failed to load kitchen orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadKitchenOrders();
  }, [loadKitchenOrders, lastEventTime]);

  // Update an individual item's status
  const handleUpdateItemStatus = async (orderId: string, itemId: string, newStatus: ItemStatus) => {
    setUpdatingItemId(itemId);

    // Optimistic UI update
    setOrders(prevOrders => prevOrders.map(order => {
      if (order.id !== orderId) return order;
      const updatedItems = order.items.map(item => {
        if (item.id !== itemId) return item;
        return {
          ...item,
          status: newStatus,
          ready_at: newStatus === 'ready' ? new Date().toISOString() : item.ready_at,
          served_at: newStatus === 'served' ? new Date().toISOString() : item.served_at,
        };
      });

      // Optimistically calculate overall order status
      const total = updatedItems.length;
      const readyOrServed = updatedItems.filter(i => i.status === 'ready' || i.status === 'served').length;
      const served = updatedItems.filter(i => i.status === 'served').length;
      const pending = updatedItems.filter(i => i.status === 'pending').length;

      let calcStatus: 'new' | 'preparing' | 'ready' | 'completed' = 'preparing';
      if (served === total) calcStatus = 'completed';
      else if (readyOrServed === total) calcStatus = 'ready';
      else if (pending === total) calcStatus = 'new';
      else calcStatus = 'preparing';

      return {
        ...order,
        order_status: calcStatus,
        items: updatedItems,
      };
    }));

    try {
      const res = await api.patch(`/orders/${orderId}/items/${itemId}/status`, { status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      
      if (newStatus === 'ready') {
        const itemObj = res.data.items?.find((i: KitchenOrderItem) => i.id === itemId);
        if (res.data.order_status === 'ready') {
          toast.success(`🎉 Order #${res.data.daily_order_number}: All items ready! Cashier notified.`);
        } else {
          toast.success(`✓ ${itemObj?.name || 'Item'} marked Ready`);
        }
      } else if (newStatus === 'served') {
        toast.success(`Handed over / Served!`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Failed to update item status');
      loadKitchenOrders(); // Revert on failure
    } finally {
      setUpdatingItemId(null);
    }
  };

  // Update entire order status (e.g. Handover/Complete)
  const handleUpdateOrderStatus = async (orderId: string, newStatus: 'preparing' | 'ready' | 'completed') => {
    setUpdatingOrderId(orderId);
    try {
      const res = await api.patch(`/orders/${orderId}/status`, { order_status: newStatus });
      setOrders(prev => prev.map(o => o.id === orderId ? res.data : o));
      toast.success(
        newStatus === 'ready'
          ? 'All items marked Ready! Cashier notified.'
          : newStatus === 'completed'
          ? 'Order handed over & completed!'
          : 'Order is now in progress'
      );
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Failed to update order');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  // Filter orders based on active tab
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      if (o.order_status === 'cancelled') return false;

      const items = o.items || [];
      const total = items.length;
      const readyOrServed = items.filter(i => i.status === 'ready' || i.status === 'served').length;
      const isPartiallyReady = readyOrServed > 0 && readyOrServed < total;

      if (activeTab === 'all_active') {
        return o.order_status === 'new' || o.order_status === 'preparing' || o.order_status === 'ready';
      }
      if (activeTab === 'new') {
        return o.order_status === 'new';
      }
      if (activeTab === 'in_progress') {
        return o.order_status === 'preparing' && !isPartiallyReady;
      }
      if (activeTab === 'partially_ready') {
        return isPartiallyReady && o.order_status !== 'completed';
      }
      if (activeTab === 'ready') {
        return o.order_status === 'ready';
      }
      if (activeTab === 'completed') {
        return o.order_status === 'completed';
      }
      return true;
    });
  }, [orders, activeTab]);

  // Tab counts
  const counts = useMemo(() => {
    const active = orders.filter(o => ['new', 'preparing', 'ready'].includes(o.order_status));
    const newOrders = orders.filter(o => o.order_status === 'new');
    const partiallyReady = orders.filter(o => {
      if (o.order_status === 'completed' || o.order_status === 'cancelled') return false;
      const items = o.items || [];
      const readyOrServed = items.filter(i => i.status === 'ready' || i.status === 'served').length;
      return readyOrServed > 0 && readyOrServed < items.length;
    });
    const ready = orders.filter(o => o.order_status === 'ready');
    const inProgress = orders.filter(o => o.order_status === 'preparing' && !partiallyReady.includes(o));
    const completed = orders.filter(o => o.order_status === 'completed');

    return {
      all_active: active.length,
      new: newOrders.length,
      in_progress: inProgress.length,
      partially_ready: partiallyReady.length,
      ready: ready.length,
      completed: completed.length,
    };
  }, [orders]);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 bg-[#F9FAFB] min-h-screen text-gray-900">
      {/* Kitchen Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-gray-200 p-4 rounded-2xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold flex-shrink-0">
            <ChefHat size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-gray-900 tracking-wide">Kitchen Display (KDS)</h1>
              {counts.new > 0 && (
                <span className="bg-red-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full animate-pulse shadow-xs">
                  {counts.new} NEW
                </span>
              )}
            </div>
            <p className="text-gray-500 text-xs">Live orders • Item-level ready tick boxes • Multi-device auto sync</p>
          </div>
        </div>

        {/* Audio Toggle, Test Sound & Refresh */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testChime}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-all shadow-xs"
            title="Test sound notification chime"
          >
            <Bell size={14} className="text-amber-600" />
            <span>Test Sound</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playChime('new');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shadow-xs ${
              audioEnabled
                ? 'bg-amber-100 text-amber-900 border-amber-300'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
            title="Toggle audio alert chime on incoming orders"
          >
            {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>Sound {audioEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            type="button"
            onClick={loadKitchenOrders}
            className="p-2 rounded-xl bg-white hover:bg-gray-100 text-gray-600 hover:text-gray-900 border border-gray-200 transition-colors shadow-xs"
            title="Refresh order tickets"
          >
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Audio Autoplay Unblock Banner */}
      {audioBlocked && (
        <div
          onClick={unlockAudio}
          className="cursor-pointer bg-amber-50 border border-amber-300 p-3 rounded-2xl flex items-center justify-between gap-3 text-amber-900 shadow-sm transition-all hover:bg-amber-100"
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <Volume2 size={16} className="text-amber-600" />
            <span>Browser paused audio. Tap here to enable live chef sound alerts!</span>
          </div>
          <span className="bg-amber-500 text-white text-[11px] font-extrabold px-3 py-1 rounded-xl shadow-xs">
            Enable Live Sound
          </span>
        </div>
      )}

      {/* Tabs with badge counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs">
        <button
          type="button"
          onClick={() => setActiveTab('all_active')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold transition-all shadow-xs ${
            activeTab === 'all_active'
              ? 'bg-amber-500 text-white'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          All Active ({counts.all_active})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('new')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs ${
            activeTab === 'new'
              ? 'bg-red-500 text-white'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          New ({counts.new})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('in_progress')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs ${
            activeTab === 'in_progress'
              ? 'bg-amber-600 text-white'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          In Progress ({counts.in_progress})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('partially_ready')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs ${
            activeTab === 'partially_ready'
              ? 'bg-amber-400 text-gray-900 font-extrabold'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          Partially Ready ({counts.partially_ready})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ready')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs ${
            activeTab === 'ready'
              ? 'bg-emerald-600 text-white'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          All Items Ready ({counts.ready})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('completed')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all shadow-xs ${
            activeTab === 'completed'
              ? 'bg-gray-800 text-white'
              : 'bg-white text-gray-600 hover:text-gray-900 border border-gray-200'
          }`}
        >
          Completed ({counts.completed})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center text-gray-500 space-y-3 shadow-xs">
          <ShoppingBag size={42} className="mx-auto text-gray-300" />
          <p className="text-base font-extrabold text-gray-800">No orders in this category</p>
          <p className="text-xs text-gray-500">Incoming cashier orders will automatically appear here live.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOrders.map(order => {
            const items = order.items || [];
            const totalItems = items.length;
            const readyOrServedCount = items.filter(i => i.status === 'ready' || i.status === 'served').length;
            const servedCount = items.filter(i => i.status === 'served').length;
            const allReady = readyOrServedCount === totalItems && totalItems > 0;
            const isCompleted = order.order_status === 'completed' || servedCount === totalItems;
            const isNew = order.order_status === 'new';

            const progressPct = totalItems > 0 ? Math.round((readyOrServedCount / totalItems) * 100) : 0;

            return (
              <div
                key={order.id}
                className={`flex flex-col justify-between bg-white rounded-3xl overflow-hidden border transition-all shadow-xs ${
                  isNew
                    ? 'border-red-300 ring-2 ring-red-400/20'
                    : allReady && !isCompleted
                    ? 'border-emerald-300 ring-2 ring-emerald-400/20'
                    : isCompleted
                    ? 'border-gray-200 opacity-80'
                    : 'border-amber-200 shadow-sm'
                }`}
              >
                {/* Order Ticket Header */}
                <div className={`p-4 border-b ${
                  isNew ? 'bg-red-50 border-red-100 text-red-950' :
                  allReady && !isCompleted ? 'bg-emerald-50 border-emerald-100 text-emerald-950' :
                  isCompleted ? 'bg-gray-50 border-gray-200 text-gray-800' :
                  'bg-amber-50 border-amber-100 text-amber-950'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-black tracking-tight text-gray-900">
                        #{order.daily_order_number}
                      </span>
                      <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full tracking-wider shadow-2xs ${
                        isNew ? 'bg-red-500 text-white' :
                        allReady && !isCompleted ? 'bg-emerald-600 text-white' :
                        isCompleted ? 'bg-gray-600 text-white' :
                        'bg-amber-600 text-white'
                      }`}>
                        {allReady && !isCompleted ? 'ALL READY' : isCompleted ? 'COMPLETED' : order.order_status === 'new' ? 'NEW' : 'IN PROGRESS'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-gray-500 text-xs font-semibold">
                      <Clock size={12} />
                      <span>{getElapsedMinutes(order.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <p className="font-extrabold text-gray-900 text-sm truncate">{order.customer_name}</p>
                    <span className="text-gray-500 text-[11px] font-medium">{formatTimeOnly(order.created_at)}</span>
                  </div>

                  {/* Progress Indicator */}
                  <div className="mt-3 pt-2 border-t border-black/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-gray-700">
                        {allReady ? (
                          <span className="text-emerald-700 flex items-center gap-1 font-bold">
                            <Sparkles size={12} /> All {totalItems} items finished!
                          </span>
                        ) : (
                          <span>{readyOrServedCount} of {totalItems} items ready</span>
                        )}
                      </span>
                      <span className="font-mono text-gray-500 font-bold">{progressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          allReady ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Individual Item-Level Checklist */}
                <div className="p-4 flex-1 space-y-2">
                  <div className="divide-y divide-gray-100">
                    {items.map((item) => {
                      const isItemPending = !item.status || item.status === 'pending';
                      const isItemPreparing = item.status === 'preparing';
                      const isItemReady = item.status === 'ready';
                      const isItemServed = item.status === 'served';
                      const isUpdating = updatingItemId === item.id;

                      return (
                        <div
                          key={item.id}
                          className={`py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-colors ${
                            isItemReady ? 'bg-emerald-50/50 rounded-xl px-2 -mx-2' :
                            isItemServed ? 'opacity-60 bg-gray-50 rounded-xl px-2 -mx-2' : ''
                          }`}
                        >
                          {/* Item Info */}
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              {item.quantity}×
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-bold leading-tight ${
                                isItemServed ? 'line-through text-gray-400' :
                                isItemReady ? 'text-emerald-800' : 'text-gray-900'
                              }`}>
                                {item.name}
                              </p>
                              {item.category_name && (
                                <p className="text-[11px] text-gray-500 mt-0.5">{item.category_name}</p>
                              )}
                              {isItemReady && (
                                <p className="text-[10px] text-emerald-700 font-mono mt-0.5 font-semibold">
                                  ✓ Ready {item.ready_at ? `at ${new Date(item.ready_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
                                </p>
                              )}
                              {isItemServed && (
                                <p className="text-[10px] text-gray-500 font-mono mt-0.5">
                                  Handed over to customer
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Individual Status Actions - Mobile Touch Friendly (min 44px height) */}
                          <div className="flex items-center gap-2 self-stretch sm:self-center justify-end flex-shrink-0 pt-1 sm:pt-0">
                            {isItemPending && (
                              <div className="flex items-center gap-1.5 w-full sm:w-auto">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'preparing')}
                                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-amber-100 text-gray-800 hover:text-amber-950 border border-gray-300 hover:border-amber-400 text-xs font-black flex items-center justify-center gap-1.5 transition-all shadow-2xs active:scale-95 cursor-pointer flex-1 sm:flex-initial"
                                  title="Mark item as preparing"
                                >
                                  <Play size={13} fill="currentColor" />
                                  <span>PREP</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'ready')}
                                  className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all active:scale-95 cursor-pointer flex-1 sm:flex-initial"
                                  title="Tick Ready: Mark item as finished"
                                >
                                  <Square size={15} />
                                  <span>TICK READY</span>
                                </button>
                              </div>
                            )}

                            {isItemPreparing && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateItemStatus(order.id, item.id, 'ready')}
                                className="min-h-[44px] w-full sm:w-auto px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-2 shadow-sm transition-all active:scale-95 cursor-pointer"
                                title="Tick Ready: Mark item ready"
                              >
                                <CheckSquare size={16} className="text-white" />
                                <span>MARK READY</span>
                              </button>
                            )}

                            {isItemReady && (
                              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                <span className="min-h-[44px] px-3 py-2 rounded-xl bg-emerald-100 text-emerald-900 border border-emerald-300 text-xs font-black flex items-center justify-center gap-1.5 shadow-2xs">
                                  <CheckCircle2 size={16} className="text-emerald-700" />
                                  <span>READY</span>
                                </span>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'served')}
                                  className="min-h-[44px] px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-purple-100 text-gray-700 hover:text-purple-900 border border-gray-300 hover:border-purple-300 text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                                  title="Mark this item handed over / served"
                                >
                                  <span>SERVED</span>
                                  <ArrowRight size={13} />
                                </button>
                              </div>
                            )}

                            {isItemServed && (
                              <span className="min-h-[38px] px-3 py-1.5 rounded-xl bg-gray-100 text-gray-500 border border-gray-200 text-xs font-bold flex items-center justify-center gap-1">
                                <Check size={13} />
                                <span>Served</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Cashier Special Instructions */}
                  {order.special_instructions && (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2 text-amber-900 text-xs mt-3">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <strong className="block text-gray-900 text-[11px] uppercase tracking-wide">Customer Request:</strong>
                        <p className="italic mt-0.5">{order.special_instructions}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Footer & Fast Batch Actions */}
                <div className="p-3 bg-gray-50 border-t border-gray-200">
                  {allReady && !isCompleted && (
                    <button
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-md transition-all active:scale-[0.99]"
                    >
                      <CheckCircle2 size={18} />
                      <span>Handover & Complete Order</span>
                    </button>
                  )}

                  {!allReady && !isCompleted && isNew && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleUpdateOrderStatus(order.id, 'preparing')}
                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow-xs transition-colors"
                      >
                        <Play size={14} fill="white" />
                        <span>Start All Items</span>
                      </button>
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                        className="px-3 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold py-2.5 rounded-xl text-xs transition-colors shadow-2xs"
                        title="Mark all items ready at once"
                      >
                        All Ready
                      </button>
                    </div>
                  )}

                  {!allReady && !isCompleted && !isNew && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-500 text-[11px]">
                        Tick individual items above as they finish
                      </span>
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                        className="px-3 py-1.5 rounded-lg bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-xs transition-colors shadow-2xs"
                        title="Finish all items at once"
                      >
                        Mark All Ready
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="text-center text-xs text-gray-500 py-1 font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={15} className="text-emerald-600" />
                      <span>All Items Prepared & Handed Over</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
