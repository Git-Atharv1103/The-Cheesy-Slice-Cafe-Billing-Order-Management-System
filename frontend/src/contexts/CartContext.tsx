import React, { createContext, useContext, useState, ReactNode } from 'react';

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

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discount, setDiscount] = useState(0);
  const [specialInstructions, setSpecialInstructions] = useState('');

  const addItem = (item: Omit<CartItem, 'quantity' | 'total_price'>) => {
    setItems(prev => {
      const existing = prev.find(i => i.menu_item_id === item.menu_item_id);
      if (existing) {
        return prev.map(i => i.menu_item_id === item.menu_item_id
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
    setItems(prev => prev.map(i =>
      i.menu_item_id === menu_item_id
        ? { ...i, quantity, total_price: i.unit_price * quantity }
        : i
    ));
  };

  const clearCart = () => {
    setItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscount(0);
    setSpecialInstructions('');
  };

  const subtotal = items.reduce((sum, i) => sum + i.total_price, 0);
  const total = Math.max(0, subtotal - discount);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, customerName, customerPhone, discount, specialInstructions,
      addItem, removeItem, updateQuantity,
      setCustomerName, setCustomerPhone, setDiscount, setSpecialInstructions,
      clearCart, subtotal, total, itemCount,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
