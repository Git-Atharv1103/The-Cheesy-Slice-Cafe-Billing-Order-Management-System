import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatINR, getISTDate } from '../lib/utils';
import { TrendingUp, ShoppingBag, Banknote, Smartphone, Plus, Trash2, AlertTriangle, ChefHat, ClipboardList, UtensilsCrossed } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useRealtime } from '../contexts/RealtimeContext';
import toast from 'react-hot-toast';

interface Summary {
  total_orders: number;
  total_sales: number;
  online_collected: number;
  cash_collected: number;
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { lastEventTime } = useRealtime();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearInput, setClearInput] = useState('');
  const [clearing, setClearing] = useState(false);
  const today = getISTDate();

  useEffect(() => {
    loadData();
  }, [lastEventTime]);

  async function loadData() {
    try {
      const summaryRes = await api.get(`/dashboard/summary?date=${today}`);
      setSummary(summaryRes.data.summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearData() {
    if (clearInput !== 'CONFIRM_FRESH_START' && clearInput !== 'CONFIRM_CLEAR_DEMO_DATA') {
      toast.error('Type CONFIRM_FRESH_START or CONFIRM_CLEAR_DEMO_DATA');
      return;
    }
    setClearing(true);
    try {
      if (clearInput === 'CONFIRM_FRESH_START') {
        const res = await api.post('/orders/fresh-start', { confirmation: clearInput });
        toast.success(res.data.message || 'Fresh start completed! Order numbering reset to #001.');
      } else {
        const res = await api.post('/orders/clear-test-data', { confirmation: clearInput });
        toast.success(res.data.message || 'Demo data cleared!');
      }
      setShowClearModal(false);
      setClearInput('');
      loadData();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Failed to clear data');
    } finally {
      setClearing(false);
    }
  }

  // Exactly 4 cards
  const stats = summary ? [
    { label: "Today's Sales", value: formatINR(summary.total_sales), icon: TrendingUp, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
    { label: "Total Orders", value: summary.total_orders, icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200' },
    { label: "Cash Collected", value: formatINR(summary.cash_collected), icon: Banknote, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
    { label: "Online / UPI Collected", value: formatINR(summary.online_collected), icon: Smartphone, color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Dashboard</h1>
          <p className="text-gray-500 text-xs md:text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 bg-white hover:bg-red-50 text-gray-600 hover:text-red-600 border border-gray-200 hover:border-red-200 px-3 py-2 rounded-xl text-xs font-semibold transition-colors shadow-xs"
              title="Clean up test/demo orders or reset sequence to 001"
            >
              <Trash2 size={14} />
              <span>Fresh Start / Reset</span>
            </button>
          )}

          <button
            onClick={() => navigate('/new-order')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-md transition-all"
          >
            <Plus size={18} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid - EXACTLY 4 Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 hover:border-gray-300 shadow-xs transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{stat.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} border flex items-center justify-center flex-shrink-0`}>
                    <stat.icon size={16} className={stat.color} />
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-black text-gray-900 truncate">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Quick Action Navigation - Clean, mobile-first, and focused */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KDS Access Banner */}
            <div
              onClick={() => navigate('/kitchen')}
              className="bg-white border border-gray-200 hover:border-amber-400 rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs hover:shadow-md group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ChefHat size={26} />
                </div>
                <div>
                  <h3 className="text-gray-900 font-extrabold text-base flex items-center gap-2">
                    Kitchen Display (KDS)
                    <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Live Item Tracking</span>
                  </h3>
                  <p className="text-gray-500 text-xs mt-1">Real-time screen with tick boxes for chefs</p>
                </div>
              </div>
              <span className="text-amber-600 text-xl font-black group-hover:translate-x-1 transition-transform">→</span>
            </div>

            {/* Dedicated Orders Page */}
            <div
              onClick={() => navigate('/orders')}
              className="bg-white border border-gray-200 hover:border-blue-400 rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs hover:shadow-md group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ClipboardList size={26} />
                </div>
                <div>
                  <h3 className="text-gray-900 font-extrabold text-base">Active & Past Orders</h3>
                  <p className="text-gray-500 text-xs mt-1">Search, view details, print receipts, and settle balances</p>
                </div>
              </div>
              <span className="text-blue-600 text-xl font-black group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/new-order')}
              className="p-4 bg-white hover:bg-amber-50/50 border border-gray-200 hover:border-amber-300 rounded-xl text-left flex items-center gap-3 transition-all shadow-xs"
            >
              <div className="w-9 h-9 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <Plus size={18} />
              </div>
              <div>
                <p className="text-gray-900 text-xs font-bold">New Billing</p>
                <p className="text-gray-500 text-[11px]">Create customer order</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/menu-management')}
              className="p-4 bg-white hover:bg-orange-50/50 border border-gray-200 hover:border-orange-300 rounded-xl text-left flex items-center gap-3 transition-all shadow-xs"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center">
                <UtensilsCrossed size={18} />
              </div>
              <div>
                <p className="text-gray-900 text-xs font-bold">Menu Items</p>
                <p className="text-gray-500 text-[11px]">Manage categories & prices</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/daily-sales')}
              className="p-4 bg-white hover:bg-emerald-50/50 border border-gray-200 hover:border-emerald-300 rounded-xl text-left flex items-center gap-3 transition-all shadow-xs col-span-2 sm:col-span-1"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-gray-900 text-xs font-bold">Daily Analytics</p>
                <p className="text-gray-500 text-[11px]">Reports & bestsellers</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Fresh Start / Clear Orders Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-red-600">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg text-gray-900">Fresh Start / Reset Sequence</h3>
            </div>
            <p className="text-gray-600 text-xs leading-relaxed">
              To wipe old test/demo orders and start order numbering fresh from <strong className="text-amber-700">#001</strong> for a new business day, type:
            </p>
            <div className="bg-gray-100 p-2.5 rounded-xl border border-gray-200 text-center">
              <code className="text-amber-800 text-xs font-mono font-bold select-all">CONFIRM_FRESH_START</code>
            </div>
            <p className="text-gray-500 text-[11px]">
              Or type <code className="text-gray-800 font-mono font-semibold">CONFIRM_CLEAR_DEMO_DATA</code> to only delete test orders. Menu items, cafe logo, QR code, and staff users will remain completely intact.
            </p>
            <div>
              <input
                type="text"
                value={clearInput}
                onChange={e => setClearInput(e.target.value.trim())}
                placeholder="Type confirmation code here"
                className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs font-mono focus:border-red-500 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowClearModal(false); setClearInput(''); }}
                className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearData}
                disabled={clearing || (clearInput !== 'CONFIRM_FRESH_START' && clearInput !== 'CONFIRM_CLEAR_DEMO_DATA')}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-2.5 rounded-xl text-xs font-bold transition-opacity shadow-sm"
              >
                {clearing ? 'Clearing...' : 'Confirm Reset'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
