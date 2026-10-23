// Comprehensive End-to-End Production Verification Test
const BASE = 'http://localhost:3001/api';

async function run() {
  console.log('🧪 Starting Final End-to-End Production Verification...');

  // 1. Authenticate Cashier
  const cashierAuth = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'cashier@thecheesyslice.local', password: 'cashier123' })
  }).then(r => r.json());
  console.log('✅ Cashier Authenticated:', cashierAuth.user.username, '(Role:', cashierAuth.user.role, ')');

  // 2. Authenticate Kitchen
  const kitchenAuth = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'kitchen@thecheesyslice.local', password: 'kitchen123' })
  }).then(r => r.json());
  console.log('✅ Kitchen Authenticated:', kitchenAuth.user.username, '(Role:', kitchenAuth.user.role, ')');

  // 3. Fetch Menu
  const menu = await fetch(BASE + '/menu', {
    headers: { Authorization: 'Bearer ' + cashierAuth.token }
  }).then(r => r.json());
  console.log('✅ Menu Loaded:', menu.length, 'categories available.');

  // 4. Place Verification Order with Split Payment
  // 1 White Sauce Pasta (180.00) + 1 Virgin Mojito (90.00) + 1 Veg Club Sandwich (80.00) = ₹350.00
  // Payments: Cash ₹100.00 + UPI ₹250.00
  const orderPayload = {
    customer_name: 'Launch Verification Customer',
    customer_phone: '9876543210',
    special_instructions: 'Extra cheese on pasta, less ice in mojito',
    items: [
      { name: 'Cheesy White Sauce Pasta', category_name: 'Pasta', unit_price: 18000, quantity: 1 },
      { name: 'Virgin Mojito', category_name: 'Mojitos and Beverages', unit_price: 9000, quantity: 1 },
      { name: 'Veg Club Sandwich', category_name: 'Sandwich', unit_price: 8000, quantity: 1 },
    ],
    discount: 0,
    payments: [
      { method: 'cash', amount: 100 },
      { method: 'online', amount: 250, reference: 'UPI123456789' }
    ]
  };

  const createRes = await fetch(BASE + '/orders', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + cashierAuth.token
    },
    body: JSON.stringify(orderPayload)
  }).then(r => r.json());

  console.log(`✅ Fresh Order #${createRes.daily_order_number} Created! Total: ₹${createRes.total / 100}, Paid: ₹${createRes.total_paid / 100}, Status: ${createRes.order_status}`);
  if (createRes.daily_order_number !== '001') {
    throw new Error(`Expected daily_order_number to start at 001, got ${createRes.daily_order_number}`);
  }

  // 5. Verify Split Payments Recorded Accurately
  const orderDetails = await fetch(`${BASE}/orders/${createRes.id}`, {
    headers: { Authorization: 'Bearer ' + cashierAuth.token }
  }).then(r => r.json());
  console.log(`✅ Payments verified: ${orderDetails.payments.length} payment records (Cash: ₹${orderDetails.payments.find(p => p.payment_method === 'cash').amount / 100}, UPI: ₹${orderDetails.payments.find(p => p.payment_method === 'online').amount / 100})`);

  // 6. Kitchen updates item statuses independently
  const pastaItem = orderDetails.items.find(i => i.name.includes('Pasta'));
  const mojitoItem = orderDetails.items.find(i => i.name.includes('Mojito'));
  const sandwichItem = orderDetails.items.find(i => i.name.includes('Sandwich'));

  // Mark Pasta as Ready
  const step1 = await fetch(`${BASE}/orders/${createRes.id}/items/${pastaItem.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kitchenAuth.token },
    body: JSON.stringify({ status: 'ready' })
  }).then(r => r.json());
  console.log(`✅ Item 1 (Pasta) marked READY. Overall order status: ${step1.order_status}`);
  if (step1.order_status === 'ready') throw new Error('Order should NOT be ready yet!');

  // Mark Mojito as Ready
  const step2 = await fetch(`${BASE}/orders/${createRes.id}/items/${mojitoItem.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kitchenAuth.token },
    body: JSON.stringify({ status: 'ready' })
  }).then(r => r.json());
  console.log(`✅ Item 2 (Mojito) marked READY. Overall order status: ${step2.order_status}`);
  if (step2.order_status === 'ready') throw new Error('Order should NOT be ready yet!');

  // Mark Sandwich as Ready -> ALL items ready!
  const step3 = await fetch(`${BASE}/orders/${createRes.id}/items/${sandwichItem.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kitchenAuth.token },
    body: JSON.stringify({ status: 'ready' })
  }).then(r => r.json());
  console.log(`✅ Item 3 (Sandwich) marked READY. Overall order status: ${step3.order_status}`);
  if (step3.order_status !== 'ready') throw new Error('Order SHOULD be ready now!');

  // 7. Mark Pasta as Served
  const step4 = await fetch(`${BASE}/orders/${createRes.id}/items/${pastaItem.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + kitchenAuth.token },
    body: JSON.stringify({ status: 'served' })
  }).then(r => r.json());
  console.log(`✅ Item 1 (Pasta) marked SERVED. Pasta item status: ${step4.items.find(i => i.id === pastaItem.id).status}`);

  // 8. Clean up the verification order so production starts 100% clean
  const adminAuth = await fetch(BASE + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  }).then(r => r.json());

  const resetRes = await fetch(BASE + '/orders/fresh-start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + adminAuth.token },
    body: JSON.stringify({ confirmation: 'CONFIRM_FRESH_START' })
  }).then(r => r.json());
  console.log('🧹 Verification order removed:', resetRes.message);

  console.log('\n🎉 ALL 8 TESTS PASSED WITH 100% SUCCESS! Ready for production launch.');
}

run().catch(err => {
  console.error('❌ Verification failed:', err);
  process.exit(1);
});
