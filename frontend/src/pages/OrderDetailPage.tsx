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
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
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

  const cashPaid = order.payments.filter(p => p.payment_method === 'cash' && p.payment_status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);
  const onlinePaid = order.payments.filter(p => p.payment_method === 'online' && p.payment_status === 'confirmed').reduce((s, p) => s + Number(p.amount), 0);

  return (
    <div className="p-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={22} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">Order #{order.daily_order_number}</h1>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getOrderStatusColor(order.order_status)}`}>
                {order.order_status}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                {order.payment_status}
              </span>
            </div>
            <p className="text-gray-500 text-sm mt-0.5">Order ID: {order.id} • {formatDateTime(order.created_at)}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(`/orders/${order.id}/confirmation`)}
            className="flex items-center gap-2 bg-[#1e1e1e] border border-[#2a2a2a] text-gray-300 hover:text-white px-3 py-2 rounded-lg text-sm transition-colors"
          >
            <Printer size={16} /> Print Receipt
          </button>

          {!editing && order.order_status !== 'cancelled' && (
            <button
              onClick={handleStartEditing}
              className="flex items-center gap-2 bg-yellow-400 text-black font-semibold px-4 py-2 rounded-lg text-sm hover:bg-yellow-300 transition-colors"
            >
              Edit Order
            </button>
          )}

          {editing && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setEditing(false); setShowItemPicker(false); }}
                className="text-gray-400 hover:text-white text-sm px-3 py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdits}
                disabled={saving}
                className="flex items-center gap-2 bg-green-500 text-white font-semibold px-4 py-2 rounded-lg text-sm hover:bg-green-600 disabled:opacity-50 transition-colors"
              >
                <Save size={16} /> Save Changes
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editing Mode Alert Banner */}
      {editing && (
        <div className="mb-6 p-4 rounded-xl border border-yellow-400/30 bg-yellow-400/10 text-yellow-300 flex items-start gap-3">
          <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-yellow-400" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-white">Order Edit Mode Active</p>
            <p className="text-gray-300 mt-0.5">
              You can modify customer details, add/remove items, adjust quantities, or apply discounts. Any difference from original payments is computed automatically.
            </p>
            {diffFromOriginal > 0 && (
              <p className="mt-2 text-orange-400 font-semibold flex items-center gap-1">
                <ArrowUpRight size={16} /> Total increased by {formatINR(diffFromOriginal)}. Additional amount due: {formatINR(newBalanceDue)}.
              </p>
            )}
            {diffFromOriginal < 0 && (
              <p className="mt-2 text-blue-400 font-semibold flex items-center gap-1">
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
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Customer Details</h2>
            {editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Customer / Order Name *</label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={e => setEditCustomerName(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Phone Number</label>
                  <input
                    type="text"
                    value={editCustomerPhone}
                    onChange={e => setEditCustomerPhone(e.target.value)}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Special Instructions</label>
                  <textarea
                    value={editInstructions}
                    onChange={e => setEditInstructions(e.target.value)}
                    rows={2}
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:border-yellow-400 focus:outline-none resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500">Name</p>
                  <p className="text-white font-medium">{order.customer_name}</p>
                </div>
                <div>
                  <p className="text-gray-500">Phone</p>
                  <p className="text-white">{order.customer_phone || '-'}</p>
                </div>
                {order.special_instructions && (
                  <div className="col-span-2">
                    <p className="text-gray-500">Special Instructions</p>
                    <p className="text-white">{order.special_instructions}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Order Items */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl overflow-hidden">
            <div className="p-5 border-b border-[#2a2a2a] flex items-center justify-between">
              <h2 className="text-white font-semibold">Order Items</h2>
              {editing && (
                <button
                  type="button"
                  onClick={() => setShowItemPicker(!showItemPicker)}
                  className="flex items-center gap-1.5 text-yellow-400 text-sm font-semibold hover:underline"
                >
                  <PlusCircle size={16} /> Add More Items
                </button>
              )}
            </div>

            {/* In-Line Menu Item Picker */}
            {editing && showItemPicker && (
              <div className="p-4 bg-[#1a1a1a] border-b border-[#2a2a2a]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white">Select Menu Item to Add</p>
                  <button onClick={() => setShowItemPicker(false)} className="text-gray-400 hover:text-white">
                    <X size={16} />
                  </button>
                </div>
                <div className="relative mb-3">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={pickerSearch}
                    onChange={e => setPickerSearch(e.target.value)}
                    placeholder="Search menu..."
                    className="w-full bg-[#242424] border border-[#333] rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400"
                  />
                </div>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {menuCategories.flatMap(c => c.items.map(i => ({ ...i, catName: c.name })))
                    .filter(i => !pickerSearch || i.name.toLowerCase().includes(pickerSearch.toLowerCase()) || i.catName.toLowerCase().includes(pickerSearch.toLowerCase()))
                    .slice(0, 15)
                    .map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-[#141414] hover:bg-[#202020] transition-colors text-xs">
                        <div>
                          <p className="text-white font-medium">{item.name}</p>
                          <p className="text-gray-500">{item.catName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-yellow-400 font-semibold">{formatINR(item.price)}</span>
                          <button
                            type="button"
                            onClick={() => handleAddItemToOrder(item, item.catName)}
                            className="bg-yellow-400 hover:bg-yellow-300 text-black px-2.5 py-1 rounded font-bold transition-colors"
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
            <div className="divide-y divide-[#2a2a2a]">
              {(editing ? editItems : order.items).map((item, idx) => (
                <div key={idx} className="flex items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{item.name}</p>
                      {item.status && (
                        <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                          item.status === 'served' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' :
                          item.status === 'ready' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                          item.status === 'preparing' ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                          'bg-gray-700/50 text-gray-400'
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
                        className="w-7 h-7 rounded bg-[#2a2a2a] text-white flex items-center justify-center hover:bg-[#3a3a3a]"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="text-white font-medium w-6 text-center text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = [...editItems];
                          const q = updated[idx].quantity + 1;
                          updated[idx] = { ...updated[idx], quantity: q, total_price: updated[idx].unit_price * q };
                          setEditItems(updated);
                        }}
                        className="w-7 h-7 rounded bg-[#2a2a2a] text-white flex items-center justify-center hover:bg-[#3a3a3a]"
                      >
                        <Plus size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditItems(editItems.filter((_, i) => i !== idx))}
                        className="text-red-400 hover:text-red-300 ml-1"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 text-sm">×{item.quantity}</span>
                  )}
                  <p className="text-yellow-400 font-semibold text-sm w-20 text-right">
                    {formatINR(Number(item.unit_price) * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            {/* Bill Totals Summary */}
            <div className="p-5 bg-[#1e1e1e] space-y-2 text-sm">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span>{formatINR(editing ? editedSubtotal : Number(order.subtotal))}</span>
              </div>

              {editing ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Discount (₹)</span>
                  <input
                    type="number"
                    value={editDiscount}
                    onChange={e => setEditDiscount(e.target.value)}
                    placeholder="0"
                    min="0"
                    step="0.01"
                    className="w-24 bg-[#141414] border border-[#333] rounded px-2 py-1 text-right text-green-400 text-sm focus:border-yellow-400 focus:outline-none"
                  />
                </div>
              ) : (
                Number(order.discount) > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-{formatINR(Number(order.discount))}</span>
                  </div>
                )
              )}

              <div className="flex justify-between text-white font-bold text-base border-t border-[#2a2a2a] pt-2">
                <span>{editing ? 'Updated Total' : 'Total'}</span>
                <span className="text-yellow-400">
                  {formatINR(editing ? editedTotal : Number(order.total))}
                </span>
              </div>

              {editing && diffFromOriginal !== 0 && (
                <div className="flex justify-between text-xs text-gray-400 pt-1">
                  <span>Previous Total: {formatINR(originalTotal)}</span>
                  <span className={diffFromOriginal > 0 ? 'text-orange-400' : 'text-blue-400'}>
                    Diff: {diffFromOriginal > 0 ? `+${formatINR(diffFromOriginal)}` : formatINR(diffFromOriginal)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Status Edit */}
          {editing && (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-3">Update Order Status</h2>
              <div className="flex gap-2 flex-wrap">
                {ORDER_STATUSES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setEditStatus(s)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                      editStatus === s ? 'bg-yellow-400 text-black font-bold' : 'bg-[#1e1e1e] text-gray-400 hover:text-white'
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
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-3">Audit Trail</h2>
              <div className="space-y-2">
                {(auditLogs as { id: string; action: string; full_name?: string; created_at: string; new_values?: string }[]).map((log) => (
                  <div key={log.id} className="flex items-center gap-3 text-xs text-gray-400 py-1 border-b border-[#222] last:border-0">
                    <span className="bg-[#2a2a2a] px-2 py-0.5 rounded text-yellow-400 font-medium capitalize">{log.action}</span>
                    <span>by <strong className="text-gray-300">{log.full_name || 'Staff'}</strong></span>
                    <span className="ml-auto text-gray-500">{formatDateTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Payments & Actions */}
        <div className="space-y-5">
          {/* Payment Summary */}
          <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
            <h2 className="text-white font-semibold mb-4">Payment Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Cash Received</span>
                <span className="text-white font-medium">{formatINR(cashPaid)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Online/UPI Received</span>
                <span className="text-white font-medium">{formatINR(onlinePaid)}</span>
              </div>
              <div className="flex justify-between border-t border-[#2a2a2a] pt-2">
                <span className="text-gray-400">Total Paid</span>
                <span className="text-green-400 font-bold">{formatINR(totalPaid)}</span>
              </div>
              {Number(order.balance_due) > 0 && (
                <div className="flex justify-between">
                  <span className="text-gray-400">Balance Due</span>
                  <span className="text-red-400 font-bold">{formatINR(Number(order.balance_due))}</span>
                </div>
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${getPaymentStatusColor(order.payment_status)}`}>
                {order.payment_status}
              </span>
              <span className={`text-xs px-3 py-1 rounded-full font-medium ${getOrderStatusColor(order.order_status)}`}>
                {order.order_status}
              </span>
            </div>
          </div>

          {/* Add Remaining Payment */}
          {Number(order.balance_due) > 0 && order.order_status !== 'cancelled' && (
            <div className="bg-[#141414] border border-yellow-400/30 rounded-xl p-5">
              <h2 className="text-white font-semibold mb-2">Collect Outstanding Balance</h2>
              <p className="text-red-400 text-sm font-semibold mb-3">Balance Due: {formatINR(Number(order.balance_due))}</p>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {(['cash', 'online'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAddPaymentMethod(m)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                        addPaymentMethod === m ? 'bg-yellow-400 text-black' : 'bg-[#1e1e1e] text-gray-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Amount (₹)</span>
                    <button
                      type="button"
                      onClick={() => setAddPaymentAmount((Number(order.balance_due) / 100).toFixed(2))}
                      className="text-xs text-yellow-400 hover:underline"
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
                    step="0.01"
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400 font-semibold"
                  />
                </div>
                {addPaymentMethod === 'online' && (
                  <input
                    type="text"
                    value={addPaymentRef}
                    onChange={e => setAddPaymentRef(e.target.value)}
                    placeholder="UPI Reference / Transaction ID"
                    className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-yellow-400"
                  />
                )}
                <button
                  onClick={handleAddPayment}
                  disabled={saving}
                  className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white py-3 rounded-lg text-sm font-bold hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  <CreditCard size={16} /> Confirm & Record Payment
                </button>
              </div>
            </div>
          )}

          {/* Payment History List */}
          {order.payments.length > 0 && (
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5">
              <h2 className="text-white font-semibold mb-3">Payment Records</h2>
              <div className="space-y-2">
                {order.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-xs py-1.5 border-b border-[#222] last:border-0">
                    <div>
                      <span className="text-white font-medium capitalize">{p.payment_method}</span>
                      {p.reference && <span className="text-gray-500 ml-1.5">Ref: {p.reference}</span>}
                    </div>
                    <div className="text-right">
                      <p className="text-yellow-400 font-bold">{formatINR(Number(p.amount))}</p>
                      <p className="text-gray-500 text-[10px]">{formatDateTime(p.created_at)}</p>
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
                  onClick={() => setCancelConfirm(true)}
                  className="w-full flex items-center justify-center gap-2 border border-red-500/30 text-red-400 hover:bg-red-500/10 py-2.5 rounded-xl text-sm transition-colors font-medium"
                >
                  <Ban size={16} /> Cancel Order
                </button>
              ) : (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <p className="text-red-300 text-sm mb-3 font-semibold">Are you sure you want to cancel this order?</p>
                  <div className="flex gap-2">
                    <button onClick={() => setCancelConfirm(false)} className="flex-1 bg-[#1e1e1e] text-white py-2 rounded-lg text-sm">Keep Order</button>
                    <button onClick={handleCancel} disabled={saving} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-semibold disabled:opacity-50">Confirm Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
