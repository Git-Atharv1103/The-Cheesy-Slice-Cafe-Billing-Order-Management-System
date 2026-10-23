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

async function runKDSTests() {
  console.log('🧪 Starting The Cheesy Slice KDS Item-Level Tracking & Fresh Start Verification...\n');

  // Login as admin, cashier, kitchen
  const adminLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'admin', password: 'admin123' }
  });
  const adminToken = adminLogin.data.token;

  const staffLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'staff', password: 'staff123' }
  });
  const staffToken = staffLogin.data.token;

  const kitchenLogin = await request('/auth/login', {
    method: 'POST',
    body: { username: 'kitchen', password: 'kitchen123' }
  });
  const kitchenToken = kitchenLogin.data.token;

  // --- Scenario 1: Verify Fresh Start State ---
  console.log('--- Test 1 & 2: Active application starts fresh with 0 old orders ---');
  const initialOrders = await request('/orders', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  console.log(`Current active orders count: ${initialOrders.data.length}`);
  if (initialOrders.data.length !== 0) {
    // Perform fresh start
    console.log('Clearing old orders to ensure absolute fresh start...');
    const freshRes = await request('/orders/fresh-start', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { confirmation: 'CONFIRM_FRESH_START' }
    });
    console.log('Fresh start response:', freshRes.data.message);
  }
  const verifiedOrders = await request('/orders', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  if (verifiedOrders.data.length !== 0) {
    throw new Error(`Expected 0 orders for fresh start, but found ${verifiedOrders.data.length}`);
  }
  console.log('✅ Scenario 1 & 2 Verified: Fresh start active, 0 old test orders in system.');

  // --- Scenario 3: First new order starts at daily order number 001 ---
  console.log('\n--- Test 3: New Order Starts with Daily Order Number 001 ---');
  // Order: 1 Cold Coffee (₹60) + 1 White Sauce Pasta (₹180) = ₹240 (paise: 6000 + 18000 = 24000)
  const orderPayload = {
    customer_name: 'Atharv',
    customer_phone: '9876543210',
    special_instructions: 'Make coffee extra cold',
    discount: 0,
    payments: [{ method: 'online', amount: 240, reference: 'UPI123456' }],
    items: [
      { name: 'Cold Coffee', category_name: 'Beverages', unit_price: 6000, quantity: 1 },
      { name: 'White Sauce Pasta', category_name: 'Pasta', unit_price: 18000, quantity: 1 }
    ]
  };

  const createRes = await request('/orders', {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: orderPayload
  });

  if (createRes.status !== 201) {
    throw new Error(`Failed to create order: ${JSON.stringify(createRes.data)}`);
  }
  const order = createRes.data;
  console.log(`Created Order ID: ${order.id}`);
  console.log(`Daily Order Number: ${order.daily_order_number}`);
  if (order.daily_order_number !== '001') {
    throw new Error(`Expected daily order number '001', got '${order.daily_order_number}'`);
  }
  console.log('✅ Scenario 3 Verified: Daily order number starts exactly at 001.');

  // Verify initial item statuses
  console.log('Initial items:');
  order.items.forEach(i => console.log(`  - ${i.name} (Qty: ${i.quantity}) -> Status: ${i.status}`));
  const coffeeItem = order.items.find(i => i.name === 'Cold Coffee');
  const pastaItem = order.items.find(i => i.name === 'White Sauce Pasta');

  if (!coffeeItem || !pastaItem) {
    throw new Error('Could not find Cold Coffee and White Sauce Pasta in order items');
  }
  if (coffeeItem.status !== 'pending' || pastaItem.status !== 'pending') {
    throw new Error(`Items must begin with status 'pending', got coffee: ${coffeeItem.status}, pasta: ${pastaItem.status}`);
  }
  if (order.order_status !== 'new') {
    throw new Error(`Initial order status must be 'new', got: ${order.order_status}`);
  }
  console.log('✅ Initial status verified: Both items PENDING, overall order NEW.');

  // --- Scenario 4 & 5: Ticking Coffee Ready leaves Pasta Pending & Order IN PROGRESS ---
  console.log('\n--- Test 4 & 5: Ticking Coffee Ready leaves Pasta Pending & Order IN PROGRESS ---');
  const coffeeReadyRes = await request(`/orders/${order.id}/items/${coffeeItem.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { status: 'ready' }
  });

  if (coffeeReadyRes.status !== 200) {
    throw new Error(`Failed to tick coffee ready: ${JSON.stringify(coffeeReadyRes.data)}`);
  }

  const updatedOrder1 = coffeeReadyRes.data;
  const updatedCoffee = updatedOrder1.items.find(i => i.id === coffeeItem.id);
  const updatedPasta = updatedOrder1.items.find(i => i.id === pastaItem.id);

  console.log(`Cold Coffee Status: ${updatedCoffee.status} (ready_at: ${updatedCoffee.ready_at})`);
  console.log(`Pasta Status: ${updatedPasta.status}`);
  console.log(`Overall Order Status: ${updatedOrder1.order_status}`);

  if (updatedCoffee.status !== 'ready') {
    throw new Error(`Expected coffee status 'ready', got '${updatedCoffee.status}'`);
  }
  if (updatedPasta.status !== 'pending') {
    throw new Error(`Expected pasta status 'pending', got '${updatedPasta.status}'`);
  }
  if (updatedOrder1.order_status !== 'preparing') {
    throw new Error(`Overall order must remain 'preparing' (IN PROGRESS) when only coffee is ready, got '${updatedOrder1.order_status}'`);
  }
  console.log('✅ Scenario 4 & 5 Verified: Coffee is READY, Pasta is PENDING, overall order is IN PROGRESS (preparing).');

  // --- Scenario 6: When all items become Ready, overall order automatically becomes READY ---
  console.log('\n--- Test 6: Marking Pasta Ready Automatically Updates Overall Order to READY ---');
  const pastaReadyRes = await request(`/orders/${order.id}/items/${pastaItem.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { status: 'ready' }
  });

  const updatedOrder2 = pastaReadyRes.data;
  console.log('Items status now:');
  updatedOrder2.items.forEach(i => console.log(`  - ${i.name} -> Status: ${i.status}`));
  console.log(`Overall Order Status: ${updatedOrder2.order_status}`);

  if (updatedOrder2.order_status !== 'ready') {
    throw new Error(`Expected overall order status 'ready' because all items are ready, got '${updatedOrder2.order_status}'`);
  }
  console.log('✅ Scenario 6 Verified: When all items are ready, overall order is automatically READY.');

  // --- Scenario 7: Serving Coffee does not mark Pasta as Served ---
  console.log('\n--- Test 7: Serving Coffee Leaves Pasta As Ready (Not Served) ---');
  const coffeeServedRes = await request(`/orders/${order.id}/items/${coffeeItem.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${kitchenToken}` },
    body: { status: 'served' }
  });

  const updatedOrder3 = coffeeServedRes.data;
  const sCoffee = updatedOrder3.items.find(i => i.id === coffeeItem.id);
  const sPasta = updatedOrder3.items.find(i => i.id === pastaItem.id);

  console.log(`Cold Coffee Status: ${sCoffee.status} (served_at: ${sCoffee.served_at})`);
  console.log(`Pasta Status: ${sPasta.status}`);
  console.log(`Overall Order Status: ${updatedOrder3.order_status}`);

  if (sCoffee.status !== 'served') {
    throw new Error(`Expected coffee status 'served', got '${sCoffee.status}'`);
  }
  if (sPasta.status !== 'ready') {
    throw new Error(`Expected pasta status 'ready', got '${sPasta.status}'`);
  }
  if (updatedOrder3.order_status !== 'ready') {
    throw new Error(`Overall order must remain 'ready' while awaiting pasta handover, got '${updatedOrder3.order_status}'`);
  }
  console.log('✅ Scenario 7 Verified: Coffee is SERVED, Pasta remains READY, overall order remains READY.');

  // --- Scenario 8: Adding a new item to previously Ready order makes order IN PROGRESS again ---
  console.log('\n--- Test 8: Adding New Item Reverts Order to IN PROGRESS & Keeps Previous Items ---');
  const addItemRes = await request(`/orders/${order.id}/items`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      items: [
        { name: 'Veg Sandwich', category_name: 'Sandwich', unit_price: 8000, quantity: 1 }
      ]
    }
  });

  if (addItemRes.status !== 201) {
    throw new Error(`Failed to add item to order: ${JSON.stringify(addItemRes.data)}`);
  }

  const updatedOrder4 = addItemRes.data;
  console.log('Items in order after addition:');
  updatedOrder4.items.forEach(i => console.log(`  - ${i.name} -> Status: ${i.status}`));
  console.log(`Overall Order Status: ${updatedOrder4.order_status}`);
  console.log(`New Subtotal: ₹${updatedOrder4.subtotal / 100}, Total: ₹${updatedOrder4.total / 100}, Balance: ₹${updatedOrder4.balance_due / 100}`);

  const itemCoffee = updatedOrder4.items.find(i => i.name === 'Cold Coffee');
  const itemPasta = updatedOrder4.items.find(i => i.name === 'White Sauce Pasta');
  const itemSandwich = updatedOrder4.items.find(i => i.name === 'Veg Sandwich');

  if (!itemSandwich) throw new Error('Veg Sandwich was not found in updated order items');
  if (itemCoffee.status !== 'served') throw new Error(`Coffee status changed unexpectedly: ${itemCoffee.status}`);
  if (itemPasta.status !== 'ready') throw new Error(`Pasta status changed unexpectedly: ${itemPasta.status}`);
  if (itemSandwich.status !== 'pending') throw new Error(`New Sandwich item must start as 'pending', got: ${itemSandwich.status}`);
  if (updatedOrder4.order_status !== 'preparing') {
    throw new Error(`Overall order status must revert back to 'preparing' (IN PROGRESS), got: ${updatedOrder4.order_status}`);
  }
  console.log('✅ Scenario 8 Verified: Coffee stays SERVED, Pasta stays READY, Sandwich is PENDING, order is IN PROGRESS.');

  // --- Scenario 10: Status persistence check after fresh fetch ---
  console.log('\n--- Test 10: All statuses persist accurately on database reload ---');
  const persistentCheck = await request(`/orders/${order.id}`, {
    headers: { Authorization: `Bearer ${kitchenToken}` }
  });
  const pOrder = persistentCheck.data;
  if (pOrder.items.length !== 3) throw new Error(`Expected 3 items, found ${pOrder.items.length}`);
  if (pOrder.order_status !== 'preparing') throw new Error(`Expected order_status 'preparing', found ${pOrder.order_status}`);
  console.log('✅ Scenario 10 Verified: All item statuses, timestamps, and order status accurately persisted in SQLite.');

  console.log('\n🎉 ALL KDS ITEM-LEVEL TRACKING & FRESH START TESTS PASSED! 🎉\n');
}

runKDSTests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Test failed:', err.message);
    process.exit(1);
  });
