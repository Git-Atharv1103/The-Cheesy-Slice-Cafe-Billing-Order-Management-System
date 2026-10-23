# The Cheesy Slice – Cafe Billing & Order Management System

> **"Loaded with Love & Cheese!"**  
> Location: FC Road, Pune, Maharashtra, India

A complete, modern, responsive Cafe Billing and Order Management Web Application designed for **The Cheesy Slice**. Built with **React 19 + TypeScript + Vite + Tailwind CSS** on the frontend, and a high-performance **Node.js + Express + libSQL / SQLite** persistent database on the backend.

---

## 🍕 Features & Capabilities

### 1. Fast Menu & Billing Workflow
- **All 9 Menu Categories & Items Pre-seeded**:
  - Cold Coffee (Regular, Strong)
  - Hot Coffee (Black, Regular, Strong)
  - Mojitos and Beverages (Virgin, Blue Curacao, Pink Goa Blast, Kala Khatta, Jeera Masala, Lemon Ice Tea, Peach Ice Tea, Fresh Lime Soda)
  - Pasta (Cheesy White Sauce, Red Sauce, Mix, Mexican)
  - Sandwiches (Veg Club, Veg Grill Cheese, Cheesy Bombay Masala, Cheesy Corn Mayo, Schezwan, Aloo Masala, Tandoori Paneer, Peri Peri Paneer, Chocolate)
  - Pizzas (Margherita, Classic, Corn Cheese, Paneer Tikka, Exotic, Schezwan Mushroom, Peri Peri Paneer, Tandoori Veggie, Cheesy Tandoori Paneer)
  - Garlic Bread (Plain, With Cheese, Cheese & Chilli, Cheese & Olive)
  - Nachos (With Salsa, Loaded With Salsa & Cheese)
  - Add-ons (Extra Cheese, Extra Paneer, Extra Mushroom)
- Fast item search and category filters.
- Increment/decrement item quantity and persistent cart during navigation.

### 2. Cart & Customer Management
- Real-time price and subtotal calculations.
- Customer / Table name and optional phone number.
- Special instructions for kitchen preparation.
- Custom discounts in INR (₹) with safety checks against exceeding the subtotal.

### 3. Payment & Dynamic UPI QR Code
- Support for **Cash**, **Online / UPI**, and **Split Payments** (e.g. ₹300 Online + ₹200 Cash).
- 1-tap "Full Amount" autofill buttons for speed at the counter.
- Automatic calculation of amount received, outstanding balance due, and overpayment prevention.
- **Dynamic UPI QR Code Generation**: Generates real `upi://pay` QR codes containing the cafe's configured UPI ID and exact bill amount.
- Custom QR code upload support in Admin Settings.

### 4. Sequential Daily Order Numbering
- Generates sequential daily order numbers (`001`, `002`, `003`...) per business day.
- Resets every business day using `Asia/Kolkata` timezone without deleting previous order history.
- Database-safe atomic sequence tracking.

### 5. Printable Thermal/Standard Receipt
- Clean, professional receipt displaying cafe branding, customer name, date/time, items, unit prices, subtotal, discount, cash vs online breakdown, balance due, and footer.
- Print-optimized CSS (`@media print`) hides navigation bars and formats pure white receipt.

### 6. Order Management & Editing
- Searchable & filterable orders table (by date, search term, payment status, order status).
- **Full Order Editing**:
  - Change customer name & phone.
  - Add more items from the menu via inline picker.
  - Modify item quantities or remove items.
  - Recalculates total automatically and highlights additional amount due or refund/adjustment due.
  - Record incremental payments to clear pending balances.
  - Full audit trail logging changes, timestamps, and staff members.

### 7. Daily Sales Dashboard & Analytics
- Live statistics: Total Sales, Cash Collected, Online Collected, Outstanding Balance, Order Counts by status.
- Top 10 Best-Selling Items with revenue and units sold.
- Category-wise sales breakdown.
- Export orders to CSV and printable report.

