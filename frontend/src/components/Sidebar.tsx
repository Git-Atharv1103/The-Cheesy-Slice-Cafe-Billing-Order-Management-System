import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ShoppingCart, ClipboardList,
  BarChart3, UtensilsCrossed, Settings, LogOut, ChefHat, Volume2, VolumeX
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useCafe } from '../contexts/CafeContext';
import { useRealtime } from '../contexts/RealtimeContext';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
  { to: '/new-order', icon: ShoppingCart, label: 'New Order' },
  { to: '/orders', icon: ClipboardList, label: 'Orders' },
  { to: '/kitchen', icon: ChefHat, label: 'Kitchen (KDS)' },
  { to: '/daily-sales', icon: BarChart3, label: 'Daily Sales' },
  { to: '/menu-management', icon: UtensilsCrossed, label: 'Menu', adminOnly: true },
  { to: '/settings', icon: Settings, label: 'Settings', adminOnly: true },
];

export default function Sidebar() {
  const { user, logout, isAdmin } = useAuth();
  const { itemCount } = useCart();
  const { logoUrl, settings } = useCafe();
  const { audioEnabled, setAudioEnabled, playChime, testChime } = useRealtime();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-[#0d0d0d] border-r border-[#242424] flex-col z-40">
      {/* Logo */}
      <div className="p-5 border-b border-[#242424]">
        <div className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="The Cheesy Slice Logo"
            className="w-11 h-11 object-contain rounded-xl bg-black border border-[#333]"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/logo.png';
            }}
          />
          <div className="min-w-0">
            <h1 className="text-white font-extrabold text-sm leading-tight truncate">{settings.cafe_name || 'The Cheesy Slice'}</h1>
            <p className="text-yellow-400 text-xs font-semibold">{settings.tagline ? settings.tagline.slice(0, 24) : 'FC Road, Pune'}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative
                ${isActive
                  ? 'bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
              {to === '/new-order' && itemCount > 0 && (
                <span className="ml-auto bg-yellow-400 text-black text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                  {itemCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Audio controls */}
      <div className="px-4 py-2.5 border-t border-[#242424] flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setAudioEnabled(!audioEnabled);
            if (!audioEnabled) playChime('new');
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-semibold transition-all ${
            audioEnabled ? 'text-yellow-400 bg-yellow-400/10 border border-yellow-400/20' : 'text-gray-500 hover:text-gray-400'
          }`}
          title="Toggle audio alert chime"
        >
          {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          <span>Chime {audioEnabled ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          onClick={testChime}
          className="text-gray-400 hover:text-yellow-400 px-2 py-1 rounded text-[11px] font-bold transition-colors hover:bg-white/5"
          title="Test audio chime"
        >
          Test
        </button>
      </div>

      {/* User info */}
      <div className="p-4 border-t border-[#2a2a2a]">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-black font-bold text-xs">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{user?.full_name}</p>
            <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-400/10 text-sm transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
