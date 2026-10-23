import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '../lib/api';

export interface CafeSettings {
  id?: number;
  cafe_name: string;
  tagline: string;
  address: string;
  contact_number: string;
  upi_id: string;
  qr_code_path: string;
  logo_path: string;
  business_timezone: string;
  receipt_footer: string;
}

interface CafeContextType {
  settings: CafeSettings;
  logoUrl: string;
  qrUrl: string;
  reloadSettings: () => Promise<void>;
  loading: boolean;
}

const defaultSettings: CafeSettings = {
  cafe_name: 'The Cheesy Slice',
  tagline: 'Loaded with Love & Cheese!',
  address: 'FC Road, Pune, Maharashtra, India',
  contact_number: '',
  upi_id: '',
  qr_code_path: '',
  logo_path: '',
  business_timezone: 'Asia/Kolkata',
  receipt_footer: 'Thank you for visiting The Cheesy Slice!',
};

const CafeContext = createContext<CafeContextType | undefined>(undefined);

export function CafeProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<CafeSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);

  const reloadSettings = useCallback(async () => {
    try {
      const res = await api.get('/settings');
      if (res.data) {
        setSettings(prev => ({ ...prev, ...res.data }));
      }
    } catch (_) {
      // Use defaults if not authenticated yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reloadSettings();
  }, [reloadSettings]);

  // Fallback to /images/logo.png and /images/payment-qr.png if custom ones aren't uploaded
  const logoUrl = settings.logo_path || '/images/logo.png';
  const qrUrl = settings.qr_code_path || '/images/payment-qr.png';

  return (
    <CafeContext.Provider
      value={{
        settings,
        logoUrl,
        qrUrl,
        reloadSettings,
        loading,
      }}
    >
      {children}
    </CafeContext.Provider>
  );
}

export function useCafe() {
  const context = useContext(CafeContext);
  if (!context) {
    throw new Error('useCafe must be used within a CafeProvider');
  }
  return context;
}
