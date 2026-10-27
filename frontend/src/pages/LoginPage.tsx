import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChefHat, CreditCard, Eye, EyeOff, ArrowRight, Lock, Crown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useCafe } from '../contexts/CafeContext';

type LoginStation = 'cashier' | 'kitchen' | 'admin';

export default function LoginPage() {
  const [station, setStation] = useState<LoginStation>('cashier');
  const [username, setUsername] = useState('cashier@thecheesyslice.local');
  const [password, setPassword] = useState('cashier123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, login } = useAuth();
  const { logoUrl, settings } = useCafe();
  const navigate = useNavigate();

  // If already logged in, automatically navigate to the user's role dashboard
  useEffect(() => {
    if (user) {
      if (user.role === 'kitchen') {
        navigate('/kitchen', { replace: true });
      } else {
        navigate('/', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSelectStation = (newStation: LoginStation) => {
    setStation(newStation);
    if (newStation === 'cashier') {
      setUsername('cashier@thecheesyslice.local');
      setPassword('cashier123');
    } else if (newStation === 'kitchen') {
      setUsername('kitchen@thecheesyslice.local');
      setPassword('kitchen123');
    } else {
      setUsername('admin');
      setPassword('admin123');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      toast.error('Please enter your username/email and password');
      return;
    }

    setLoading(true);
    try {
      const authenticatedUser = await login(username.trim(), password);

      if (authenticatedUser.role === 'kitchen') {
        toast.success(`Welcome, ${authenticatedUser.full_name || 'Chef'}! Opening Kitchen Display.`);
        navigate('/kitchen');
      } else if (authenticatedUser.role === 'cashier') {
        toast.success(`Welcome, ${authenticatedUser.full_name || 'Cashier'}! Opening Cashier Station.`);
        navigate('/');
      } else {
        toast.success(`Welcome back, ${authenticatedUser.full_name || 'Admin'}!`);
        navigate('/');
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Invalid credentials. Please verify your login details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4 font-sans text-gray-900">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="w-20 h-20 rounded-2xl bg-white border border-gray-200 p-2 flex items-center justify-center mx-auto mb-3 shadow-md">
            <img
              src={logoUrl}
              alt="The Cheesy Slice Logo"
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/logo.png';
              }}
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">
            {settings.cafe_name || 'The Cheesy Slice'}
          </h1>
          <p className="text-amber-600 text-xs md:text-sm font-bold mt-1">
            {settings.tagline || 'Loaded with Love & Cheese!'}
          </p>
          <p className="text-gray-500 text-xs mt-0.5">{settings.address || 'FC Road, Pune, Maharashtra'}</p>
        </div>

        {/* Login Box */}
        <div className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
          {/* Station Selection Tabs */}
          <div>
            <p className="text-gray-500 text-xs font-bold mb-2 uppercase tracking-wider text-center">
              Select Login Station
            </p>
            <div className="grid grid-cols-3 gap-1.5 bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
              <button
                type="button"
                onClick={() => handleSelectStation('cashier')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${
                  station === 'cashier'
                    ? 'bg-white text-blue-700 shadow-sm border border-gray-200 ring-1 ring-blue-500/20'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <CreditCard size={14} className="text-blue-600" />
                <span>Cashier</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('kitchen')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${
                  station === 'kitchen'
                    ? 'bg-white text-orange-700 shadow-sm border border-gray-200 ring-1 ring-orange-500/20'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ChefHat size={15} className="text-orange-600" />
                <span>Kitchen</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('admin')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${
                  station === 'admin'
                    ? 'bg-white text-amber-800 shadow-sm border border-gray-200 ring-1 ring-amber-500/20 font-black'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Crown size={14} className="text-amber-600" />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Station Info Banner */}
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              station === 'cashier'
                ? 'bg-blue-50 border-blue-200 text-blue-900'
                : station === 'kitchen'
                ? 'bg-orange-50 border-orange-200 text-orange-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <Lock size={15} className="flex-shrink-0" />
            <p className="leading-snug">
              {station === 'cashier' && (
                <span>
                  <strong>Cashier Portal:</strong> Quick Add billing, cart management, split payments, and live kitchen tracking.
                </span>
              )}
              {station === 'kitchen' && (
                <span>
                  <strong>Kitchen Display (KDS):</strong> Real-time screen for chefs with individual item tick boxes.
                </span>
              )}
              {station === 'admin' && (
                <span>
                  <strong>Admin Station:</strong> Full access to cafe settings, reports, user accounts, and menu management.
                </span>
              )}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-700 font-bold mb-1.5 block">Username or Email</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. cashier@thecheesyslice.local"
                className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-colors shadow-xs"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-gray-700 font-bold mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 pr-11 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 text-sm transition-colors shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-md transition-all bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50"
            >
              <span>{loading ? 'Authenticating...' : station === 'kitchen' ? 'Sign In to Kitchen Display' : station === 'cashier' ? 'Sign In as Cashier' : 'Sign In as Admin'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick-Fill Station Roles */}
          <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-200 space-y-2">
            <p className="text-[11px] text-gray-500 font-bold uppercase tracking-wider text-center">
              Quick Test Credentials:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectStation('cashier')}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                  station === 'cashier'
                    ? 'bg-blue-50 text-blue-800 border-blue-300 ring-1 ring-blue-400'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                💳 Cashier
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('kitchen')}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                  station === 'kitchen'
                    ? 'bg-orange-50 text-orange-800 border-orange-300 ring-1 ring-orange-400'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                🍳 Kitchen
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('admin')}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                  station === 'admin'
                    ? 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                👑 Admin
              </button>
            </div>
            <p className="text-[10px] text-gray-500 text-center font-mono pt-1">
              {station === 'cashier' && 'cashier@thecheesyslice.local / cashier123'}
              {station === 'kitchen' && 'kitchen@thecheesyslice.local / kitchen123'}
              {station === 'admin' && 'admin / admin123'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
