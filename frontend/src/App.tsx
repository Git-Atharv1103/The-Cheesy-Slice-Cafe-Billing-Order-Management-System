import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './contexts/AuthContext';
import { CartProvider } from './contexts/CartContext';
import { CafeProvider } from './contexts/CafeContext';
import { RealtimeProvider } from './contexts/RealtimeContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import NewOrderPage from './pages/NewOrderPage';
import CartPage from './pages/CartPage';
import PaymentPage from './pages/PaymentPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import OrdersPage from './pages/OrdersPage';
import OrderDetailPage from './pages/OrderDetailPage';
import KitchenPage from './pages/KitchenPage';
import DailySalesPage from './pages/DailySalesPage';
import MenuManagementPage from './pages/MenuManagementPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CafeProvider>
          <CartProvider>
            <RealtimeProvider>
              <Toaster
                position="top-right"
                toastOptions={{
                  style: { background: '#1c1c1c', color: '#fff', border: '1px solid #333', fontSize: '13px' },
                  success: { iconTheme: { primary: '#F5C518', secondary: '#000' } },
                }}
              />
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route element={<Layout />}>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/new-order" element={<NewOrderPage />} />
                  <Route path="/cart" element={<CartPage />} />
                  <Route path="/payment" element={<PaymentPage />} />
                  <Route path="/kitchen" element={<KitchenPage />} />
                  <Route path="/orders/:id/confirmation" element={<OrderConfirmationPage />} />
                  <Route path="/orders" element={<OrdersPage />} />
                  <Route path="/orders/:id" element={<OrderDetailPage />} />
                  <Route path="/daily-sales" element={<DailySalesPage />} />
                  <Route path="/menu-management" element={<MenuManagementPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </RealtimeProvider>
          </CartProvider>
        </CafeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
