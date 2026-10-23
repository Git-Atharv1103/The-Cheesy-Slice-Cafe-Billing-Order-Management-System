import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatINR, getISTDate, downloadCSV } from '../lib/utils';
import { TrendingUp, ShoppingBag, IndianRupee, Download, Printer } from 'lucide-react';

interface Summary {
  total_orders: number; total_sales: number; total_discounts: number;
  total_outstanding: number; paid_count: number; partial_count: number;
  pending_count: number; cancelled_count: number; online_collected: number; cash_collected: number;
}
interface BestSeller { name: string; category_name: string; qty_sold: number; revenue: number; }
interface CategorySale { category_name: string; qty_sold: number; revenue: number; }

export default function DailySalesPage() {
  const [selectedDate, setSelectedDate] = useState(getISTDate());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [bestsellers, setBestsellers] = useState<BestSeller[]>([]);
  const [categorySales, setCategorySales] = useState<CategorySale[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadData(); }, [selectedDate]);

  async function loadData() {
    setLoading(true);
    try {
      const res = await api.get(`/dashboard/summary?date=${selectedDate}`);
      setSummary(res.data.summary);
      setBestsellers(res.data.bestsellers);
      setCategorySales(res.data.category_sales);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    const res = await api.get(`/dashboard/orders-table?date=${selectedDate}`);
    const rows = res.data.map((o: Record<string, unknown>) => ({
      'Order #': o.daily_order_number,
      'Customer': o.customer_name,
      'Date': o.order_date,
      'Total (₹)': Number(o.total) / 100,
      'Paid (₹)': Number(o.total_paid) / 100,
      'Balance (₹)': Number(o.balance_due) / 100,
      'Payment Status': o.payment_status,
      'Order Status': o.order_status,
    }));
    downloadCSV(rows, `cheesy-slice-sales-${selectedDate}.csv`);
  }

  const StatCard = ({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) => (
    <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
      <p className="text-gray-500 text-xs mb-1">{label}</p>
      <p className={`text-xl font-bold ${color || 'text-white'}`}>{value}</p>
      {sub && <p className="text-gray-600 text-xs mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Daily Sales</h1>
          <p className="text-gray-500 text-sm">Sales report and analytics</p>
        </div>
        <div className="flex gap-3">
          <button onClick={handleExport} className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1e1e1e]">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-[#141414] border border-[#2a2a2a] text-white px-4 py-2 rounded-lg text-sm hover:bg-[#1e1e1e]">
            <Printer size={15} /> Print
          </button>
        </div>
      </div>

      {/* Date Picker */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})); }}
          className="px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white text-sm hover:bg-[#1e1e1e]">←</button>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-[#141414] border border-[#2a2a2a] rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
        />
        <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})); }}
          className="px-3 py-2 bg-[#141414] border border-[#2a2a2a] rounded-lg text-white text-sm hover:bg-[#1e1e1e]">→</button>
        <button onClick={() => setSelectedDate(getISTDate())} className="text-yellow-400 text-sm hover:underline ml-2">Today</button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !summary ? null : (
        <div className="space-y-6">
          {/* Primary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Sales" value={formatINR(summary.total_sales)} color="text-yellow-400" />
            <StatCard label="Cash Collected" value={formatINR(summary.cash_collected)} color="text-green-400" />
            <StatCard label="Online Collected" value={formatINR(summary.online_collected)} color="text-blue-400" />
            <StatCard label="Outstanding" value={formatINR(summary.total_outstanding)} color="text-red-400" />
          </div>

          {/* Order Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Orders" value={summary.total_orders} />
            <StatCard label="Paid Orders" value={summary.paid_count} color="text-green-400" />
            <StatCard label="Partial / Pending" value={`${summary.partial_count} / ${summary.pending_count}`} />
            <StatCard label="Cancelled" value={summary.cancelled_count} color="text-red-400" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Best Sellers */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white font-semibold">🏆 Best Selling Items</h2>
              </div>
              {bestsellers.length === 0 ? (
                <p className="text-gray-500 text-sm p-5">No data</p>
              ) : (
                <div className="divide-y divide-[#2a2a2a]">
                  {bestsellers.map((item, i) => (
                    <div key={item.name} className="flex items-center gap-4 p-4">
                      <span className="text-gray-600 text-sm w-6">{i + 1}.</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{item.name}</p>
                        <p className="text-gray-500 text-xs">{item.category_name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-yellow-400 font-semibold text-sm">{formatINR(Number(item.revenue))}</p>
                        <p className="text-gray-500 text-xs">{item.qty_sold} sold</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Category Sales */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
              <div className="p-5 border-b border-[#2a2a2a]">
                <h2 className="text-white font-semibold">📊 Sales by Category</h2>
              </div>
              {categorySales.length === 0 ? (
                <p className="text-gray-500 text-sm p-5">No data</p>
              ) : (
                <div className="divide-y divide-[#2a2a2a]">
                  {categorySales.map(cat => (
                    <div key={cat.category_name} className="flex items-center justify-between p-4">
                      <div>
                        <p className="text-white text-sm font-medium">{cat.category_name || 'Uncategorized'}</p>
                        <p className="text-gray-500 text-xs">{cat.qty_sold} items sold</p>
                      </div>
                      <p className="text-yellow-400 font-semibold">{formatINR(Number(cat.revenue))}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Discounts */}
          {summary.total_discounts > 0 && (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Total Discounts Given</span>
                <span className="text-green-400 font-semibold">{formatINR(summary.total_discounts)}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
