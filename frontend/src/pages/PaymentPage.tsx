import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCafe } from '../contexts/CafeContext';
import { useAuth } from '../contexts/AuthContext';
import { formatINR } from '../lib/utils';
import {
  ArrowLeft, Smartphone, Banknote, Split, CheckCircle,
  QrCode, Sparkles, AlertCircle, ShieldCheck, UserCheck
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';

type PaymentMode = 'cash' | 'online' | 'split';

export default function PaymentPage() {
  const navigate = useNavigate();
  const { user, isKitchen, logout } = useAuth();
  const { settings, qrUrl } = useCafe();
  const {
    items, customerName, customerPhone, discount, specialInstructions,
    total, subtotal, clearCart
  } = useCart();

  const [paymentMode, setPaymentMode] = useState<PaymentMode>('cash');
  const [cashAmount, setCashAmount] = useState('');
  const [onlineAmount, setOnlineAmount] = useState('');
  const [onlineRef, setOnlineRef] = useState('');
  const [dynamicQrUrl, setDynamicQrUrl] = useState<string>('');
  const [qrViewMode, setQrViewMode] = useState<'standee' | 'dynamic'>('standee');
  const [upiConfirmed, setUpiConfirmed] = useState(false);
  const [placing, setPlacing] = useState(false);
  const isSubmittingRef = useRef(false);

  const totalRupees = total / 100;

  useEffect(() => {
    if (items.length === 0) {
      navigate('/new-order');
      return;
    }
    // Default to Cash = full total bill
    setCashAmount(totalRupees.toFixed(2));
    setOnlineAmount('0.00');
  }, [items.length, totalRupees, navigate]);

  // Mode Selection with smart initial values
  const handleSelectMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    setUpiConfirmed(false);
    if (mode === 'cash') {
      setCashAmount(totalRupees.toFixed(2));
      setOnlineAmount('0.00');
    } else if (mode === 'online') {
      setOnlineAmount(totalRupees.toFixed(2));
      setCashAmount('0.00');
    } else {
      // Split mode: default half or cash = 0, upi = total
      const initialCash = Math.min(100, Math.floor(totalRupees / 2));
      const remainingUpi = Math.max(0, totalRupees - initialCash);
      setCashAmount(initialCash > 0 ? initialCash.toFixed(2) : '0.00');
      setOnlineAmount(remainingUpi.toFixed(2));
    }
  };

  // Interactive Split Calculator:
  // When cash is edited, immediately update remaining UPI amount!
  const handleCashChange = (val: string) => {
    setCashAmount(val);
    if (paymentMode === 'split') {
      const parsedCash = parseFloat(val);
      if (!isNaN(parsedCash) && parsedCash >= 0) {
        const remainingForUpi = Math.max(0, totalRupees - parsedCash);
        setOnlineAmount(remainingForUpi.toFixed(2));
      } else if (val === '') {
        setOnlineAmount(totalRupees.toFixed(2));
      }
    }
  };

  // When UPI amount is edited in split mode, immediately update remaining Cash amount!
  const handleOnlineChange = (val: string) => {
    setOnlineAmount(val);
    if (paymentMode === 'split') {
      const parsedUpi = parseFloat(val);
      if (!isNaN(parsedUpi) && parsedUpi >= 0) {
        const remainingForCash = Math.max(0, totalRupees - parsedUpi);
        setCashAmount(remainingForCash.toFixed(2));
      } else if (val === '') {
        setCashAmount(totalRupees.toFixed(2));
      }
    }
  };

  const parsedCash = parseFloat(cashAmount) || 0;
  const parsedOnline = parseFloat(onlineAmount) || 0;

  // Active payment inputs according to selected mode
  const activeCash = paymentMode === 'online' ? 0 : parsedCash;
  const activeOnline = paymentMode === 'cash' ? 0 : parsedOnline;

  const totalReceived = activeCash + activeOnline;
  // Formula: Remaining Balance = Total Bill − Total Confirmed Payments
  const remainingBalance = Math.max(0, totalRupees - totalReceived);
  const isOverpaid = totalReceived > totalRupees + 0.01;

  // Generate dynamic QR code matching the exact active UPI amount needed!
  useEffect(() => {
    const upiTargetAmount = activeOnline > 0 ? activeOnline : (remainingBalance > 0 ? remainingBalance : totalRupees);
    const upiId = settings.upi_id || 'thecheesyslice@okaxis';
    const upiString = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(settings.cafe_name || 'The Cheesy Slice')}&am=${upiTargetAmount.toFixed(2)}&cu=INR`;

    QRCode.toDataURL(upiString, {
      width: 240,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
      .then(url => setDynamicQrUrl(url))
      .catch(err => console.error('Failed to generate UPI QR:', err));
  }, [activeOnline, remainingBalance, totalRupees, settings.upi_id, settings.cafe_name]);

  function getPaymentsList() {
    const payments = [];
    if (activeCash > 0) {
      payments.push({ method: 'cash', amount: activeCash, reference: '' });
    }
    if (activeOnline > 0) {
      payments.push({ method: 'online', amount: activeOnline, reference: onlineRef.trim() });
    }
    return payments;
  }

  async function handleConfirmAndPlace() {
    if (isSubmittingRef.current || placing) return; // Prevent double-click race conditions

    if (!customerName.trim()) {
      toast.error('Customer / Table name is required');
      navigate('/cart');
      return;
    }

    if (isOverpaid) {
      toast.error('Overpayment detected. Please adjust payment amounts.');
      return;
    }

    // If online payment is included, prompt for confirmation if not checked
    if (activeOnline > 0 && !upiConfirmed) {
      toast.error('Please verify that the UPI payment has been received and tick the confirmation box.');
      return;
    }

    isSubmittingRef.current = true;
    setPlacing(true);
    try {
      const payload = {
        customer_name: customerName.trim(),
        customer_phone: customerPhone?.trim() || '',
        special_instructions: specialInstructions?.trim() || '',
        items: items.map(i => ({
          menu_item_id: i.menu_item_id,
          name: i.name,
          category_name: i.category_name,
          unit_price: i.unit_price,
          quantity: i.quantity,
        })),
        discount: discount / 100, // convert paise to rupees
        payments: getPaymentsList(),
      };

      const res = await api.post('/orders', payload);
      clearCart();
      toast.success(`Order #${res.data.daily_order_number} created and sent to kitchen!`);
      navigate(`/orders/${res.data.id}/confirmation`, { state: { order: res.data } });
    } catch (err: unknown) {
      const error = err as { response?: { status?: number; data?: { error?: string } } };
      if (error?.response?.status === 403) {
        toast.error(`Insufficient permissions: Account @${user?.username || 'user'} is not authorized to create orders. Please log in with a Cashier account.`);
      } else {
        toast.error(error?.response?.data?.error || 'Failed to place order. Your cart is preserved.');
      }
    } finally {
      setPlacing(false);
      isSubmittingRef.current = false;
    }
  }

  if (isKitchen) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center text-gray-900">
        <div className="bg-white border border-gray-200 p-6 rounded-3xl max-w-md shadow-xl">
          <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 border border-orange-200 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-gray-900 font-black text-lg mb-2">Kitchen Account Active</h2>
          <p className="text-gray-600 text-xs mb-5">
            You are currently signed in as <strong className="text-gray-900">@{user?.username}</strong> ({user?.role?.toUpperCase()}).
            Kitchen accounts cannot create orders or collect payments. Please switch to a Cashier account.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate('/kitchen')}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white py-2.5 rounded-xl font-bold text-xs transition-colors shadow-xs"
            >
              Go to Kitchen Display (KDS)
            </button>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full bg-gray-50 hover:bg-gray-100 border border-gray-200 text-gray-700 py-2.5 rounded-xl font-bold text-xs transition-colors"
            >
              Log Out & Sign In as Cashier
            </button>
          </div>
        </div>
      </div>
    );
  }

  const modeButtons = [
    { mode: 'cash' as PaymentMode, label: 'Cash Only', icon: Banknote },
    { mode: 'online' as PaymentMode, label: 'UPI / Online', icon: Smartphone },
    { mode: 'split' as PaymentMode, label: 'Cash + UPI Split', icon: Split },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-[#F9FAFB] text-gray-900">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-gray-200 bg-white sticky top-0 z-10 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => navigate('/cart')}
            className="text-gray-500 hover:text-gray-900 p-1.5 rounded-xl hover:bg-gray-100 transition-colors flex-shrink-0"
            title="Back to cart"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-gray-900 truncate">Payment & Settlement</h1>
            <p className="text-gray-500 text-xs truncate">
              Order for: <span className="text-amber-700 font-bold">{customerName}</span>
            </p>
          </div>
        </div>

        {user && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-semibold flex-shrink-0">
            <UserCheck size={14} className="text-emerald-600" />
            <span>Cashier: <strong className="text-gray-900">@{user.username}</strong></span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-28">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Bill Overview Header */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-sm text-gray-500 pb-3 border-b border-gray-100">
              <span>Subtotal ({items.length} items)</span>
              <span className="font-semibold text-gray-800">{formatINR(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-xs text-emerald-600 py-2 border-b border-gray-100 font-semibold">
                <span>Discount Applied</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3">
              <span className="text-gray-900 font-extrabold text-base">Total Payable</span>
              <span className="text-2xl font-black text-amber-600">{formatINR(total)}</span>
            </div>
          </div>

          {/* Payment Method Switcher */}
          <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 shadow-xs">
            <h2 className="text-gray-900 font-extrabold text-sm mb-3">Select Payment Method</h2>
            <div className="grid grid-cols-3 gap-2">
              {modeButtons.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSelectMode(mode)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-bold transition-all ${
                    paymentMode === mode
                      ? 'border-amber-500 bg-amber-50 text-amber-900 ring-2 ring-amber-400/20 shadow-xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon size={18} className={paymentMode === mode ? 'text-amber-600' : 'text-gray-400'} />
                  <span className="text-center">{label}</span>
                </button>
              ))}
            </div>

            {/* Split Mode Helper Notice */}
            {paymentMode === 'split' && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
                <Sparkles size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Split Calculator:</strong> Enter any amount in Cash or UPI. The remaining balance automatically syncs to the other field and updates the QR code instantly!
                </p>
              </div>
            )}
          </div>

          {/* Cash Input Section */}
          {(paymentMode === 'cash' || paymentMode === 'split') && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Banknote size={16} className="text-emerald-600" />
                  <span>Cash Received (₹)</span>
                </label>
                {paymentMode === 'split' && (
                  <button
                    type="button"
                    onClick={() => handleCashChange(totalRupees.toFixed(2))}
                    className="text-xs text-amber-600 font-bold hover:underline"
                  >
                    All in Cash (₹{totalRupees.toFixed(2)})
                  </button>
                )}
              </div>
              <input
                type="number"
                value={cashAmount}
                onChange={e => handleCashChange(e.target.value)}
                placeholder="0.00"
                min="0"
                step="1"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 font-black text-xl focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs"
              />
            </div>
          )}

          {/* UPI Section & Dynamic QR */}
          {(paymentMode === 'online' || paymentMode === 'split') && (
            <div className="bg-white border border-gray-200 rounded-2xl p-4 md:p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                  <Smartphone size={16} className="text-blue-600" />
                  <span>UPI Payment Required (₹)</span>
                </label>
                {paymentMode === 'split' && (
                  <button
                    type="button"
                    onClick={() => handleOnlineChange(totalRupees.toFixed(2))}
                    className="text-xs text-amber-600 font-bold hover:underline"
                  >
                    All in UPI (₹{totalRupees.toFixed(2)})
                  </button>
                )}
              </div>

              <input
                type="number"
                value={onlineAmount}
                onChange={e => handleOnlineChange(e.target.value)}
                placeholder="0.00"
                min="0"
                step="1"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 font-black text-xl focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500 shadow-xs"
              />

              {/* QR Code Presentation Box */}
              <div className="bg-white rounded-2xl p-5 text-center text-gray-900 border border-gray-200 shadow-sm space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-gray-700 uppercase tracking-wider">
                    <QrCode size={16} className="text-amber-600" />
                    <span>Scan & Pay via UPI</span>
                  </div>

                  {/* Toggle between Standee QR and Dynamic QR */}
                  <div className="flex items-center p-0.5 bg-gray-100 rounded-lg text-[11px] font-semibold border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setQrViewMode('standee')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        qrViewMode === 'standee'
                          ? 'bg-blue-600 text-white shadow-xs font-bold'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Paytm Standee
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrViewMode('dynamic')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        qrViewMode === 'dynamic'
                          ? 'bg-amber-500 text-white shadow-xs font-bold'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Exact (₹) QR
                    </button>
                  </div>
                </div>

                <div className="w-56 h-64 mx-auto bg-gray-50 rounded-2xl p-2 border border-gray-200 flex items-center justify-center overflow-hidden shadow-xs">
                  {qrViewMode === 'standee' && qrUrl ? (
                    <img
                      src={qrUrl}
                      alt="Paytm UPI QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : dynamicQrUrl ? (
                    <img
                      src={dynamicQrUrl}
                      alt="Dynamic UPI QR Code"
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-center p-4">
                      <QrCode size={40} className="mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-500 font-medium">QR Code not uploaded</p>
                    </div>
                  )}
                </div>

                {/* Highlighted UPI exact amount to pay */}
                <div className="bg-amber-50 text-amber-950 py-2.5 px-3 rounded-xl border border-amber-200 shadow-2xs">
                  <p className="text-xs text-gray-600 font-medium">Exact Amount Required:</p>
                  <p className="text-2xl font-black text-gray-900 mt-0.5">
                    {formatINR(Math.round(activeOnline * 100))}
                  </p>
                  {settings.upi_id && (
                    <p className="text-xs font-mono text-gray-700 mt-1 font-bold">UPI ID: {settings.upi_id}</p>
                  )}
                </div>

                <p className="text-[11px] text-gray-500 font-medium">Supports Paytm • PhonePe • Google Pay • BHIM • Cred UPI</p>
              </div>

              {/* UPI Reference Number */}
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1.5 block">UPI Reference / UTR Number (Optional)</label>
                <input
                  type="text"
                  value={onlineRef}
                  onChange={e => setOnlineRef(e.target.value)}
                  placeholder="e.g. 12-digit UTR ID"
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-2.5 text-gray-900 text-xs font-mono focus:border-amber-500 focus:outline-none shadow-xs"
                />
              </div>

              {/* Cashier Payment Confirmation Requirement */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 cursor-pointer hover:border-gray-300 transition-colors">
                <input
                  type="checkbox"
                  checked={upiConfirmed}
                  onChange={e => setUpiConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-amber-500 focus:ring-amber-500 accent-amber-500"
                />
                <span className="text-xs text-gray-700 select-none">
                  I confirm that the customer has scanned the QR code and the payment of <strong className="text-gray-900">{formatINR(Math.round(activeOnline * 100))}</strong> is verified.
                </span>
              </label>
            </div>
          )}

          {/* Exact Formula Breakdown */}
          <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-2.5 text-xs shadow-xs">
            <h3 className="font-extrabold text-sm text-gray-900 mb-2 flex items-center justify-between">
              <span>Payment Calculation Breakdown</span>
              <ShieldCheck size={16} className="text-emerald-600" />
            </h3>

            <div className="flex justify-between text-gray-600">
              <span>Total Bill</span>
              <span className="font-bold text-gray-900">{formatINR(total)}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>Cash Received</span>
              <span className="font-semibold text-emerald-600">{formatINR(Math.round(activeCash * 100))}</span>
            </div>

            <div className="flex justify-between text-gray-600">
              <span>UPI Received</span>
              <span className="font-semibold text-blue-600">{formatINR(Math.round(activeOnline * 100))}</span>
            </div>

            <div className="flex justify-between border-t border-gray-100 pt-2 text-gray-800">
              <span>Total Received</span>
              <span className="font-bold text-gray-900">{formatINR(Math.round(totalReceived * 100))}</span>
            </div>

            <div className="flex justify-between border-t border-gray-100 pt-2">
              <span className="font-bold text-gray-800">Remaining Balance</span>
              <span className={`font-black text-sm ${remainingBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {remainingBalance > 0 ? formatINR(Math.round(remainingBalance * 100)) : '✓ Fully Paid (₹0.00)'}
              </span>
            </div>

            {isOverpaid && (
              <p className="text-red-600 text-xs font-semibold pt-1 flex items-center gap-1">
                <AlertCircle size={14} /> Overpayment of {formatINR(Math.round((totalReceived - totalRupees) * 100))}. Please adjust cash or UPI.
              </p>
            )}
          </div>

          {remainingBalance > 0 && totalReceived > 0 && (
            <div className="p-3.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-900 text-xs">
              ⚠️ Order will be saved as <strong>Partially Paid</strong>. The outstanding balance of {formatINR(Math.round(remainingBalance * 100))} can be settled later from the Orders screen.
            </div>
          )}
        </div>
      </div>

      {/* Checkout Action Button */}
      <div className="fixed bottom-16 md:bottom-0 left-0 md:left-64 right-0 p-3 md:p-4 bg-white/95 backdrop-blur-md border-t border-gray-200 z-30 shadow-lg">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            onClick={handleConfirmAndPlace}
            disabled={placing || isOverpaid}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg transition-all ${
              remainingBalance === 0
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-amber-500 hover:bg-amber-600 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.99]`}
          >
            <CheckCircle size={20} />
            <span>
              {placing
                ? 'Placing Order...'
                : remainingBalance === 0
                ? 'Confirm Payment & Send to Kitchen'
                : `Save as Partially Paid (${formatINR(Math.round(remainingBalance * 100))} Due)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
