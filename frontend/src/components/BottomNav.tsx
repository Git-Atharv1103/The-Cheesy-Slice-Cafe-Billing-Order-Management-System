import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ShoppingCart, ClipboardList, ChefHat, MoreHorizontal, LayoutDashboard, BarChart3, UtensilsCrossed, Settings, LogOut, X, Volume2, VolumeX } from 'lucide-react';
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0d0d0d]/95 backdrop-blur-md border-t border-[#262626] safe-area-pb">
        <div className="grid grid-cols-4 h-16 items-center px-1">
          {/* New Order */}
          <NavLink
            to="/new-order"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors relative ${
                isActive ? 'text-yellow-400 font-extrabold' : 'text-gray-400 hover:text-white'
              }`
            }
          >
            <div className="relative">
              <ShoppingCart size={20} />
              {itemCount > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-yellow-400 text-black text-[10px] font-black w-4 h-4 rounded-full flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>
            <span className="text-[10px] mt-1">New Order</span>
          </NavLink>

          {/* Orders */}
          <NavLink
            to="/orders"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-yellow-400 font-extrabold' : 'text-gray-400 hover:text-white'
              }`
            }
          >
            <ClipboardList size={20} />
            <span className="text-[10px] mt-1">Orders</span>
          </NavLink>

          {/* Kitchen Display */}
          <NavLink
            to="/kitchen"
            className={({ isActive }) =>
              `flex flex-col items-center justify-center py-1 transition-colors ${
                isActive ? 'text-yellow-400 font-extrabold' : 'text-gray-400 hover:text-white'
              }`
            }
          >
            <ChefHat size={20} />
            <span className="text-[10px] mt-1">Kitchen</span>
          </NavLink>

          {/* More Actions Drawer Trigger */}
          <button
            type="button"
            onClick={() => setShowMoreDrawer(true)}
            className={`flex flex-col items-center justify-center py-1 transition-colors ${
              showMoreDrawer ? 'text-yellow-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <MoreHorizontal size={20} />
            <span className="text-[10px] mt-1">More</span>
          </button>
        </div>
      </nav>

      {/* Slide-Up "More" Sheet Modal on Mobile */}
      {showMoreDrawer && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
          <div
            className="fixed inset-0"
            onClick={() => setShowMoreDrawer(false)}
          />
          <div className="relative bg-[#141414] border-t border-[#2a2a2a] rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto animate-enter">
            {/* Drawer Header */}
            <div className="flex items-center justify-between border-b border-[#242424] pb-4">
              <div className="flex items-center gap-3">
                <img src={logoUrl} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
                <div>
                  <h3 className="font-extrabold text-sm text-white">{settings.cafe_name || 'The Cheesy Slice'}</h3>
                  <p className="text-gray-500 text-xs">{user?.full_name} ({user?.role})</p>
                </div>
              </div>
              <button
                onClick={() => setShowMoreDrawer(false)}
                className="w-8 h-8 rounded-full bg-[#202020] text-gray-400 flex items-center justify-center"
              >
                <X size={18} />
              </button>
            </div>

            {/* Navigation Options */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <button
                onClick={() => { setShowMoreDrawer(false); navigate('/'); }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1c1c1c] text-white hover:bg-[#282828] transition-colors"
              >
                <LayoutDashboard size={18} className="text-yellow-400" />
                <span className="font-bold">Dashboard</span>
              </button>

              <button
                onClick={() => { setShowMoreDrawer(false); navigate('/daily-sales'); }}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1c1c1c] text-white hover:bg-[#282828] transition-colors"
              >
                <BarChart3 size={18} className="text-blue-400" />
                <span className="font-bold">Daily Sales</span>
              </button>

              {isAdmin && (
                <>
                  <button
                    onClick={() => { setShowMoreDrawer(false); navigate('/menu-management'); }}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1c1c1c] text-white hover:bg-[#282828] transition-colors"
                  >
                    <UtensilsCrossed size={18} className="text-green-400" />
                    <span className="font-bold">Menu Setup</span>
                  </button>

                  <button
                    onClick={() => { setShowMoreDrawer(false); navigate('/settings'); }}
                    className="flex items-center gap-2.5 p-3 rounded-xl bg-[#1c1c1c] text-white hover:bg-[#282828] transition-colors"
                  >
                    <Settings size={18} className="text-orange-400" />
                    <span className="font-bold">Settings & QR</span>
                  </button>
                </>
              )}
            </div>

            {/* Audio Toggle in Drawer */}
            <div className="pt-2 border-t border-[#242424] flex items-center justify-between">
              <span className="text-xs text-gray-400 font-medium">Order Sound Chimes:</span>
              <button
                type="button"
                onClick={() => {
                  setAudioEnabled(!audioEnabled);
                  if (!audioEnabled) playChime('new');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border ${
                  audioEnabled
                    ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30'
                    : 'bg-[#222] text-gray-400 border-[#333]'
                }`}
              >
                {audioEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
                <span>{audioEnabled ? 'Sound Enabled' : 'Muted'}</span>
              </button>
            </div>

            {/* Sign Out Button */}
            <button
              onClick={handleSignOut}
              className="w-full flex items-center justify-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 py-3 rounded-xl text-xs font-bold transition-colors mt-2"
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
