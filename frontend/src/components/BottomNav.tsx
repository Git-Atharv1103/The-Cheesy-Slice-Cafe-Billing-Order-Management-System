import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ShoppingCart, ClipboardList, ChefHat, MoreHorizontal,
  LayoutDashboard, BarChart3, UtensilsCrossed, Settings, LogOut, X, Volume2, VolumeX
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useAuth } from '../contexts/AuthContext';
import { useCafe } from '../contexts/CafeContext';
import { useRealtime } from '../contexts/RealtimeContext';

export default function BottomNav() {
  const { itemCount } = useCart();
  const { user, logout, isAdmin } = useAuth();
  const { logoUrl, settings } = useCafe();
  const { audioEnabled, setAudioEnabled, playChime } = useRealtime();
  const navigate = useNavigate();
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);

  const handleSignOut = () => {
    setShowMoreDrawer(false);
    logout();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-gray-200 shadow-md">
        <div className="grid grid-cols-4 h-16 items-center px-2">
          {/* New Order */}
          <NavLink
            to="/new-order"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors relative ${
                isActive ? 'text-amber-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            <div className="relative">
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-amber-500 text-white text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-xs">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-[11px] mt-1 font-medium">New Order</span>
          </NavLink>

          {/* Orders */}
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-amber-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            <ClipboardList size={20} />
            <span className="text-[11px] mt-1 font-medium">Orders</span>
          </NavLink>

          {/* Kitchen Display */}
          <NavLink
            to="/kitchen"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-amber-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'
              }`
            }
          >
            <ChefHat size={20} />
            <span className="text-[11px] mt-1 font-medium">Kitchen</span>
          </NavLink>

          {/* More Actions Drawer Trigger */}
          <button
            type="button"
            onClick={() => setShowMoreDrawer(true)}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              showMoreDrawer ? 'text-amber-600 font-extrabold' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[11px] mt-1 font-medium">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-Up "More" Sheet Modal on Mobile */}
      {showMoreDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex flex-col justify-end">
          <div
            className="fixed inset-0"
            onClick={() => setShowMoreDrawer(false)}
          />
          <div className="relative bg-white border-t border-gray-200 rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-9 h-9 object-contain rounded-lg border border-gray-200 bg-white"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/images/logo.png';
                  }}
                />
                <div>
                  <h3 className="font-extrabold text-sm text-gray-900">{settings.cafe_name || 'The Cheesy Slice'}</h3>
                  <p className="text-gray-500 text-xs">{user?.full_name} ({user?.role})</p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreDrawer(false)}
                className="w-8 h-8 rounded-full bg-gray-100 text-gray-500 hover:text-gray-800 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Options */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => { setShowMoreDrawer(false); navigate('/'); }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <LayoutDashboard size={18} className="text-amber-600" />
                <span className="font-bold">Dashboard</span>
              </button>

              <button
                onClick={() => { setShowMoreDrawer(false); navigate('/daily-sales'); }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <BarChart3 size={18} className="text-blue-600" />
                <span className="font-bold">Daily Sales</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => { setShowMoreDrawer(false); navigate('/menu-management'); }}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    <UtensilsCrossed size={18} className="text-emerald-600" />
                    <span className="font-bold">Menu Setup</span>
                  </button>

                  <button
                    onClick={() => { setShowMoreDrawer(false); navigate('/settings'); }}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-gray-50 border border-gray-200 text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    <Settings size={18} className="text-orange-600" />
                    <span className="font-bold">Settings & QR</span>
                  </button>
                </>
              )}
            </div>

            {/* Audio Toggle in Drawer */}
            <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
              <span className="text-xs text-gray-600 font-medium">Order Sound Chimes:</span>
              <button
                type="button"
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                  if (!audioEnabled) playChime('new');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  audioEnabled
                    ? 'bg-amber-100 text-amber-800 border-amber-300'
                    : 'bg-gray-100 text-gray-600 border-gray-200'
                }`}
              >
                {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{audioEnabled ? 'Sound Enabled' : 'Muted'}</span>
              </button>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 py-3 rounded-xl text-xs font-bold transition-colors mt-2"
            >
              <LogOut size={16} />
              <span>Sign Out ({user?.username})</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