### 8. Role-Based Access Control (RBAC) & Settings
- **Admin / Owner**: Full access to settings, staff user creation, menu pricing, QR code upload, and financial adjustments.
- **Cashier / Staff**: Restricted to order taking, billing, payment collection, and order tracking.
- Menu items, categories, prices, and availability editable from Admin UI without touching code.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js 18+ or 20+ installed
- npm installed

### Start the Application
Simply double-click `start.bat` in the root folder, or run:

```bash
# Terminal 1 - Backend
cd backend
node src/server.js

# Terminal 2 - Frontend
cd frontend
npm run dev
```

- **Frontend URL**: [http://localhost:5173](http://localhost:5173)
- **Backend API URL**: [http://localhost:3001](http://localhost:3001)

### Default Login Accounts
| Role | Username | Password | Access Level |
|---|---|---|---|
| **Owner / Admin** | `admin` | `admin123` | Full Access (Dashboard, Orders, Billing, Menu Management, Staff Management, Settings) |
| **Cashier / Staff** | `staff` | `staff123` | Operational Access (New Order, Billing, Orders Dashboard) |

---

## 🧪 Automated Verification Test Suite

An end-to-end test script verifies all 10 project requirements:

```bash
cd backend
node test_api.js
```

### Verified Test Cases:
1. Admin & Staff Authentication & Token Generation
2. Menu Categories & Items structure verification
3. Scenario 1: Fully cash-paid order
4. Scenario 2: Fully online-paid order with UPI reference
5. Scenario 3: Split payment order (Cash + Online)
6. Scenario 4: Partially paid order with outstanding balance due
7. Scenario 5: Order editing (adding items, recalculating balance, clearing remaining balance)
8. Scenario 6: Order cancellation & audit trail logging
9. Scenario 7: Daily sales financial aggregation (excluding cancelled orders)
10. Scenario 8: Role-based authorization enforcement (HTTP 403 on protected routes)
11. Scenario 9: Menu price snapshot immutability (historical bills stay intact when menu prices change)

---

## 📂 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── db/
│   │   │   ├── database.js     # SQLite / libSQL database connection
│   │   │   ├── migrate.js      # Relational schema migrations
│   │   │   └── seed.js         # Menu card data & user accounts seed
│   │   ├── middleware/
│   │   │   └── auth.js         # JWT verification & role authorization
│   │   ├── routes/
│   │   │   ├── auth.js         # Login & password changes
│   │   │   ├── dashboard.js    # Financial analytics & reports
│   │   │   ├── menu.js         # Category & Item CRUD
│   │   │   ├── orders.js       # Order creation, daily seq, payment tracking & edits
│   │   │   └── settings.js     # Cafe details, UPI, QR code upload, staff accounts
│   │   └── server.js           # Express app entrypoint
│   ├── test_api.js             # Automated verification test suite
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/         # Layout & Sidebar
│   │   ├── contexts/           # AuthContext & CartContext (persistent storage)
│   │   ├── lib/                # Axios instance, formatINR, date utilities
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── NewOrderPage.tsx
│   │   │   ├── CartPage.tsx
│   │   │   ├── PaymentPage.tsx
│   │   │   ├── OrderConfirmationPage.tsx
│   │   │   ├── OrdersPage.tsx
│   │   │   ├── OrderDetailPage.tsx
│   │   │   ├── DailySalesPage.tsx
│   │   │   ├── MenuManagementPage.tsx
│   │   │   ├── SettingsPage.tsx
│   │   │   └── LoginPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── data/                       # Persistent database file (cheesy_slice.db) and uploads
├── start.bat                   # 1-click startup script for Windows
└── README.md
```

---

## 🔒 Security & Data Integrity
- Passwords hashed using `bcryptjs` with salt factor 10.
- JWT authentication with 12-hour session duration.
- Financial arithmetic performed in safe integer paise (`unit_price * quantity`) to eliminate floating-point rounding errors.
- Price snapshot architecture: menu price changes never affect past orders or receipts.
- SQLite WAL mode and atomic sequences prevent duplicate daily order numbers.
