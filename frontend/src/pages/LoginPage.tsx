import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChefHat, CreditCard, Shield, Eye, EyeOff, Sparkles, ArrowRight, Lock, Crown } from 'lucide-react';
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
      // Backend validates credentials and returns actual assigned role
      const authenticatedUser = await login(username.trim(), password);

      // Role-based destination enforcement
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
    <div
      className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4 font-sans"
      style={{ backgroundImage: 'radial-gradient(ellipse at 50% 0%, rgba(245,197,24,0.12) 0%, transparent 65%)' }}
    >
      <div className="w-full max-w-md space-y-5">
        {/* Brand Header */}
        <div className="text-center">
          <div className="w-24 h-24 rounded-2xl bg-black border border-[#333] p-1.5 flex items-center justify-center mx-auto mb-3 shadow-2xl shadow-yellow-500/10">
            <img
              src={logoUrl}
              alt="The Cheesy Slice Logo"
              className="w-full h-full object-contain rounded-xl"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/logo.png';
              }}
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            {settings.cafe_name || 'The Cheesy Slice'}
          </h1>
          <p className="text-yellow-400 text-xs md:text-sm font-semibold mt-0.5">
            {settings.tagline || 'Loaded with Love & Cheese!'}
          </p>
          <p className="text-gray-500 text-[11px] mt-0.5">{settings.address || 'FC Road, Pune, Maharashtra'}</p>
        </div>

        {/* Login Box */}
        <div className="bg-[#141414] border border-[#2a2a2a] rounded-3xl p-6 sm:p-7 shadow-2xl space-y-5">
          {/* Station Selection Tabs */}
          <div>
            <p className="text-gray-400 text-xs font-semibold mb-2 uppercase tracking-wider text-center">
              Select Login Station
            </p>
            <div className="grid grid-cols-3 gap-1.5 bg-[#1c1c1c] p-1.5 rounded-2xl border border-[#2c2c2c]">
              <button
                type="button"
                onClick={() => handleSelectStation('cashier')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${
                  station === 'cashier'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-1 ring-blue-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <CreditCard size={14} />
                <span>Cashier</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('kitchen')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${
                  station === 'kitchen'
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 ring-1 ring-orange-400'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <ChefHat size={15} />
                <span>Kitchen</span>
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('admin')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl font-bold text-xs transition-all ${
                  station === 'admin'
                    ? 'bg-yellow-500 text-black shadow-lg shadow-yellow-500/30 ring-1 ring-yellow-400 font-black'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Crown size={14} />
                <span>Admin</span>
              </button>
            </div>
          </div>

          {/* Station Info Banner */}
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
              station === 'cashier'
                ? 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                : station === 'kitchen'
                ? 'bg-orange-500/10 border-orange-500/30 text-orange-300'
                : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-300'
            }`}
          >
            <Lock size={15} className="flex-shrink-0" />
            <p className="leading-snug">
              {station === 'cashier' && (
                <span>
                  <strong>Cashier Portal:</strong> Authorized for billing, orders, split payments, and live kitchen tracking.
                </span>
              )}
              {station === 'kitchen' && (
                <span>
                  <strong>Kitchen Display (KDS):</strong> Dedicated screen for chefs with individual item-level tick boxes.
                </span>
              )}
              {station === 'admin' && (
                <span>
                  <strong>Admin Station:</strong> Full access to cafe settings, financial reports, user roles, and menu.
                </span>
              )}
            </p>
          </div>

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Username or Email</label>
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. cashier@thecheesyslice.local"
                className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors"
                autoFocus
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-semibold mb-1.5 block">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full bg-[#1e1e1e] border border-[#2a2a2a] rounded-xl px-4 py-3 pr-11 text-white placeholder-gray-600 focus:outline-none focus:border-yellow-400 text-sm transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 p-1"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
                station === 'cashier'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                  : station === 'kitchen'
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white shadow-orange-500/20'
                  : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black shadow-yellow-500/20'
              }`}
            >
              <span>{loading ? 'Authenticating...' : station === 'kitchen' ? 'Sign In to Kitchen Display' : station === 'cashier' ? 'Sign In as Cashier' : 'Sign In as Admin'}</span>
              <ArrowRight size={16} />
            </button>
          </form>

          {/* Quick-Fill Station Roles */}
          <div className="p-3.5 bg-[#1a1a1a] rounded-2xl border border-[#262626] space-y-2">
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-wider text-center">
              Quick Test Credentials:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectStation('cashier')}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                  station === 'cashier'
                    ? 'bg-blue-500/20 text-blue-400 border-blue-500/40 ring-1 ring-blue-500'
                    : 'bg-[#222] text-gray-400 border-[#333] hover:text-white'
                }`}
              >
                💳 Cashier
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('kitchen')}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                  station === 'kitchen'
                    ? 'bg-orange-500/20 text-orange-400 border-orange-500/40 ring-1 ring-orange-500'
                    : 'bg-[#222] text-gray-400 border-[#333] hover:text-white'
                }`}
              >
                🍳 Kitchen
              </button>

              <button
                type="button"
                onClick={() => handleSelectStation('admin')}
                className={`py-2 px-1 text-[11px] font-bold rounded-xl border text-center transition-all ${
                  station === 'admin'
                    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 ring-1 ring-yellow-500'
                    : 'bg-[#222] text-gray-400 border-[#333] hover:text-white'
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
