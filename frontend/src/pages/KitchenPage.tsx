import React, { useEffect, useState, useMemo, useCallback } from 'react';
import api from '../lib/api';
import { useRealtime } from '../contexts/RealtimeContext';
import { formatDateTime, formatTimeOnly, getElapsedMinutes } from '../lib/utils';
import { 
  ChefHat, Clock, CheckCircle2, CheckSquare, Square, Play, Bell, 
  Volume2, VolumeX, RefreshCw, AlertCircle, ShoppingBag, Utensils, 
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
    isAudioUnlocked,
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
      // Replace with confirmed order from backend
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
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4">
      {/* Kitchen Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#141414] border border-[#2a2a2a] p-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold flex-shrink-0">
            <ChefHat size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-wide">Kitchen Display (KDS)</h1>
              {counts.new > 0 && (
                <span className="bg-red-500 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full animate-pulse">
                  {counts.new} NEW
                </span>
              )}
            </div>
            <p className="text-gray-400 text-xs">Individual item-level ready checkboxes • Touch-friendly live tickets</p>
          </div>
        </div>

        {/* Audio Toggle, Test Sound & Refresh */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={testChime}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[#1e1e1e] hover:bg-yellow-400/20 text-yellow-400 border border-[#333] transition-all"
            title="Test sound notification chime"
          >
            <Bell size={14} />
            <span>Test Sound</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playChime('new');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
              audioEnabled
                ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30'
                : 'bg-[#1e1e1e] text-gray-400 border-[#333]'
            }`}
            title="Toggle audio alert chime on incoming orders"
          >
            {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>Sound {audioEnabled ? 'ON' : 'OFF'}</span>
          </button>

          <button
            onClick={loadKitchenOrders}
            className="p-2 rounded-xl bg-[#1e1e1e] hover:bg-[#282828] text-gray-400 hover:text-white border border-[#2a2a2a] transition-colors"
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
          className="cursor-pointer bg-amber-500/20 border border-amber-500/40 p-3 rounded-xl flex items-center justify-between gap-3 text-amber-300 animate-pulse transition-all hover:bg-amber-500/30"
        >
          <div className="flex items-center gap-2 text-xs font-bold">
            <Volume2 size={16} />
            <span>Browser blocked audio autoplay. Tap here to enable live sound alerts!</span>
          </div>
          <span className="bg-amber-500 text-black text-[11px] font-extrabold px-2.5 py-1 rounded-lg">
            Enable Sound
          </span>
        </div>
      )}

      {/* Tabs with badge counts */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide text-xs">
        <button
          onClick={() => setActiveTab('all_active')}
          className={`flex-shrink-0 px-4 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'all_active'
              ? 'bg-yellow-400 text-black shadow-md'
              : 'bg-[#141414] text-gray-400 hover:text-white border border-[#242424]'
          }`}
        >
          All Active ({counts.all_active})
        </button>

        <button
          onClick={() => setActiveTab('new')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'new'
              ? 'bg-red-500 text-white shadow-md'
              : 'bg-[#141414] text-gray-400 hover:text-white border border-[#242424]'
          }`}
        >
          New ({counts.new})
        </button>

        <button
          onClick={() => setActiveTab('in_progress')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'in_progress'
              ? 'bg-orange-500 text-white shadow-md'
              : 'bg-[#141414] text-gray-400 hover:text-white border border-[#242424]'
          }`}
        >
          In Progress ({counts.in_progress})
        </button>

        <button
          onClick={() => setActiveTab('partially_ready')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'partially_ready'
              ? 'bg-amber-400 text-black shadow-md'
              : 'bg-[#141414] text-gray-400 hover:text-white border border-[#242424]'
          }`}
        >
          Partially Ready ({counts.partially_ready})
        </button>

        <button
          onClick={() => setActiveTab('ready')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'ready'
              ? 'bg-green-500 text-white shadow-md'
              : 'bg-[#141414] text-gray-400 hover:text-white border border-[#242424]'
          }`}
        >
          All Items Ready ({counts.ready})
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`flex-shrink-0 px-3.5 py-2 rounded-xl font-bold transition-all ${
            activeTab === 'completed'
              ? 'bg-gray-300 text-black shadow-md'
              : 'bg-[#141414] text-gray-400 hover:text-white border border-[#242424]'
          }`}
        >
          Completed ({counts.completed})
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="bg-[#141414] border border-[#242424] rounded-2xl p-12 text-center text-gray-500 space-y-3">
          <ShoppingBag size={42} className="mx-auto opacity-30 text-yellow-400" />
          <p className="text-base font-semibold text-white">No orders in this filter</p>
          <p className="text-xs text-gray-400">Incoming cashier orders will automatically pop up here in real time.</p>
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
                className={`flex flex-col justify-between bg-[#141414] rounded-2xl overflow-hidden border transition-all ${
                  isNew
                    ? 'border-red-500 shadow-lg shadow-red-500/10 ring-1 ring-red-500/50'
                    : allReady && !isCompleted
                    ? 'border-green-500 shadow-lg shadow-green-500/10 bg-green-500/[0.02]'
                    : isCompleted
                    ? 'border-[#242424] opacity-75'
                    : 'border-orange-500/60 shadow-md shadow-orange-500/5'
                }`}
              >
                {/* Order Ticket Header */}
                <div className={`p-4 border-b ${
                  isNew ? 'bg-red-500/10 border-red-500/20' :
                  allReady && !isCompleted ? 'bg-green-500/10 border-green-500/20' :
                  isCompleted ? 'bg-[#181818] border-[#242424]' :
                  'bg-orange-500/10 border-orange-500/20'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl font-black text-white tracking-tight">
                        #{order.daily_order_number}
                      </span>
                      <span className={`text-[10px] uppercase font-black px-2.5 py-0.5 rounded-full tracking-wider ${
                        isNew ? 'bg-red-500 text-white animate-pulse' :
                        allReady && !isCompleted ? 'bg-green-500 text-white' :
                        isCompleted ? 'bg-gray-600 text-white' :
                        'bg-orange-500 text-white'
                      }`}>
                        {allReady && !isCompleted ? 'ALL READY' : isCompleted ? 'COMPLETED' : order.order_status === 'new' ? 'NEW' : 'IN PROGRESS'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-gray-400 text-xs">
                      <Clock size={12} />
                      <span>{getElapsedMinutes(order.created_at)}</span>
                    </div>
                  </div>

                  <div className="mt-2 flex items-center justify-between text-xs">
                    <p className="font-bold text-white text-sm truncate">{order.customer_name}</p>
                    <span className="text-gray-400 text-[11px]">{formatTimeOnly(order.created_at)}</span>
                  </div>

                  {/* Progress Indicator */}
                  <div className="mt-3 pt-2 border-t border-white/5 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-gray-300">
                        {allReady ? (
                          <span className="text-green-400 flex items-center gap-1 font-bold">
                            <Sparkles size={12} /> All {totalItems} items ready!
                          </span>
                        ) : (
                          <span>{readyOrServedCount} of {totalItems} items ready</span>
                        )}
                      </span>
                      <span className="font-mono text-gray-400">{progressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-[#222] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          allReady ? 'bg-green-500' : 'bg-gradient-to-r from-orange-500 to-yellow-400'
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Individual Item-Level Checklist */}
                <div className="p-4 flex-1 space-y-2">
                  <div className="divide-y divide-[#202020]">
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
                            isItemReady ? 'bg-green-500/[0.03] rounded-xl px-2 -mx-2' :
                            isItemServed ? 'opacity-60 bg-white/[0.01] rounded-xl px-2 -mx-2' : ''
                          }`}
                        >
                          {/* Item Info */}
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span className="w-7 h-7 rounded-lg bg-yellow-400 text-black font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                              {item.quantity}x
                            </span>
                            <div className="min-w-0">
                              <p className={`text-sm font-semibold leading-tight ${
                                isItemServed ? 'line-through text-gray-500' :
                                isItemReady ? 'text-green-300' : 'text-white'
                              }`}>
                                {item.name}
                              </p>
                              {item.category_name && (
                                <p className="text-[11px] text-gray-500 mt-0.5">{item.category_name}</p>
                              )}
                              {isItemReady && (
                                <p className="text-[10px] text-green-400/80 font-mono mt-0.5">
                                  Ready {item.ready_at ? `at ${new Date(item.ready_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}` : ''}
                                </p>
                              )}
                              {isItemServed && (
                                <p className="text-[10px] text-purple-400/80 font-mono mt-0.5">
                                  Handed over to customer
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Individual Status Actions */}
                          <div className="flex items-center gap-1.5 self-end sm:self-center flex-shrink-0">
                            {isItemPending && (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'preparing')}
                                  className="px-2.5 py-1.5 rounded-lg bg-[#222] hover:bg-orange-500/20 text-gray-300 hover:text-orange-400 border border-[#333] hover:border-orange-500/40 text-xs font-semibold flex items-center gap-1 transition-all"
                                  title="Mark item as preparing"
                                >
                                  <Play size={12} fill="currentColor" />
                                  <span>Prep</span>
                                </button>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'ready')}
                                  className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                                  title="Tick Ready: Mark item as finished"
                                >
                                  <Square size={13} />
                                  <span>Tick Ready</span>
                                </button>
                              </div>
                            )}

                            {isItemPreparing && (
                              <button
                                type="button"
                                disabled={isUpdating}
                                onClick={() => handleUpdateItemStatus(order.id, item.id, 'ready')}
                                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-green-500/10 transition-all ring-1 ring-green-400"
                                title="Tick Ready: Mark item ready"
                              >
                                <CheckSquare size={14} className="text-white" />
                                <span>Mark Ready</span>
                              </button>
                            )}

                            {isItemReady && (
                              <div className="flex items-center gap-1.5">
                                <span className="px-2 py-1 rounded-lg bg-green-500/20 text-green-400 border border-green-500/30 text-[11px] font-bold flex items-center gap-1">
                                  <CheckCircle2 size={13} className="text-green-400" />
                                  <span>Ready</span>
                                </span>
                                <button
                                  type="button"
                                  disabled={isUpdating}
                                  onClick={() => handleUpdateItemStatus(order.id, item.id, 'served')}
                                  className="px-2.5 py-1 rounded-lg bg-[#222] hover:bg-purple-600 hover:text-white text-purple-400 border border-purple-500/30 text-xs font-semibold flex items-center gap-1 transition-all"
                                  title="Mark this item handed over / served to customer"
                                >
                                  <span>Serve</span>
                                  <ArrowRight size={12} />
                                </button>
                              </div>
                            )}

                            {isItemServed && (
                              <span className="px-2.5 py-1 rounded-lg bg-purple-500/15 text-purple-400 border border-purple-500/30 text-xs font-bold flex items-center gap-1">
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
                    <div className="p-2.5 rounded-xl bg-yellow-400/10 border border-yellow-400/30 flex items-start gap-2 text-yellow-300 text-xs mt-3">
                      <AlertCircle size={15} className="flex-shrink-0 mt-0.5 text-yellow-400" />
                      <div>
                        <strong className="block text-white text-[11px] uppercase tracking-wide">Cashier Note:</strong>
                        <p className="italic mt-0.5">{order.special_instructions}</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Order Footer & Fast Batch Actions */}
                <div className="p-3 bg-[#111] border-t border-[#222]">
                  {allReady && !isCompleted && (
                    <button
                      type="button"
                      disabled={updatingOrderId === order.id}
                      onClick={() => handleUpdateOrderStatus(order.id, 'completed')}
                      className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-95 text-white font-black py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20 transition-all"
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
                        className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:opacity-90 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-opacity"
                      >
                        <Play size={14} fill="white" />
                        <span>Start All Items</span>
                      </button>
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                        className="px-3 bg-[#202020] hover:bg-green-600 hover:text-white text-green-400 border border-green-500/30 font-semibold py-2.5 rounded-xl text-xs transition-colors"
                        title="Mark all items ready at once"
                      >
                        All Ready
                      </button>
                    </div>
                  )}

                  {!allReady && !isCompleted && !isNew && (
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-gray-400 text-[11px] italic">
                        Tick individual items above as they finish
                      </span>
                      <button
                        type="button"
                        disabled={updatingOrderId === order.id}
                        onClick={() => handleUpdateOrderStatus(order.id, 'ready')}
                        className="px-3 py-1.5 rounded-lg bg-[#202020] hover:bg-green-600 hover:text-white text-green-400 border border-green-500/30 font-semibold text-xs transition-colors"
                        title="Finish all items at once"
                      >
                        Mark All Ready
                      </button>
                    </div>
                  )}

                  {isCompleted && (
                    <div className="text-center text-xs text-gray-500 py-1 font-medium flex items-center justify-center gap-1.5">
                      <CheckCircle2 size={15} className="text-green-500" />
                      <span>All Items Prepared & Completed</span>
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
