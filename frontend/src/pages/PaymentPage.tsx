import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useCafe } from '../contexts/CafeContext';
import { useAuth } from '../contexts/AuthContext';
import { formatINR } from '../lib/utils';
import { ArrowLeft, Smartphone, Banknote, Split, CheckCircle, QrCode, Sparkles, AlertCircle, ShieldCheck, UserCheck } from 'lucide-react';
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
      // Split mode default: default half or cash = 0, upi = total
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
    if (!customerName.trim()) {
      toast.error('Customer / Order name is required');
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
        toast.error(error?.response?.data?.error || 'Failed to place order');
      }
    } finally {
      setPlacing(false);
    }
  }

  if (isKitchen) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-6 text-center">
        <div className="bg-[#141414] border border-[#282828] p-6 rounded-2xl max-w-md shadow-2xl">
          <div className="w-12 h-12 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30 flex items-center justify-center mx-auto mb-3">
            <AlertCircle size={24} />
          </div>
          <h2 className="text-white font-black text-lg mb-2">Kitchen Account Active</h2>
          <p className="text-gray-400 text-xs mb-5">
            You are currently signed in as <strong className="text-white">@{user?.username}</strong> ({user?.role?.toUpperCase()}).
            Kitchen accounts cannot create orders or collect payments. Please switch to a Cashier account.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => navigate('/kitchen')}
              className="w-full bg-yellow-400 hover:bg-yellow-300 text-black py-2.5 rounded-xl font-bold text-xs transition-colors"
            >
              Go to Kitchen Display (KDS)
            </button>
            <button
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full bg-[#1c1c1c] hover:bg-[#252525] border border-[#333] text-gray-300 py-2.5 rounded-xl font-bold text-xs transition-colors"
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
    <div className="flex flex-col min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-[#242424] bg-[#0d0d0d] sticky top-0 z-10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/cart')}
            className="text-gray-400 hover:text-white p-1 rounded-lg transition-colors flex-shrink-0"
          >
            <ArrowLeft size={22} />
          </button>
          <div className="min-w-0">
            <h1 className="text-xl md:text-2xl font-black text-white truncate">Payment & Checkout</h1>
            <p className="text-gray-400 text-xs truncate">Order for: <span className="text-yellow-400 font-semibold">{customerName}</span></p>
          </div>
        </div>

        {user && (
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl text-xs text-gray-300 flex-shrink-0">
            <UserCheck size={14} className="text-green-400" />
            <span>Cashier: <strong className="text-white">@{user.username}</strong></span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-5">
          {/* Bill Overview Header */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 shadow-lg">
            <div className="flex items-center justify-between text-sm text-gray-400 pb-3 border-b border-[#242424]">
              <span>Subtotal ({items.length} items)</span>
              <span>{formatINR(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex items-center justify-between text-xs text-green-400 py-2 border-b border-[#242424]">
                <span>Discount Applied</span>
                <span>-{formatINR(discount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-3">
              <span className="text-white font-extrabold text-base">Total Payable</span>
              <span className="text-2xl font-black text-yellow-400">{formatINR(total)}</span>
            </div>
          </div>

          {/* Payment Method Switcher */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4 md:p-5">
            <h2 className="text-white font-bold text-sm mb-3">Select Payment Method</h2>
            <div className="grid grid-cols-3 gap-2">
              {modeButtons.map(({ mode, label, icon: Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleSelectMode(mode)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-3 px-2 rounded-xl border text-xs font-bold transition-all ${
                    paymentMode === mode
                      ? 'border-yellow-400 bg-yellow-400/10 text-yellow-400 ring-1 ring-yellow-400/50 shadow-md'
                      : 'border-[#282828] bg-[#1a1a1a] text-gray-400 hover:text-white hover:border-[#383838]'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-center">{label}</span>
                </button>
              ))}
            </div>

            {/* Split Mode Helper Notice */}
            {paymentMode === 'split' && (
              <div className="mt-4 p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 text-yellow-300 text-xs flex items-start gap-2">
                <Sparkles size={16} className="text-yellow-400 flex-shrink-0 mt-0.5" />
                <p>
                  <strong>Split Calculator Active:</strong> Enter any amount in Cash or UPI. The remaining balance automatically syncs to the other field and updates the QR code instantly!
                </p>
              </div>
            )}
          </div>

          {/* Cash Input Section */}
          {(paymentMode === 'cash' || paymentMode === 'split') && (
            <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4 md:p-5 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Banknote size={16} className="text-green-400" />
                  <span>Cash Received (₹)</span>
                </label>
                {paymentMode === 'split' && (
                  <button
                    type="button"
                    onClick={() => handleCashChange(totalRupees.toFixed(2))}
                    className="text-xs text-yellow-400 hover:underline"
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
                step="0.01"
                className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl px-4 py-3 text-white font-extrabold text-lg focus:border-yellow-400 focus:outline-none"
              />
            </div>
          )}

          {/* UPI Section & Dynamic QR */}
          {(paymentMode === 'online' || paymentMode === 'split') && (
            <div className="bg-[#141414] border border-[#242424] rounded-2xl p-4 md:p-5 space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 flex items-center gap-1.5">
                  <Smartphone size={16} className="text-blue-400" />
                  <span>UPI Payment Required (₹)</span>
                </label>
                {paymentMode === 'split' && (
                  <button
                    type="button"
                    onClick={() => handleOnlineChange(totalRupees.toFixed(2))}
                    className="text-xs text-yellow-400 hover:underline"
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
                step="0.01"
                className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl px-4 py-3 text-white font-extrabold text-lg focus:border-yellow-400 focus:outline-none"
              />

              {/* QR Code Presentation Box */}
              <div className="bg-white rounded-2xl p-5 text-center text-black shadow-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 uppercase tracking-wider">
                    <QrCode size={16} />
                    <span>Scan & Pay</span>
                  </div>

                  {/* Toggle between Standee QR and Dynamic QR */}
                  <div className="flex items-center p-0.5 bg-gray-100 rounded-lg text-[11px] font-semibold border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setQrViewMode('standee')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        qrViewMode === 'standee'
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Paytm QR
                    </button>
                    <button
                      type="button"
                      onClick={() => setQrViewMode('dynamic')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        qrViewMode === 'dynamic'
                          ? 'bg-yellow-400 text-black shadow-sm font-bold'
                          : 'text-gray-600 hover:text-black'
                      }`}
                    >
                      Dynamic (₹)
                    </button>
                  </div>
                </div>

                <div className="w-56 h-64 mx-auto bg-gray-50 rounded-xl p-2 border border-gray-200 flex items-center justify-center overflow-hidden">
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
                <div className="bg-yellow-100 text-black py-2 px-3 rounded-xl border border-yellow-300">
                  <p className="text-xs text-gray-600 font-medium">Exact Amount Required:</p>
                  <p className="text-xl font-black text-gray-900">
                    {formatINR(Math.round(activeOnline * 100))}
                  </p>
                  {settings.upi_id && (
                    <p className="text-xs font-mono text-gray-700 mt-0.5 font-bold">UPI ID: {settings.upi_id}</p>
                  )}
                </div>

                <p className="text-[11px] text-gray-500">Supports Paytm • PhonePe • GPay • BHIM • Cred UPI</p>
              </div>

              {/* UPI Reference Number */}
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">UPI Reference / UTR Number (Optional)</label>
                <input
                  type="text"
                  value={onlineRef}
                  onChange={e => setOnlineRef(e.target.value)}
                  placeholder="e.g. 12-digit UPI Ref ID"
                  className="w-full bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl px-4 py-2.5 text-white text-xs font-mono focus:border-yellow-400 focus:outline-none"
                />
              </div>

              {/* Cashier Payment Confirmation Requirement */}
              <label className="flex items-start gap-2.5 p-3 rounded-xl bg-[#1c1c1c] border border-[#2a2a2a] cursor-pointer hover:border-[#383838] transition-colors">
                <input
                  type="checkbox"
                  checked={upiConfirmed}
                  onChange={e => setUpiConfirmed(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-yellow-400 focus:ring-yellow-400 accent-yellow-400"
                />
                <span className="text-xs text-gray-300 select-none">
                  I confirm that the customer has scanned the QR code and the payment of <strong className="text-yellow-400">{formatINR(Math.round(activeOnline * 100))}</strong> is verified.
                </span>
              </label>
            </div>
          )}

          {/* Exact Formula Breakdown as Requested */}
          <div className="bg-[#141414] border border-[#242424] rounded-2xl p-5 space-y-2.5 text-xs">
            <h3 className="font-extrabold text-sm text-white mb-2 flex items-center justify-between">
              <span>Payment Calculation Breakdown</span>
              <ShieldCheck size={16} className="text-green-400" />
            </h3>

            <div className="flex justify-between text-gray-400">
              <span>Total Bill</span>
              <span className="font-bold text-white">{formatINR(total)}</span>
            </div>

            <div className="flex justify-between text-gray-400">
              <span>Cash Received</span>
              <span className="font-semibold text-green-400">{formatINR(Math.round(activeCash * 100))}</span>
            </div>

            <div className="flex justify-between text-gray-400">
              <span>UPI Received</span>
              <span className="font-semibold text-blue-400">{formatINR(Math.round(activeOnline * 100))}</span>
            </div>

            <div className="flex justify-between border-t border-[#242424] pt-2 text-gray-300">
              <span>Total Received</span>
              <span className="font-bold text-white">{formatINR(Math.round(totalReceived * 100))}</span>
            </div>

            <div className="flex justify-between border-t border-[#242424] pt-2">
              <span className="font-bold text-gray-300">Remaining Balance</span>
              <span className={`font-black text-sm ${remainingBalance > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {remainingBalance > 0 ? formatINR(Math.round(remainingBalance * 100)) : '✓ Fully Paid (₹0.00)'}
              </span>
            </div>

            {isOverpaid && (
              <p className="text-red-400 text-xs font-semibold pt-1 flex items-center gap-1">
                <AlertCircle size={14} /> Overpayment of {formatINR(Math.round((totalReceived - totalRupees) * 100))}. Please adjust cash or UPI.
              </p>
            )}
          </div>

          {remainingBalance > 0 && totalReceived > 0 && (
            <div className="p-3.5 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-xs">
              ⚠️ Order will be saved as <strong>Partially Paid</strong>. The outstanding balance of {formatINR(Math.round(remainingBalance * 100))} can be settled later from the Orders screen.
            </div>
          )}
        </div>
      </div>

      {/* Checkout Action Button */}
      <div className="p-4 border-t border-[#242424] bg-[#0d0d0d] sticky bottom-0">
        <div className="max-w-xl mx-auto">
          <button
            type="button"
            onClick={handleConfirmAndPlace}
            disabled={placing || isOverpaid}
            className={`w-full py-4 px-6 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl transition-all ${
              remainingBalance === 0
                ? 'bg-gradient-to-r from-green-500 to-emerald-600 hover:opacity-90 text-white'
                : 'bg-gradient-to-r from-amber-500 to-orange-600 hover:opacity-90 text-white'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
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
