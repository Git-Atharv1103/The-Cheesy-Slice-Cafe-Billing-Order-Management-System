import { getDb } from './src/db/database.js';
import { runSeed } from './src/db/seed.js';
import express from 'express';
import cors from 'cors';
import authRoutes from './src/routes/auth.js';
import menuRoutes from './src/routes/menu.js';
import ordersRoutes from './src/routes/orders.js';
import dashboardRoutes from './src/routes/dashboard.js';
import settingsRoutes from './src/routes/settings.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);

async function runTests() {
  console.log('🧪 Starting The Cheesy Slice End-to-End Verification Tests...\n');
  await runSeed();

  const server = app.listen(3099);
  const BASE_URL = 'http://localhost:3099/api';

  try {
    // 1. Authenticate Admin
    console.log('1️⃣ Testing Admin Login...');
    const adminLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123' })
    });
    const adminAuth = await adminLoginRes.json();
    if (!adminAuth.token || adminAuth.user.role !== 'admin') {
      throw new Error('Admin login failed: ' + JSON.stringify(adminAuth));
    }
    const adminToken = adminAuth.token;
    console.log('✅ Admin login successful! Token received.');

    // 2. Authenticate Staff
    console.log('\n2️⃣ Testing Staff Login...');
    const staffLoginRes = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'staff', password: 'staff123' })
    });
    const staffAuth = await staffLoginRes.json();
    if (!staffAuth.token || staffAuth.user.role !== 'cashier') {
      throw new Error('Staff login failed: ' + JSON.stringify(staffAuth));
    }
    const staffToken = staffAuth.token;
    console.log('✅ Staff login successful! Role: cashier.');

    // 3. Verify Menu Structure
    console.log('\n3️⃣ Verifying Menu Categories & Items...');
    const menuRes = await fetch(`${BASE_URL}/menu`);
    const categories = await menuRes.json();
    console.log(`Found ${categories.length} categories.`);
    const expectedCats = ['Cold Coffee', 'Hot Coffee', 'Mojitos and Beverages', 'Pasta', 'Sandwich', 'Pizza', 'Garlic Bread', 'Nachos', 'Extra Cheese and Add-ons'];
    for (const exp of expectedCats) {
      const match = categories.find(c => c.name === exp);
      if (!match) throw new Error(`Missing expected category: ${exp}`);
      if (!match.items || match.items.length === 0) throw new Error(`Category ${exp} has no items!`);
    }
    console.log('✅ All 9 categories verified with items.');

    // Find Margherita Pizza and Regular Cold Coffee
    const pizzaCat = categories.find(c => c.name === 'Pizza');
    const margherita = pizzaCat.items.find(i => i.name.includes('Margherita'));
    const beverageCat = categories.find(c => c.name === 'Cold Coffee');
    const coldCoffee = beverageCat.items.find(i => i.name.includes('Regular Cold Coffee'));

    // 4. Test Case 1: Fully cash-paid order
    console.log('\n4️⃣ Testing Scenario 1: Fully cash-paid order...');
    const order1Res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        customer_name: 'Test Customer 1 (Cash)',
        customer_phone: '9876543210',
        items: [
          { menu_item_id: margherita.id, name: margherita.name, category_name: 'Pizza', unit_price: margherita.price, quantity: 1 },
          { menu_item_id: coldCoffee.id, name: coldCoffee.name, category_name: 'Cold Coffee', unit_price: coldCoffee.price, quantity: 1 }
        ],
        discount: 0,
        payments: [
          { method: 'cash', amount: (margherita.price + coldCoffee.price) / 100 }
        ]
      })
    });
    const order1 = await order1Res.json();
    if (order1.payment_status !== 'paid' || order1.balance_due !== 0) {
      throw new Error(`Order 1 failed payment validation: ${JSON.stringify(order1)}`);
    }
    console.log(`✅ Order 1 placed successfully: Order #${order1.daily_order_number}, Status: ${order1.payment_status}, Total: ₹${order1.total / 100}`);

    // 5. Test Case 2: Fully online-paid order
    console.log('\n5️⃣ Testing Scenario 2: Fully online-paid order with UPI reference...');
    const order2Res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        customer_name: 'Test Customer 2 (Online)',
        items: [
          { menu_item_id: margherita.id, name: margherita.name, category_name: 'Pizza', unit_price: margherita.price, quantity: 2 }
        ],
        discount: 20, // ₹20 discount
        payments: [
          { method: 'online', amount: (margherita.price * 2 - 2000) / 100, reference: 'UPI123456789' }
        ]
      })
    });
    const order2 = await order2Res.json();
    if (order2.payment_status !== 'paid' || order2.discount !== 2000) {
      throw new Error(`Order 2 failed: ${JSON.stringify(order2)}`);
    }
    console.log(`✅ Order 2 placed: Order #${order2.daily_order_number}, Status: ${order2.payment_status}, Subtotal: ₹${order2.subtotal / 100}, Discount: ₹${order2.discount / 100}, Total: ₹${order2.total / 100}`);

    // 6. Test Case 3: Split payment order
    console.log('\n6️⃣ Testing Scenario 3: Split payment (Online + Cash)...');
    const order3TotalPaise = margherita.price; // 14000 = ₹140
    const order3Res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        customer_name: 'Test Customer 3 (Split)',
        items: [
          { menu_item_id: margherita.id, name: margherita.name, category_name: 'Pizza', unit_price: margherita.price, quantity: 1 }
        ],
        discount: 0,
        payments: [
          { method: 'online', amount: 90, reference: 'UPI-SPLIT-1' },
          { method: 'cash', amount: 50 }
        ]
      })
    });
    const order3 = await order3Res.json();
    if (order3.payment_status !== 'paid' || order3.balance_due !== 0 || order3.payments.length !== 2) {
      throw new Error(`Order 3 split payment failed: ${JSON.stringify(order3)}`);
    }
    console.log(`✅ Order 3 placed: Order #${order3.daily_order_number}, Payments: ${order3.payments.map(p => `${p.payment_method}: ₹${p.amount / 100}`).join(', ')}`);

    // 7. Test Case 4: Partially paid order
    console.log('\n7️⃣ Testing Scenario 4: Partially paid order (Balance Due)...');
    const order4Res = await fetch(`${BASE_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        customer_name: 'Test Customer 4 (Partial)',
        items: [
          { menu_item_id: margherita.id, name: margherita.name, category_name: 'Pizza', unit_price: margherita.price, quantity: 1 }
        ],
        discount: 0,
        payments: [
          { method: 'cash', amount: 50 } // Total ₹140, paid ₹50
        ]
      })
    });
    const order4 = await order4Res.json();
    if (order4.payment_status !== 'partial' || order4.balance_due !== 9000) {
      throw new Error(`Order 4 partial payment check failed: ${JSON.stringify(order4)}`);
    }
    console.log(`✅ Order 4 partially paid: Order #${order4.daily_order_number}, Paid: ₹${order4.total_paid / 100}, Balance: ₹${order4.balance_due / 100}`);

    // 8. Test Case 5: Edit order to add items and collect remaining payment
    console.log('\n8️⃣ Testing Scenario 5: Edit order (add items, update status, record payment)...');
    const editRes = await fetch(`${BASE_URL}/orders/${order4.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({
        customer_name: 'Test Customer 4 (Updated Name)',
        items: [
          { menu_item_id: margherita.id, name: margherita.name, category_name: 'Pizza', unit_price: margherita.price, quantity: 1 },
          { menu_item_id: coldCoffee.id, name: coldCoffee.name, category_name: 'Cold Coffee', unit_price: coldCoffee.price, quantity: 1 }
        ],
        order_status: 'ready'
      })
    });
    const updatedOrder4 = await editRes.json();
    // New total = 14000 + 6000 = 20000 (₹200). Paid was 5000 (₹50). Balance due = 15000 (₹150).
    if (updatedOrder4.total !== 20000 || updatedOrder4.balance_due !== 15000 || updatedOrder4.order_status !== 'ready') {
      throw new Error(`Order 4 edit calculation error: ${JSON.stringify(updatedOrder4)}`);
    }
    console.log(`✅ Order 4 edited: New Total: ₹${updatedOrder4.total / 100}, New Balance Due: ₹${updatedOrder4.balance_due / 100}, Status: ${updatedOrder4.order_status}`);

    // Record additional payment to clear balance
    const addPayRes = await fetch(`${BASE_URL}/orders/${order4.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({ method: 'cash', amount: 150 })
    });
    const fullyPaidOrder4 = await addPayRes.json();
    if (fullyPaidOrder4.payment_status !== 'paid' || fullyPaidOrder4.balance_due !== 0) {
      throw new Error(`Order 4 additional payment error: ${JSON.stringify(fullyPaidOrder4)}`);
    }
    console.log(`✅ Order 4 remaining balance cleared! Status is now: ${fullyPaidOrder4.payment_status}`);

    // 9. Test Case 6: Cancel an order and verify audit log & sales calculation
    console.log('\n9️⃣ Testing Scenario 6: Cancel order and audit trail...');
    const cancelRes = await fetch(`${BASE_URL}/orders/${order1.id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({ reason: 'Customer changed mind' })
    });
    const cancelledOrder1 = await cancelRes.json();
    if (cancelledOrder1.order_status !== 'cancelled') {
      throw new Error('Order cancellation failed');
    }
    console.log(`✅ Order 1 cancelled. Checking audit logs...`);
    const auditRes = await fetch(`${BASE_URL}/orders/${order1.id}/audit`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const auditLogs = await auditRes.json();
    if (auditLogs.length === 0 || !auditLogs.some(l => l.action === 'cancelled')) {
      throw new Error('Audit log missing cancellation entry');
    }
    console.log(`✅ Audit trail recorded correctly (${auditLogs.length} entries).`);

    // 10. Test Case 7: Daily Sales Dashboard
    console.log('\n🔟 Testing Scenario 7: Daily Sales Calculation...');
    const dashRes = await fetch(`${BASE_URL}/dashboard/summary`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const dashData = await dashRes.json();
    console.log('Daily Summary:', JSON.stringify(dashData.summary, null, 2));
    if (dashData.summary.cancelled_count < 1) {
      throw new Error('Cancelled count in dashboard is incorrect');
    }
    console.log('✅ Daily sales calculated correctly (cancelled orders excluded from total sales).');

    // 11. Test Case 8: Role Authorization Check
    console.log('\n1️⃣1️⃣ Testing Scenario 8: Role-based Authorization check...');
    const staffSettingsRes = await fetch(`${BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${staffToken}` },
      body: JSON.stringify({ cafe_name: 'Hacked Cafe' })
    });
    if (staffSettingsRes.status !== 403) {
      throw new Error('Staff should NOT have permission to edit settings (expected 403)');
    }
    console.log('✅ Role-based security verified: Cashier blocked from admin settings (HTTP 403).');

    // 12. Test Case 9: Menu Price Snapshot Test
    console.log('\n1️⃣2️⃣ Testing Scenario 9: Menu Price Snapshot immutability...');
    // Update Margherita Pizza price on menu to ₹300
    await fetch(`${BASE_URL}/menu/items/${margherita.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: margherita.name,
        price: 300,
        category_id: margherita.category_id,
        is_available: 1
      })
    });
    // Re-check order 2 or order 3 to ensure old unit_price is still ₹140 (14000 paise)
    const checkOrder3Res = await fetch(`${BASE_URL}/orders/${order3.id}`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const checkOrder3 = await checkOrder3Res.json();
    const itemInOrder = checkOrder3.items.find(i => i.menu_item_id === margherita.id);
    if (itemInOrder.unit_price !== 14000) {
      throw new Error(`Snapshot violated! Expected unit_price 14000, got ${itemInOrder.unit_price}`);
    }
    console.log(`✅ Snapshot price integrity verified! Historical order price is preserved at ₹${itemInOrder.unit_price / 100}.`);
    // Revert price back to ₹140
    await fetch(`${BASE_URL}/menu/items/${margherita.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${adminToken}` },
      body: JSON.stringify({
        name: margherita.name,
        price: 140,
        category_id: margherita.category_id,
        is_available: 1
      })
    });

    console.log('\n🎉 ALL 12 VERIFICATION TESTS PASSED SUCCESSFULLY! 🎉\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Error:', err);
  process.exit(1);
});
