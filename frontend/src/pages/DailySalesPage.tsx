import React, { useEffect, useState } from 'react';
import api from '../lib/api';
import { formatINR, getISTDate, downloadCSV } from '../lib/utils';
import { Download, Printer } from 'lucide-react';

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
    <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-xs">
      <p className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-xl font-black ${color || 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-gray-400 text-xs mt-1">{sub}</p>}
    </div>
  );

  return (
    <div className="p-4 md:p-6 bg-[#F9FAFB] text-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Daily Sales Analytics</h1>
            <p className="text-gray-500 text-sm">Financial summary, product performance, and export</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-xs transition-colors"
            >
              <Download size={15} />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-gray-50 shadow-xs transition-colors"
            >
              <Printer size={15} />
              <span>Print</span>
            </button>
          </div>
        </div>

        {/* Date Picker */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-2xl p-3 shadow-xs w-fit">
          <button
            type="button"
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()-1); setSelectedDate(d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})); }}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-800 text-xs font-bold transition-colors"
          >
            ← Prev
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-gray-900 text-xs font-semibold focus:outline-none focus:border-amber-500"
          />
          <button
            type="button"
            onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate()+1); setSelectedDate(d.toLocaleDateString('en-CA',{timeZone:'Asia/Kolkata'})); }}
            className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-lg text-gray-800 text-xs font-bold transition-colors"
          >
            Next →
          </button>
          <button
            type="button"
            onClick={() => setSelectedDate(getISTDate())}
            className="text-amber-700 font-bold text-xs hover:underline ml-2"
          >
            Today
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48 bg-white rounded-2xl border border-gray-200 shadow-xs">
            <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : !summary ? null : (
          <div className="space-y-6">
            {/* Primary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard label="Total Sales" value={formatINR(summary.total_sales)} color="text-amber-600" />
              <StatCard label="Cash Collected" value={formatINR(summary.cash_collected)} color="text-emerald-600" />
              <StatCard label="Online / UPI Collected" value={formatINR(summary.online_collected)} color="text-blue-600" />
              <StatCard label="Outstanding Balance" value={formatINR(summary.total_outstanding)} color="text-red-600" />
            </div>

            {/* Order Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <StatCard label="Total Orders" value={summary.total_orders} />
              <StatCard label="Fully Paid" value={summary.paid_count} color="text-emerald-600" />
              <StatCard label="Partial / Pending" value={`${summary.partial_count} / ${summary.pending_count}`} color="text-amber-600" />
              <StatCard label="Cancelled" value={summary.cancelled_count} color="text-gray-400" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Best Sellers */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-gray-900 font-extrabold text-sm">🏆 Top Selling Menu Items</h2>
                </div>
                {bestsellers.length === 0 ? (
                  <p className="text-gray-400 text-xs p-6 text-center">No item sales recorded for this date</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {bestsellers.map((item, i) => (
                      <div key={item.name} className="flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors">
                        <span className="text-amber-600 font-black text-xs w-6">{i + 1}.</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-900 text-sm font-bold truncate">{item.name}</p>
                          <p className="text-gray-500 text-xs">{item.category_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-gray-900 font-black text-sm">{formatINR(Number(item.revenue))}</p>
                          <p className="text-gray-500 text-xs">{item.qty_sold} sold</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Category Sales */}
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 md:p-5 border-b border-gray-100 bg-gray-50/50">
                  <h2 className="text-gray-900 font-extrabold text-sm">📊 Revenue by Category</h2>
                </div>
                {categorySales.length === 0 ? (
                  <p className="text-gray-400 text-xs p-6 text-center">No category data recorded for this date</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {categorySales.map(cat => (
                      <div key={cat.category_name} className="flex items-center justify-between p-4 hover:bg-gray-50/50 transition-colors">
                        <div>
                          <p className="text-gray-900 text-sm font-bold">{cat.category_name || 'Uncategorized'}</p>
                          <p className="text-gray-500 text-xs">{cat.qty_sold} items sold</p>
                        </div>
                        <p className="text-gray-900 font-black text-sm">{formatINR(Number(cat.revenue))}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Discounts */}
            {summary.total_discounts > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600 font-medium">Total Promotional Discounts Given</span>
                  <span className="text-emerald-600 font-black">{formatINR(summary.total_discounts)}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
