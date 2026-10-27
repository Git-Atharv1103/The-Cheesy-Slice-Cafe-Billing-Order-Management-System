import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { formatINR, formatDateTime, getPaymentStatusColor, getOrderStatusColor } from '../lib/utils';
import { ArrowLeft, Plus, Minus, Trash2, CreditCard, Ban, Save, Printer, PlusCircle, X, Search, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface OrderItem {
  id?: string;
  menu_item_id: string;
  name: string;
  category_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  status?: string;
  ready_at?: string;
  served_at?: string;
}

interface Payment {
  id: string;
  payment_method: string;
  amount: number;
  reference: string;
  created_at: string;
  payment_status: string;
}

interface Order {
  id: string;
  daily_order_number: string;
  customer_name: string;
  customer_phone: string;
  order_date: string;
  created_at: string;
  subtotal: number;
  discount: number;
  total: number;
  total_paid: number;
  balance_due: number;
  payment_status: string;
  order_status: string;
  items: OrderItem[];
  payments: Payment[];
  special_instructions: string;
}

interface MenuCategory {
  id: string;
  name: string;
  items: { id: string; name: string; price: number; category_id: string; is_available: number }[];
}

const ORDER_STATUSES = ['new', 'preparing', 'ready', 'completed', 'cancelled'];

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  // Edit fields
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editCustomerPhone, setEditCustomerPhone] = useState('');
  const [editInstructions, setEditInstructions] = useState('');
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editStatus, setEditStatus] = useState('');
  const [editDiscount, setEditDiscount] = useState('');

  // Payment addition
  const [addPaymentAmount, setAddPaymentAmount] = useState('');
  const [addPaymentMethod, setAddPaymentMethod] = useState<'cash' | 'online'>('cash');
  const [addPaymentRef, setAddPaymentRef] = useState('');

  // Menu item picker
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  const [saving, setSaving] = useState(false);
  const [cancelConfirm, setCancelConfirm] = useState(false);
  const [auditLogs, setAuditLogs] = useState<unknown[]>([]);

  useEffect(() => {
    loadOrder();
    loadMenu();
  }, [id]);

  async function loadMenu() {
    try {
      const res = await api.get('/menu');
      setMenuCategories(res.data);
    } catch (_) {}
  }

  async function loadOrder() {
    setLoading(true);
    try {
      const [orderRes, auditRes] = await Promise.all([
        api.get(`/orders/${id}`),
        api.get(`/orders/${id}/audit`),
      ]);
      const o = orderRes.data;
      setOrder(o);
      setEditCustomerName(o.customer_name);
      setEditCustomerPhone(o.customer_phone || '');
      setEditInstructions(o.special_instructions || '');
      setEditItems(o.items.map((i: OrderItem) => ({ ...i })));
      setEditStatus(o.order_status);
      setEditDiscount(String(Number(o.discount) / 100));
      setAuditLogs(auditRes.data);
    } catch (err) {
      toast.error('Order not found');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }

  function handleStartEditing() {
    if (!order) return;
    setEditCustomerName(order.customer_name);
    setEditCustomerPhone(order.customer_phone || '');
    setEditInstructions(order.special_instructions || '');
    setEditItems(order.items.map((i: OrderItem) => ({ ...i })));
    setEditStatus(order.order_status);
    setEditDiscount(String(Number(order.discount) / 100));
    setEditing(true);
  }

  function handleAddItemToOrder(item: { id: string; name: string; price: number }, catName: string) {
    const existingIndex = editItems.findIndex(i => i.menu_item_id === item.id);
    if (existingIndex >= 0) {
      const updated = [...editItems];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        total_price: updated[existingIndex].unit_price * newQty,
      };
      setEditItems(updated);
    } else {
      setEditItems([
        ...editItems,
        {
          menu_item_id: item.id,
          name: item.name,
          category_name: catName,
          unit_price: item.price,
          quantity: 1,
          total_price: item.price,
        }
      ]);
    }
    toast.success(`Added ${item.name}`);
  }

  async function handleSaveEdits() {
    if (!order) return;
    if (!editCustomerName.trim()) {
      toast.error('Customer name is required');
      return;
    }
    if (editItems.length === 0) {
      toast.error('Order must have at least one item');
      return;
    }

    setSaving(true);
    try {
      const res = await api.put(`/orders/${order.id}`, {
        customer_name: editCustomerName.trim(),
        customer_phone: editCustomerPhone.trim(),
        special_instructions: editInstructions.trim(),
        items: editItems,
        discount: parseFloat(editDiscount) || 0,
        order_status: editStatus,
      });
      setOrder(res.data);
      setEditing(false);
      setShowItemPicker(false);
      toast.success('Order updated successfully!');
      loadOrder();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleAddPayment() {
    if (!order || !addPaymentAmount || parseFloat(addPaymentAmount) <= 0) {
      toast.error('Enter a valid payment amount');
      return;
    }
    setSaving(true);
    try {
      await api.post(`/orders/${order.id}/payments`, {
        method: addPaymentMethod,
        amount: parseFloat(addPaymentAmount),
        reference: addPaymentRef,
      });
      setAddPaymentAmount('');
      setAddPaymentRef('');
      toast.success('Payment recorded successfully!');
      loadOrder();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Payment failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setSaving(true);
    try {
      await api.post(`/orders/${order.id}/cancel`, { reason: 'Cancelled by staff' });
      toast.success('Order cancelled');
      loadOrder();
      setCancelConfirm(false);
    } catch (err) {
      toast.error('Failed to cancel');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center h-96 bg-white">
        <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Edit mode calculations
  const editedSubtotal = editItems.reduce((sum, item) => sum + (Number(item.unit_price) * item.quantity), 0);
  const editedDiscountPaise = Math.round((parseFloat(editDiscount) || 0) * 100);
  const editedTotal = Math.max(0, editedSubtotal - editedDiscountPaise);
  const originalTotal = Number(order.total);
  const totalPaid = Number(order.total_paid);
  const diffFromOriginal = editedTotal - originalTotal;
  const newBalanceDue = Math.max(0, editedTotal - totalPaid);
  const refundDue = Math.max(0, totalPaid - editedTotal);

  const cashPaid = (order.payments || []).filter(p => p.payment_method === 'cash' && p.payment_status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);
  const onlinePaid = (order.payments || []).filter(p => (p.payment_method === 'online' || p.payment_method === 'upi') && p.payment_status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-4 md:p-6 bg-[#F9FAFB] text-gray-900 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white border border-gray-200 p-4 rounded-2xl shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/orders')}
              className="text-gray-500 hover:text-gray-900 p-1.5 rounded-xl hover:bg-gray-100 transition-colors"
              title="Back to orders"
            >
              <ArrowLeft size={22} />
            </button>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl md:text-2xl font-black text-gray-900 tracking-tight">Order #{order.daily_order_number}</h1>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getOrderStatusColor(order.order_status)}`}>
                  {order.order_status}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${getPaymentStatusColor(order.payment_status)}`}>
                  {order.payment_status}
                </span>
              </div>
              <p className="text-gray-500 text-xs mt-0.5">Order ID: {order.id} • {formatDateTime(order.created_at)}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/orders/${order.id}/confirmation`)}
              className="flex items-center gap-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors shadow-xs"
            >
              <Printer size={15} />
              <span>Print Receipt</span>
            </button>

            {!editing && order.order_status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleStartEditing}
                className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-xs transition-colors"
              >
                <span>Edit Order</span>
              </button>
            )}

            {editing && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setEditing(false); setShowItemPicker(false); }}
                  className="text-gray-500 hover:text-gray-800 text-xs font-bold px-3 py-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdits}
                  disabled={saving}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs disabled:opacity-50 transition-colors shadow-xs"
                >
                  <Save size={15} />
                  <span>Save Changes</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Editing Mode Alert Banner */}
        {editing && (
          <div className="p-4 rounded-2xl border border-amber-300 bg-amber-50 text-amber-900 flex items-start gap-3 shadow-xs">
            <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <div className="flex-1 text-xs md:text-sm">
              <p className="font-extrabold text-amber-950">Order Edit Mode Active</p>
              <p className="text-amber-800 mt-0.5">
                Modify customer details, add/remove items, adjust quantities, or update discounts. Financial totals update automatically.
              </p>
              {diffFromOriginal > 0 && (
                <p className="mt-1.5 text-amber-900 font-bold flex items-center gap-1">
                  <ArrowUpRight size={16} /> Total increased by {formatINR(diffFromOriginal)}. Additional amount due: {formatINR(newBalanceDue)}.
                </p>
              )}
              {diffFromOriginal < 0 && (
                <p className="mt-1.5 text-blue-800 font-bold flex items-center gap-1">
                  <ArrowDownRight size={16} /> Total reduced by {formatINR(Math.abs(diffFromOriginal))}. {refundDue > 0 ? `Adjustment/Refund Due: ${formatINR(refundDue)}` : ''}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Order Items & Customer */}
          <div className="lg:col-span-2 space-y-5">
            {/* Customer Details */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
              <h2 className="text-gray-900 font-extrabold text-sm mb-3">Customer Information</h2>
              {editing ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-700 font-bold mb-1 block">Customer / Table Name *</label>
                    <input
                      type="text"
                      value={editCustomerName}
                      onChange={e => setEditCustomerName(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:border-amber-500 focus:outline-none shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-700 font-bold mb-1 block">Phone Number</label>
                    <input
                      type="text"
                      value={editCustomerPhone}
                      onChange={e => setEditCustomerPhone(e.target.value)}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:border-amber-500 focus:outline-none shadow-xs"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-700 font-bold mb-1 block">Special Instructions</label>
                    <textarea
                      value={editInstructions}
                      onChange={e => setEditInstructions(e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:border-amber-500 focus:outline-none resize-none shadow-xs"
                    />
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 text-xs md:text-sm">
                  <div>
                    <p className="text-gray-500 font-medium">Customer</p>
                    <p className="text-gray-900 font-bold mt-0.5">{order.customer_name}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium">Phone</p>
                    <p className="text-gray-900 font-semibold mt-0.5">{order.customer_phone || '-'}</p>
                  </div>
                  {order.special_instructions && (
                    <div className="col-span-2 bg-amber-50 border border-amber-200 p-3 rounded-xl mt-1">
                      <p className="text-amber-900 font-bold text-xs">Customer Request:</p>
                      <p className="text-amber-800 text-xs mt-0.5 italic">{order.special_instructions}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 md:p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                <h2 className="text-gray-900 font-extrabold text-sm">Order Items ({(editing ? editItems : order.items).length})</h2>
                {editing && (
                  <button
                    type="button"
                    onClick={() => setShowItemPicker(!showItemPicker)}
                    className="flex items-center gap-1.5 text-amber-700 hover:text-amber-800 text-xs font-bold bg-amber-100 hover:bg-amber-200 px-3 py-1.5 rounded-xl border border-amber-300 transition-colors"
                  >
                    <PlusCircle size={15} />
                    <span>Add Item</span>
                  </button>
                )}
              </div>

              {/* In-Line Menu Item Picker */}
              {editing && showItemPicker && (
                <div className="p-4 bg-gray-50 border-b border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold text-gray-800 uppercase tracking-wider">Select Item from Menu</p>
                    <button type="button" onClick={() => setShowItemPicker(false)} className="text-gray-400 hover:text-gray-700">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      value={pickerSearch}
                      onChange={e => setPickerSearch(e.target.value)}
                      placeholder="Search pizza, pasta, cold coffee..."
                      className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 shadow-xs"
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {menuCategories.flatMap(c => c.items.map(i => ({ ...i, catName: c.name })))
                      .filter(i => !pickerSearch || i.name.toLowerCase().includes(pickerSearch.toLowerCase()) || i.catName.toLowerCase().includes(pickerSearch.toLowerCase()))
                      .slice(0, 15)
                      .map(item => (
                        <div key={item.id} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-gray-200 hover:border-amber-400 transition-colors text-xs shadow-2xs">
                          <div>
                            <p className="text-gray-900 font-bold">{item.name}</p>
                            <p className="text-gray-500 text-[11px]">{item.catName}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-amber-700 font-black">{formatINR(item.price)}</span>
                            <button
                              type="button"
                              onClick={() => handleAddItemToOrder(item, item.catName)}
                              className="bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1 rounded-lg font-bold transition-colors"
                            >
                              + Add
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Item Rows */}
              <div className="divide-y divide-gray-100">
                {(editing ? editItems : order.items).map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-gray-900 text-sm font-bold truncate">{item.name}</p>
                        {item.status && (
                          <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                            item.status === 'served' ? 'bg-gray-100 text-gray-700 border border-gray-300' :
                            item.status === 'ready' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                            item.status === 'preparing' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                            'bg-gray-100 text-gray-500'
                          }`}>
                            {item.status}
                          </span>
                        )}
                      </div>
                      <p className="text-gray-500 text-xs">{formatINR(Number(item.unit_price))} each</p>
                    </div>

                    {editing ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...editItems];
                            if (updated[idx].quantity <= 1) {
                              updated.splice(idx, 1);
                            } else {
                              const q = updated[idx].quantity - 1;
                              updated[idx] = { ...updated[idx], quantity: q, total_price: updated[idx].unit_price * q };
                            }
                            setEditItems(updated);
                          }}
                          className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 border border-gray-200 font-bold"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-gray-900 font-bold w-6 text-center text-sm">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => {
                            const updated = [...editItems];
                            const q = updated[idx].quantity + 1;
                            updated[idx] = { ...updated[idx], quantity: q, total_price: updated[idx].unit_price * q };
                            setEditItems(updated);
                          }}
                          className="w-7 h-7 rounded-lg bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 border border-gray-200 font-bold"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                          className="text-gray-400 hover:text-red-600 p-1 rounded-lg ml-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    ) : (
                      <span className="text-gray-600 font-bold text-sm">×{item.quantity}</span>
                    )}

                    <p className="text-gray-900 font-black text-sm w-20 text-right">
                      {formatINR(Number(item.unit_price) * item.quantity)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Bill Totals Summary */}
              <div className="p-4 md:p-5 bg-gray-50/70 border-t border-gray-200 space-y-2 text-xs md:text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal</span>
                  <span className="font-semibold text-gray-800">{formatINR(editing ? editedSubtotal : Number(order.subtotal))}</span>
                </div>

                {editing ? (
                  <div className="flex items-center justify-between text-xs md:text-sm">
                    <span className="text-gray-600">Discount (₹)</span>
                    <input
                      type="number"
                      value={editDiscount}
                      onChange={e => setEditDiscount(e.target.value)}
                      placeholder="0"
                      min="0"
                      step="1"
                      className="w-24 bg-white border border-gray-300 rounded-lg px-2 py-1 text-right text-emerald-600 font-bold text-sm focus:border-amber-500 focus:outline-none shadow-xs"
                    />
                  </div>
                ) : (
                  Number(order.discount) > 0 && (
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Discount</span>
                      <span>-{formatINR(Number(order.discount))}</span>
                    </div>
                  )
                )}

                <div className="flex justify-between text-gray-900 font-black text-base border-t border-gray-200 pt-2">
                  <span>{editing ? 'Updated Total' : 'Total'}</span>
                  <span className="text-amber-600 font-black text-xl">
                    {formatINR(editing ? editedTotal : Number(order.total))}
                  </span>
                </div>

                {editing && diffFromOriginal !== 0 && (
                  <div className="flex justify-between text-xs text-gray-500 pt-1">
                    <span>Previous Total: {formatINR(originalTotal)}</span>
                    <span className={diffFromOriginal > 0 ? 'text-amber-700 font-bold' : 'text-blue-700 font-bold'}>
                      Diff: {diffFromOriginal > 0 ? `+${formatINR(diffFromOriginal)}` : formatINR(diffFromOriginal)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Edit */}
            {editing && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <h2 className="text-gray-900 font-extrabold text-sm mb-3">Update Order Status</h2>
                <div className="flex gap-2 flex-wrap">
                  {ORDER_STATUSES.map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditStatus(s)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all capitalize border ${
                        editStatus === s
                          ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                          : 'bg-white text-gray-600 hover:text-gray-900 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Audit Log */}
            {auditLogs.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <h2 className="text-gray-900 font-extrabold text-sm mb-3">Audit Trail</h2>
                <div className="space-y-2">
                  {(auditLogs as { id: string; action: string; full_name?: string; created_at: string; new_values?: string }[]).map((log) => (
                    <div key={log.id} className="flex items-center gap-3 text-xs text-gray-600 py-1.5 border-b border-gray-100 last:border-0">
                      <span className="bg-amber-100 text-amber-900 px-2 py-0.5 rounded-md font-bold capitalize">{log.action}</span>
                      <span>by <strong className="text-gray-800">{log.full_name || 'Staff'}</strong></span>
                      <span className="ml-auto text-gray-400 font-medium">{formatDateTime(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Payments & Actions */}
          <div className="space-y-5">
            {/* Payment Summary */}
            <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
              <h2 className="text-gray-900 font-extrabold text-sm mb-4">Payment Summary</h2>
              <div className="space-y-2 text-xs md:text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>Cash Received</span>
                  <span className="font-semibold text-gray-800">{formatINR(cashPaid)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>Online / UPI Received</span>
                  <span className="font-semibold text-gray-800">{formatINR(onlinePaid)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2">
                  <span className="font-bold text-gray-800">Total Paid</span>
                  <span className="text-emerald-600 font-black">{formatINR(totalPaid)}</span>
                </div>
                {Number(order.balance_due) > 0 && (
                  <div className="flex justify-between border-t border-gray-100 pt-2">
                    <span className="font-bold text-red-600">Balance Due</span>
                    <span className="text-red-600 font-black">{formatINR(Number(order.balance_due))}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${getPaymentStatusColor(order.payment_status)}`}>
                  {order.payment_status}
                </span>
                <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${getOrderStatusColor(order.order_status)}`}>
                  {order.order_status}
                </span>
              </div>
            </div>

            {/* Add Remaining Payment */}
            {Number(order.balance_due) > 0 && order.order_status !== 'cancelled' && (
              <div className="bg-white border border-amber-300 rounded-2xl p-5 shadow-sm space-y-3">
                <h2 className="text-gray-900 font-extrabold text-sm">Collect Outstanding Balance</h2>
                <p className="text-red-600 text-sm font-black">Due: {formatINR(Number(order.balance_due))}</p>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    {(['cash', 'online'] as const).map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAddPaymentMethod(m)}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold capitalize transition-colors border ${
                          addPaymentMethod === m
                            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                            : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                        }`}
                      >
                        {m === 'online' ? 'UPI / Online' : 'Cash'}
                      </button>
                    ))}
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600 font-bold">Amount (₹)</span>
                      <button
                        type="button"
                        onClick={() => setAddPaymentAmount((Number(order.balance_due) / 100).toFixed(2))}
                        className="text-xs text-amber-700 font-bold hover:underline"
                      >
                        Full Due (₹{(Number(order.balance_due) / 100).toFixed(2)})
                      </button>
                    </div>
                    <input
                      type="number"
                      value={addPaymentAmount}
                      onChange={e => setAddPaymentAmount(e.target.value)}
                      placeholder="0.00"
                      min="0"
                      step="1"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-sm focus:outline-none focus:border-amber-500 font-bold shadow-xs"
                    />
                  </div>

                  {addPaymentMethod === 'online' && (
                    <input
                      type="text"
                      value={addPaymentRef}
                      onChange={e => setAddPaymentRef(e.target.value)}
                      placeholder="UPI Ref / Transaction ID (Optional)"
                      className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:border-amber-500 shadow-xs"
                    />
                  )}

                  <button
                    type="button"
                    onClick={handleAddPayment}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl text-xs md:text-sm font-black disabled:opacity-50 transition-colors shadow-md active:scale-[0.99]"
                  >
                    <CreditCard size={16} />
                    <span>Confirm & Record Payment</span>
                  </button>
                </div>
              </div>
            )}

            {/* Payment History List */}
            {(order.payments || []).length > 0 && (
              <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
                <h2 className="text-gray-900 font-extrabold text-sm mb-3">Payment History</h2>
                <div className="space-y-2">
                  {order.payments.map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs py-2 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="text-gray-900 font-bold capitalize">{p.payment_method}</span>
                        {p.reference && <span className="text-gray-500 ml-1.5 font-mono text-[11px]">Ref: {p.reference}</span>}
                      </div>
                      <div className="text-right">
                        <p className="text-emerald-700 font-black">{formatINR(Number(p.amount))}</p>
                        <p className="text-gray-400 text-[10px]">{formatDateTime(p.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Cancel Order Section */}
            {order.order_status !== 'cancelled' && (
              <div>
                {!cancelConfirm ? (
                  <button
                    type="button"
                    onClick={() => setCancelConfirm(true)}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 py-3 rounded-2xl text-xs font-bold transition-colors shadow-xs"
                  >
                    <Ban size={16} />
                    <span>Cancel Order</span>
                  </button>
                ) : (
                  <div className="bg-red-50 border border-red-200 rounded-2xl p-4 shadow-xs">
                    <p className="text-red-900 text-xs font-bold mb-3">Are you sure you want to cancel this order?</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCancelConfirm(false)}
                        className="flex-1 bg-white hover:bg-gray-100 text-gray-700 border border-gray-200 py-2 rounded-xl text-xs font-bold"
                      >
                        Keep Order
                      </button>
                      <button
                        type="button"
                        onClick={handleCancel}
                        disabled={saving}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-xl text-xs font-black disabled:opacity-50"
                      >
                        Confirm Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
