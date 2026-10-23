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
    { label: "Today's Sales", value: formatINR(summary.total_sales), icon: TrendingUp, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
    { label: "Total Orders", value: summary.total_orders, icon: ShoppingBag, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { label: "Cash Collected", value: formatINR(summary.cash_collected), icon: Banknote, color: 'text-green-400', bg: 'bg-green-400/10' },
    { label: "Online / UPI Collected", value: formatINR(summary.online_collected), icon: Smartphone, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  ] : [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Dashboard</h1>
          <p className="text-gray-400 text-xs md:text-sm mt-0.5">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setShowClearModal(true)}
              className="flex items-center gap-1.5 bg-[#1a1a1a] hover:bg-red-500/10 text-gray-400 hover:text-red-400 border border-[#2a2a2a] px-3 py-2 rounded-xl text-xs font-medium transition-colors"
              title="Clean up test/demo orders or reset sequence to 001"
            >
              <Trash2 size={14} />
              Fresh Start / Clear Data
            </button>
          )}

          <button
            onClick={() => navigate('/new-order')}
            className="flex-1 sm:flex-initial flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-yellow-500/10 hover:opacity-90 transition-opacity"
          >
            <Plus size={18} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats Grid - EXACTLY 4 Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-[#141414] border border-[#242424] rounded-2xl p-4 md:p-5 hover:border-[#383838] transition-all">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-medium text-gray-400">{stat.label}</span>
                  <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon size={16} className={stat.color} />
                  </div>
                </div>
                <p className="text-xl md:text-2xl font-black text-white truncate">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Quick Action Navigation - Clean, mobile-first, and focused */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* KDS Access Banner */}
            <div
              onClick={() => navigate('/kitchen')}
              className="bg-gradient-to-br from-[#181818] to-[#121212] border border-[#2a2a2a] hover:border-yellow-400/50 rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ChefHat size={26} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base flex items-center gap-2">
                    Kitchen Display (KDS)
                    <span className="text-[10px] bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full font-semibold">Live Item Checkboxes</span>
                  </h3>
                  <p className="text-gray-400 text-xs mt-1">Individual item-level ready & served tracking for chefs</p>
                </div>
              </div>
              <span className="text-yellow-400 text-xl font-bold group-hover:translate-x-1 transition-transform">→</span>
            </div>

            {/* Dedicated Orders Page */}
            <div
              onClick={() => navigate('/orders')}
              className="bg-gradient-to-br from-[#181818] to-[#121212] border border-[#2a2a2a] hover:border-blue-400/50 rounded-2xl p-5 flex items-center justify-between gap-4 cursor-pointer transition-all group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                  <ClipboardList size={26} />
                </div>
                <div>
                  <h3 className="text-white font-bold text-base">Active & Past Orders</h3>
                  <p className="text-gray-400 text-xs mt-1">View, search, edit orders, print invoices, and record balance payments</p>
                </div>
              </div>
              <span className="text-blue-400 text-xl font-bold group-hover:translate-x-1 transition-transform">→</span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <button
              onClick={() => navigate('/new-order')}
              className="p-4 bg-[#141414] hover:bg-[#1a1a1a] border border-[#242424] hover:border-yellow-400/40 rounded-xl text-left flex items-center gap-3 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-yellow-400/10 text-yellow-400 flex items-center justify-center">
                <Plus size={18} />
              </div>
              <div>
                <p className="text-white text-xs font-bold">New Billing</p>
                <p className="text-gray-500 text-[11px]">Create customer order</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/menu-manage')}
              className="p-4 bg-[#141414] hover:bg-[#1a1a1a] border border-[#242424] hover:border-orange-400/40 rounded-xl text-left flex items-center gap-3 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-orange-400/10 text-orange-400 flex items-center justify-center">
                <UtensilsCrossed size={18} />
              </div>
              <div>
                <p className="text-white text-xs font-bold">Menu Items</p>
                <p className="text-gray-500 text-[11px]">Manage categories & price</p>
              </div>
            </button>

            <button
              onClick={() => navigate('/daily-sales')}
              className="p-4 bg-[#141414] hover:bg-[#1a1a1a] border border-[#242424] hover:border-green-400/40 rounded-xl text-left flex items-center gap-3 transition-colors col-span-2 sm:col-span-1"
            >
              <div className="w-9 h-9 rounded-lg bg-green-400/10 text-green-400 flex items-center justify-center">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-white text-xs font-bold">Daily Analytics</p>
                <p className="text-gray-500 text-[11px]">Reports & bestsellers</p>
              </div>
            </button>
          </div>
        </>
      )}

      {/* Fresh Start / Clear Orders Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle size={24} />
              <h3 className="font-bold text-lg text-white">Fresh Start / Clear Orders</h3>
            </div>
            <p className="text-gray-400 text-xs leading-relaxed">
              To wipe old test/demo orders and start order numbering fresh from <strong className="text-yellow-400">#001</strong> for a new business day, type:
            </p>
            <div className="bg-[#1a1a1a] p-2.5 rounded-lg border border-[#333] text-center">
              <code className="text-yellow-400 text-xs font-mono font-bold select-all">CONFIRM_FRESH_START</code>
            </div>
            <p className="text-gray-500 text-[11px]">
              Or type <code className="text-white font-mono">CONFIRM_CLEAR_DEMO_DATA</code> to only delete orders marked with "Test" or "Demo". Menu items, cafe logo, QR code, and users will remain intact.
            </p>
            <div>
              <input
                type="text"
                value={clearInput}
                onChange={e => setClearInput(e.target.value.trim())}
                placeholder="Type confirmation code here"
                className="w-full bg-[#1e1e1e] border border-[#333] rounded-lg px-3 py-2 text-white text-xs font-mono focus:border-red-400 focus:outline-none"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { setShowClearModal(false); setClearInput(''); }}
                className="flex-1 bg-[#1e1e1e] hover:bg-[#2a2a2a] text-gray-300 py-2.5 rounded-xl text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearData}
                disabled={clearing || (clearInput !== 'CONFIRM_FRESH_START' && clearInput !== 'CONFIRM_CLEAR_DEMO_DATA')}
                className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white py-2.5 rounded-xl text-xs font-bold transition-opacity"
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
