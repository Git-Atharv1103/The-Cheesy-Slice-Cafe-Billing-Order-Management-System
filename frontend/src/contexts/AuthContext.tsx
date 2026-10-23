import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../lib/api';

export interface User {
  id: string;
  username: string;
  full_name: string;
  role: 'admin' | 'cashier' | 'kitchen';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<User>;
  logout: () => void;
  isAdmin: boolean;
  isCashier: boolean;
  isKitchen: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    if (savedToken && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        const rawRole = (parsed.role || '').toLowerCase().trim();
        const normalizedRole = (rawRole === 'staff' ? 'cashier' : rawRole) as 'admin' | 'cashier' | 'kitchen';
        const normalizedUser = { ...parsed, role: normalizedRole };
        setToken(savedToken);
        setUser(normalizedUser);
        localStorage.setItem('user', JSON.stringify(normalizedUser));
      } catch (_) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string): Promise<User> => {
    const res = await api.post('/auth/login', { username, password });
    const { token: newToken, user: rawUser } = res.data;
    const rawRole = (rawUser.role || '').toLowerCase().trim();
    const normalizedRole = (rawRole === 'staff' ? 'cashier' : rawRole) as 'admin' | 'cashier' | 'kitchen';
    const newUser: User = { ...rawUser, role: normalizedRole };
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const rawRole = (user?.role || '').toLowerCase().trim();
  const role = rawRole === 'staff' ? 'cashier' : rawRole;

  return (
    <AuthContext.Provider value={{
      user,
      token,
      login,
      logout,
      isAdmin: role === 'admin',
      isCashier: role === 'cashier',
      isKitchen: role === 'kitchen',
      loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
