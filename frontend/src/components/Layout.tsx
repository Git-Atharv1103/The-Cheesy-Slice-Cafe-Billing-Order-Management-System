import React from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCafe } from '../contexts/CafeContext';
import { useRealtime } from '../contexts/RealtimeContext';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import ReadyOrderAlert from './ReadyOrderAlert';
import { Volume2, VolumeX, ShoppingBag, ChefHat, LogOut } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import toast from 'react-hot-toast';

export default function Layout() {
  const { user, logout, loading } = useAuth();
  const { logoUrl, settings } = useCafe();
  const { 
    audioEnabled, 
    setAudioEnabled, 
    playChime, 
    audioBlocked, 
    unlockAudio, 
    testChime 
  } = useRealtime();
  const { itemCount } = useCart();
  const navigate = useNavigate();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-600 text-sm font-medium">Loading The Cheesy Slice...</p>
        </div>
      </div>
    );
  }

  // 1. Unauthenticated users are redirected to /login
  if (!user) return <Navigate to="/login" replace />;

  const userRole = (user.role || '').toLowerCase().trim();
  const isKitchen = userRole === 'kitchen';
  const isAdmin = userRole === 'admin';

  // 2. Kitchen role protection: ONLY allowed on /kitchen
  if (isKitchen && location.pathname !== '/kitchen') {
    return <Navigate to="/kitchen" replace />;
  }

  // 3. Cashier role protection: Admin pages are denied
  if (!isAdmin && (location.pathname === '/settings' || location.pathname === '/menu-management')) {
    toast.error('Access Denied: Administrator permissions required.');
    return <Navigate to="/" replace />;
  }

  // Specialized Kitchen Layout: Zero Cashier clutter, no sidebar/bottom-nav, pure KDS
  if (isKitchen) {
    return (
      <div className="min-h-screen bg-[#F9FAFB] text-gray-900 flex flex-col font-sans">
        {/* Dedicated KDS Top Bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 p-1 flex items-center justify-center flex-shrink-0 shadow-xs">
              <img
                src={logoUrl}
                alt="Logo"
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/images/logo.png';
                }}
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-sm sm:text-base text-gray-900 tracking-wide">
                  {settings.cafe_name || 'The Cheesy Slice'}
                </h1>
                <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-300 font-extrabold px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-xs">
                  <ChefHat size={12} /> KDS ACTIVE
                </span>
              </div>
              <p className="text-gray-500 text-xs hidden sm:block">Kitchen Display System • Preparation Terminal</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Test Sound button */}
            <button
              type="button"
              onClick={testChime}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-all"
              title="Test notification chime"
            >
              <Volume2 size={14} className="text-amber-600" />
              <span className="hidden sm:inline">Test Sound</span>
            </button>

            {/* Audio chime toggle */}
            <button
              type="button"
              onClick={() => {
                setAudioEnabled(!audioEnabled);
                if (!audioEnabled) playChime('new');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                audioEnabled
                  ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
              }`}
              title="Toggle audio alert chime"
            >
              {audioEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
              <span className="hidden sm:inline">Chime {audioEnabled ? 'ON' : 'OFF'}</span>
            </button>

            {/* User badge */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-700 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{user.full_name || 'Kitchen Staff'}</span>
            </div>

            {/* Logout button */}
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="flex items-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-3 py-1.5 rounded-xl text-xs font-bold transition-colors"
              title="Sign out of Kitchen Display"
            >
              <LogOut size={14} />
              <span>Exit</span>
            </button>
          </div>
        </header>

        {/* Audio blocked notification banner */}
        {audioBlocked && (
          <div
            onClick={unlockAudio}
            className="cursor-pointer bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-amber-800 text-xs font-bold flex items-center justify-center gap-2"
          >
            <Volume2 size={16} className="text-amber-600" />
            <span>Audio paused by browser autoplay policy. Click anywhere to activate live audio alerts!</span>
          </div>
        )}

        {/* Full-width KDS Viewport */}
        <main className="flex-1 w-full max-w-7xl mx-auto p-3 sm:p-5">
          <Outlet />
        </main>
      </div>
    );
  }

  // Full Cashier & Admin Layout
  return (
    <div className="min-h-screen bg-[#F9FAFB] text-gray-900 flex flex-col md:flex-row font-sans">
      {/* Real-time Order Ready Modal for Cashier */}
      <ReadyOrderAlert />

      {/* Desktop Sidebar (hidden on mobile) */}
      <Sidebar />

      {/* Mobile Top Header (hidden on desktop) */}
      <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-gray-200 px-4 py-2.5 flex items-center justify-between shadow-xs">
        <div
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <img
            src={logoUrl}
            alt="Logo"
            className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-200 shadow-xs"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/images/logo.png';
            }}
          />
          <div>
            <h1 className="font-extrabold text-sm text-gray-900 leading-tight">{settings.cafe_name || 'The Cheesy Slice'}</h1>
            <p className="text-[10px] text-amber-600 font-semibold">{settings.tagline || 'FC Road, Pune'}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Test / Toggle Button */}
          <button
            type="button"
            onClick={testChime}
            className="p-2 rounded-xl text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors"
            title="Test notification chime"
          >
            <Volume2 size={16} className="text-amber-600" />
          </button>

          <button
            type="button"
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              if (!audioEnabled) playChime('new');
            }}
            className={`p-2 rounded-xl text-xs font-bold border transition-colors ${
              audioEnabled
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
            title="Toggle notification chime"
          >
            {audioEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          {/* Quick Cart button if items in cart */}
          {itemCount > 0 && (
            <button
              onClick={() => navigate('/cart')}
              className="flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white px-2.5 py-1.5 rounded-xl font-black text-xs shadow-sm transition-colors"
            >
              <ShoppingBag size={14} />
              <span>{itemCount}</span>
            </button>
          )}

          {/* User role pill */}
          <span className="text-[10px] uppercase font-bold px-2 py-1 bg-gray-100 text-gray-700 rounded-lg border border-gray-200">
            {user.role}
          </span>
        </div>
      </header>

      {/* Audio blocked notification banner for cashier */}
      {audioBlocked && (
        <div
          onClick={unlockAudio}
          className="md:ml-64 cursor-pointer bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-amber-800 text-xs font-bold flex items-center justify-center gap-2"
        >
          <Volume2 size={16} className="text-amber-600" />
          <span>Audio alerts suspended by browser policy. Click here to enable sound!</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 ml-0 md:ml-64 min-h-screen pb-20 md:pb-6 overflow-x-hidden bg-[#F9FAFB]">
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation Bar */}
      <BottomNav />
    </div>
  );
}
