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
    <aside className="hidden md:flex fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex-col z-40 shadow-sm">
      {/* Brand Header */}
      <div className="p-5 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white border border-gray-200 p-1 flex items-center justify-center flex-shrink-0 shadow-sm">
            <img
              src={logoUrl}
              alt="The Cheesy Slice Logo"
              className="w-full h-full object-contain rounded-lg"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/images/logo.png';
              }}
            />
          </div>
          <div className="min-w-0">
            <h1 className="text-gray-900 font-extrabold text-sm leading-tight truncate">
              {settings.cafe_name || 'The Cheesy Slice'}
            </h1>
            <p className="text-amber-600 text-xs font-semibold truncate">
              {settings.tagline ? settings.tagline.slice(0, 24) : 'FC Road, Pune'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label, exact, adminOnly }) => {
          if (adminOnly && !isAdmin) return null;
          return (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-150 relative ${
                  isActive
                    ? 'bg-amber-50 text-amber-800 border border-amber-200/80 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`
              }
            >
              <Icon size={18} className="flex-shrink-0" />
              <span>{label}</span>
              {to === '/new-order' && itemCount > 0 && (
                <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center shadow-sm">
                  {itemCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Audio controls */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between text-xs">
        <button
          type="button"
          onClick={() => {
            setAudioEnabled(!audioEnabled);
            if (!audioEnabled) playChime('new');
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg font-semibold transition-all ${
            audioEnabled
              ? 'text-amber-800 bg-amber-100 border border-amber-300/80 shadow-xs'
              : 'text-gray-500 hover:text-gray-700 bg-white border border-gray-200'
          }`}
          title="Toggle audio alert chime"
        >
          {audioEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          <span>Chime {audioEnabled ? 'ON' : 'OFF'}</span>
        </button>
        <button
          type="button"
          onClick={testChime}
          className="text-gray-600 hover:text-amber-700 px-2 py-1 rounded text-[11px] font-bold transition-colors hover:bg-white"
          title="Test audio chime"
        >
          Test Sound
        </button>
      </div>

      {/* User profile & Sign Out */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-extrabold text-xs shadow-sm">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="text-gray-900 text-sm font-semibold truncate">{user?.full_name}</p>
            <p className="text-gray-500 text-xs capitalize">{user?.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-bold transition-colors"
        >
          <LogOut size={15} />
          Sign Out
        </button>
      </div>
    </aside>
  );
}
