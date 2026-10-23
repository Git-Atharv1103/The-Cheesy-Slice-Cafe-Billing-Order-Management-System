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

async function runRoleBasedTests() {
  console.log('🧪 Starting The Cheesy Slice Role-Based Authentication & Permissions Verification...\n');

  // Test 1: Authenticate with Cashier Account
  console.log('--- Test 1: Cashier Login Verification ---');
  const cashierAuth = await request('/auth/login', {
    method: 'POST',
    body: { username: 'cashier@thecheesyslice.local', password: 'cashier123' }
  });
  if (cashierAuth.status !== 200 || cashierAuth.data.user?.role !== 'cashier') {
    throw new Error(`Cashier login failed: ${JSON.stringify(cashierAuth.data)}`);
  }
  const cashierToken = cashierAuth.data.token;
  console.log(`✅ Cashier logged in: @${cashierAuth.data.user.username} (Role: ${cashierAuth.data.user.role})`);

  // Test 2: Authenticate with Kitchen Account
  console.log('\n--- Test 2: Kitchen Display Login Verification ---');
  const kitchenAuth = await request('/auth/login', {
    method: 'POST',
    body: { username: 'kitchen@thecheesyslice.local', password: 'kitchen123' }
  });
  if (kitchenAuth.status !== 200 || kitchenAuth.data.user?.role !== 'kitchen') {
    throw new Error(`Kitchen login failed: ${JSON.stringify(kitchenAuth.data)}`);
  }
  const kitchenToken = kitchenAuth.data.token;
  console.log(`✅ Kitchen staff logged in: @${kitchenAuth.data.user.username} (Role: ${kitchenAuth.data.user.role})`);

  // Test 3: Authenticate with Admin Account
  console.log('\n--- Test 3: Admin Login Verification ---');
  const adminAuth = await request('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  if (adminAuth.status !== 200 || adminAuth.data.user?.role !== 'admin') {
    throw new Error(`Admin login failed: ${JSON.stringify(adminAuth.data)}`);
  }
  const adminToken = adminAuth.data.token;
  console.log(`✅ Admin logged in: @${adminAuth.data.user.username} (Role: ${adminAuth.data.user.role})`);

  // Test 4: Kitchen blocked from financial sales reports
  console.log('\n--- Test 4: Kitchen Blocked From Financial Sales Data (HTTP 403) ---');
  const kitchenSummary = await request('/dashboard/summary', {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  if (kitchenSummary.status !== 403) {
    throw new Error(`Kitchen was not blocked from dashboard summary! Status: ${kitchenSummary.status}`);
  }
  console.log('✅ Kitchen user blocked from /api/dashboard/summary (HTTP 403)');

  // Test 5: Kitchen blocked from mutating payment records
  console.log('\n--- Test 5: Kitchen Blocked From Payment Mutator (HTTP 403) ---');
  const kitchenPayment = await request('/orders/test-id/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { method: 'cash', amount: 100 }
  });
  if (kitchenPayment.status !== 403) {
    throw new Error(`Kitchen was not blocked from payments! Status: ${kitchenPayment.status}`);
  }
  console.log('✅ Kitchen user blocked from /api/orders/:id/payments (HTTP 403)');

  // Test 6: Kitchen blocked from placing new billing orders
  console.log('\n--- Test 6: Kitchen Blocked From Creating Billing Orders (HTTP 403) ---');
  const kitchenCreateOrder = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { customer_name: 'Hacker', items: [{ name: 'Pizza', unit_price: 1000, quantity: 1 }] }
  });
  if (kitchenCreateOrder.status !== 403) {
    throw new Error(`Kitchen was not blocked from order creation! Status: ${kitchenCreateOrder.status}`);
  }
  console.log('✅ Kitchen user blocked from POST /api/orders (HTTP 403)');

  // Test 7: Cashier can create an order with items
  console.log('\n--- Test 7: Cashier Authorized Order Creation ---');
  const orderRes = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cashierToken}` },
    body: {
      customer_name: 'Customer A',
      customer_phone: '9876543210',
      items: [
        { name: 'Cold Coffee', unit_price: 6000, quantity: 1 },
        { name: 'White Sauce Pasta', unit_price: 18000, quantity: 1 },
        { name: 'Veg Sandwich', unit_price: 8000, quantity: 1 }
      ],
      payments: [{ method: 'online', amount: 320, reference: 'PAYTM_UPI_123' }]
    }
  });
  if (orderRes.status !== 201) {
    throw new Error(`Cashier failed to create order: ${JSON.stringify(orderRes.data)}`);
  }
  const order = orderRes.data;
  console.log(`✅ Order #${order.daily_order_number} created by Cashier! (Total: ₹${order.total / 100}, Status: ${order.order_status})`);

  // Test 8: Kitchen is authorized to tick items
  console.log('\n--- Test 8: Kitchen Authorized to Update Item Preparation Status ---');
  const coffeeItem = order.items.find(i => i.name === 'Cold Coffee');
  const itemUpdateRes = await request(`/orders/${order.id}/items/${coffeeItem.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { status: 'ready' }
  });
  if (itemUpdateRes.status !== 200) {
    throw new Error(`Kitchen failed to update item status: ${JSON.stringify(itemUpdateRes.data)}`);
  }
  console.log(`✅ Kitchen ticked Cold Coffee READY! Overall order status: ${itemUpdateRes.data.order_status} (IN PROGRESS)`);

  // Test 9: Cashier blocked from admin cafe settings mutation
  console.log('\n--- Test 9: Cashier Blocked From Admin Settings Mutator (HTTP 403) ---');
  const cashierSettings = await request('/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${cashierToken}` },
    body: { cafe_name: 'Compromised Name' }
  });
  if (cashierSettings.status !== 403) {
    throw new Error(`Cashier was not blocked from editing settings! Status: ${cashierSettings.status}`);
  }
  console.log('✅ Cashier blocked from PUT /api/settings (HTTP 403)');

  // Test 10: Admin authorized user management
  console.log('\n--- Test 10: Admin User Management Workflow ---');
  const usersList = await request('/settings/users', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (usersList.status !== 200 || !Array.isArray(usersList.data)) {
    throw new Error(`Admin failed to get users list: ${JSON.stringify(usersList.data)}`);
  }
  console.log(`✅ Admin fetched user accounts (${usersList.data.length} registered staff users):`);
  usersList.data.forEach(u => console.log(`   - @${u.username} (${u.full_name}) -> Role: ${u.role}, Active: ${u.is_active}`));

  console.log('\n🎉 ALL 10 ROLE-BASED LOGIN & ACCESS CONTROL TESTS PASSED! 🎉\n');
}

runRoleBasedTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Role test error:', err.message);
    process.exit(1);
  });
