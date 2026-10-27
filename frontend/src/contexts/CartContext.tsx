import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export interface CartItem {
  menu_item_id: string;
  name: string;
  category_name: string;
  unit_price: number; // in paise
  quantity: number;
  total_price: number; // in paise
}

interface CartContextType {
  items: CartItem[];
  customerName: string;
  customerPhone: string;
  discount: number; // in paise
  specialInstructions: string;
  addItem: (item: Omit<CartItem, 'quantity' | 'total_price'>) => void;
  removeItem: (menu_item_id: string) => void;
  updateQuantity: (menu_item_id: string, quantity: number) => void;
  setCustomerName: (name: string) => void;
  setCustomerPhone: (phone: string) => void;
  setDiscount: (discount: number) => void;
  setSpecialInstructions: (instructions: string) => void;
  clearCart: () => void;
  subtotal: number;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | null>(null);

const STORAGE_KEY = 'cheesy_cart_state_v1';

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.items)) return parsed.items;
      }
    } catch (_) {}
    return [];
  });

  const [customerName, setCustomerName] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.customerName || '';
      }
    } catch (_) {}
    return '';
  });

  const [customerPhone, setCustomerPhone] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.customerPhone || '';
      }
    } catch (_) {}
    return '';
  });

  const [discount, setDiscount] = useState<number>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Number(parsed.discount) || 0;
      }
    } catch (_) {}
    return 0;
  });

  const [specialInstructions, setSpecialInstructions] = useState<string>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.specialInstructions || '';
      }
    } catch (_) {}
    return '';
  });

  // Sync to sessionStorage on changes
  useEffect(() => {
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          items,
          customerName,
          customerPhone,
          discount,
          specialInstructions,
        })
      );
    } catch (_) {}
  }, [items, customerName, customerPhone, discount, specialInstructions]);

  const addItem = (item: Omit<CartItem, 'quantity' | 'total_price'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.menu_item_id === item.menu_item_id);
      if (existing) {
        return prev.map(i =>
          i.menu_item_id === item.menu_item_id
            ? { ...i, quantity: i.quantity + 1, total_price: i.unit_price * (i.quantity + 1) }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1, total_price: item.unit_price }];
    });
  };

  const removeItem = (menu_item_id: string) => {
    setItems(prev => prev.filter(i => i.menu_item_id !== menu_item_id));
  };

  const updateQuantity = (menu_item_id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(menu_item_id);
      return;
    }
    setItems(prev =>
      prev.map(i =>
        i.menu_item_id === menu_item_id
          ? { ...i, quantity, total_price: i.unit_price * quantity }
          : i
      )
    );
  };

  const clearCart = () => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
    setSpecialInstructions('');
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
  };

  const subtotal = items.reduce((sum, i) => sum + i.total_price, 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        customerName,
        customerPhone,
        discount,
        specialInstructions,
        addItem,
        removeItem,
        updateQuantity,
        setCustomerName,
        setCustomerPhone,
        setDiscount,
        setSpecialInstructions,
        clearCart,
        subtotal,
        total,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
