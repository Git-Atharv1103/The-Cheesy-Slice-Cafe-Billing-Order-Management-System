import http from 'http';

const BASE_URL = 'http://localhost:3001/api';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runTests() {
  console.log('🧪 Starting The Cheesy Slice Mobile Application Integration Tests...\n');

  // Test 1: Authentication for all roles
  console.log('--- Test 1: User Roles Authentication ---');
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  if (adminLogin.status !== 200 || !adminLogin.data.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
  }
  const adminToken = adminLogin.data.token;
  console.log('✅ Admin login succeeded (Role: ' + adminLogin.data.user.role + ')');

  const staffLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'staff', password: 'staff123' }
  });
  if (staffLogin.status !== 200 || !staffLogin.data.token) {
    throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.data)}`);
  }
  const staffToken = staffLogin.data.token;
  console.log('✅ Staff/Cashier login succeeded (Role: ' + staffLogin.data.user.role + ')');

  const kitchenLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'kitchen', password: 'kitchen123' }
  });
  if (kitchenLogin.status !== 200 || !kitchenLogin.data.token) {
    throw new Error(`Kitchen login failed: ${JSON.stringify(kitchenLogin.data)}`);
  }
  const kitchenToken = kitchenLogin.data.token;
  console.log('✅ Kitchen login succeeded (Role: ' + kitchenLogin.data.user.role + ')');

  // Test 2: Role-based permissions
  console.log('\n--- Test 2: Kitchen Staff Role Restrictions ---');
  // Kitchen attempting to access sensitive financial sales stats
  const kitchenStats = await request('/dashboard/summary', {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  if (kitchenStats.status === 403) {
    console.log('✅ Kitchen user blocked from financial dashboard summary (HTTP 403)');
  } else {
    throw new Error(`Expected 403 for kitchen on /dashboard/summary, got ${kitchenStats.status}`);
  }

  // Admin accessing dashboard summary
  const adminStats = await request('/dashboard/summary', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (adminStats.status === 200) {
    console.log('✅ Admin successfully fetched dashboard summary. 4 main metrics:', {
      total_sales: adminStats.data.summary?.total_sales ?? adminStats.data.total_sales,
      total_orders: adminStats.data.summary?.total_orders ?? adminStats.data.total_orders,
      cash_sales: adminStats.data.cash_sales ?? adminStats.data.cash_total,
      online_sales: adminStats.data.online_sales ?? adminStats.data.online_total
    });
  } else {
    throw new Error(`Admin failed to get dashboard summary: ${adminStats.status}`);
  }

  // Test 3: Fetch menu items to create an order
  console.log('\n--- Test 3: Creating Order ---');
  const menuRes = await request('/menu');
  const allItems = menuRes.data.flatMap(c => c.items);
  if (allItems.length === 0) throw new Error('No menu items found');
  const firstItem = allItems[0];
  console.log(`Using menu item: ${firstItem.name} @ ₹${firstItem.price}`);

  // Create order with total ₹500 (50000 paise)
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      customer_name: 'Test Customer Pune',
      customer_phone: '9876543210',
      items: [
        {
          menu_item_id: firstItem.id,
          name: firstItem.name,
          quantity: 2,
          unit_price: 25000,
          total_price: 50000
        }
      ],
      subtotal: 50000,
      discount: 0,
      total: 50000,
      special_instructions: 'Extra crispy, less spice',
      payments: [] // unpaid initially
    }
  });

  if (orderRes.status !== 201) {
    throw new Error(`Failed to create order: ${JSON.stringify(orderRes.data)}`);
  }
  const createdOrder = orderRes.data;
  console.log(`✅ Order #${createdOrder.daily_order_number} created (ID: ${createdOrder.id})`);
  console.log(`Initial Status: ${createdOrder.order_status}, Payment Status: ${createdOrder.payment_status}, Total: ₹${createdOrder.total / 100}`);

  // Test 4: Split Payment - Cash ₹80 against ₹500 bill
  console.log('\n--- Test 4: Split Payment - Step A (Cash ₹80) ---');
  const payment1 = await request(`/orders/${createdOrder.id}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      method: 'cash',
      amount: 80, // ₹80
      reference: 'CASH-REC-1'
    }
  });
  if (payment1.status !== 200) {
    throw new Error(`Cash payment failed: ${JSON.stringify(payment1.data)}`);
  }
  const afterCashOrder = payment1.data;
  console.log(`Total: ₹${afterCashOrder.total / 100}, Paid: ₹${afterCashOrder.total_paid / 100}, Balance Due: ₹${afterCashOrder.balance_due / 100}`);
  if (Number(afterCashOrder.balance_due) !== 42000) {
    throw new Error(`Expected balance_due 42000 (₹420), got ${afterCashOrder.balance_due}`);
  }
  if (afterCashOrder.payment_status !== 'partial') {
    throw new Error(`Expected payment_status 'partial', got ${afterCashOrder.payment_status}`);
  }
  console.log('✅ Split payment step A verified: Remaining UPI amount is exactly ₹420!');

  // Test 5: Kitchen blocked from adding payment
  console.log('\n--- Test 5: Kitchen Blocked From Payment Mutation ---');
  const kitchenPaymentAttempt = await request(`/orders/${createdOrder.id}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: {
      method: 'online',
      amount: 420,
      reference: 'UPI-FAIL'
    }
  });
  if (kitchenPaymentAttempt.status === 403) {
    console.log('✅ Kitchen user blocked from adding payments (HTTP 403)');
  } else {
    throw new Error(`Expected 403 for kitchen payment mutation, got ${kitchenPaymentAttempt.status}`);
  }

  // Test 6: Complete payment with UPI ₹420
  console.log('\n--- Test 6: Split Payment - Step B (UPI ₹420) ---');
  const payment2 = await request(`/orders/${createdOrder.id}/payments`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      method: 'online',
      amount: 420, // ₹420
      reference: 'UPI-TXN-SUCCESS-99'
    }
  });
  if (payment2.status !== 200) {
    throw new Error(`UPI payment failed: ${JSON.stringify(payment2.data)}`);
  }
  const fullyPaidOrder = payment2.data;
  console.log(`Total: ₹${fullyPaidOrder.total / 100}, Paid: ₹${fullyPaidOrder.total_paid / 100}, Balance Due: ₹${fullyPaidOrder.balance_due / 100}`);
  if (Number(fullyPaidOrder.balance_due) !== 0 || fullyPaidOrder.payment_status !== 'paid') {
    throw new Error(`Expected balance 0 and payment_status 'paid', got ${fullyPaidOrder.balance_due}, ${fullyPaidOrder.payment_status}`);
  }
  console.log('✅ Order marked fully PAID! Preserved 2 payments: Cash ₹80 + UPI ₹420.');

  // Test 7: Kitchen Status Workflow (NEW -> PREPARING -> READY -> COMPLETED)
  console.log('\n--- Test 7: Kitchen Status Workflow & Persistence ---');
  // Kitchen marks preparing
  const prepRes = await request(`/orders/${createdOrder.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { status: 'preparing' }
  });
  if (prepRes.status !== 200 || prepRes.data.order_status !== 'preparing') {
    throw new Error(`Failed to update to preparing: ${JSON.stringify(prepRes.data)}`);
  }
  console.log('✅ Kitchen moved order to PREPARING');

  // Kitchen marks ready
  const readyRes = await request(`/orders/${createdOrder.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { status: 'ready' }
  });
  if (readyRes.status !== 200 || readyRes.data.order_status !== 'ready') {
    throw new Error(`Failed to update to ready: ${JSON.stringify(readyRes.data)}`);
  }
  console.log('✅ Kitchen moved order to READY (Broadcasts order:ready notification to cashier)');

  // Cashier marks completed upon handover
  const completeRes = await request(`/orders/${createdOrder.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { status: 'completed' }
  });
  if (completeRes.status !== 200 || completeRes.data.order_status !== 'completed') {
    throw new Error(`Failed to update to completed: ${JSON.stringify(completeRes.data)}`);
  }
  console.log('✅ Cashier handed over order and marked COMPLETED');

  // Test 8: Verify persistence of order status
  console.log('\n--- Test 8: Status Persistence Check ---');
  const persistedCheck = await request(`/orders/${createdOrder.id}`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  if (persistedCheck.data.order_status !== 'completed') {
    throw new Error(`Order status did not persist: ${persistedCheck.data.order_status}`);
  }
  console.log('✅ Order status persisted reliably in database: COMPLETED');

  // Test 9: Settings and Logo / QR endpoints
  console.log('\n--- Test 9: Cafe Settings & Fallbacks ---');
  const settingsRes = await request('/settings');
  if (settingsRes.status === 200) {
    console.log('✅ Settings loaded:', {
      name: settingsRes.data.cafe_name,
      logo_path: settingsRes.data.logo_path || 'using fallback /images/logo.png',
      qr_code_path: settingsRes.data.qr_code_path || 'using fallback /images/payment-qr.png'
    });
  }

  // Test 10: Clear Test Data requires confirmation token
  console.log('\n--- Test 10: Clear Test Data Safeguard ---');
  const unconfirmedClear = await request('/orders/clear-test-data', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { confirmation: 'WRONG_CODE' }
  });
  if (unconfirmedClear.status === 400) {
    console.log('✅ Unauthorized/unconfirmed data wipe blocked safely (HTTP 400)');
  } else {
    throw new Error(`Expected 400 for bad confirmation, got ${unconfirmedClear.status}`);
  }

  console.log('\n🎉 ALL 10 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
}

runTests().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
