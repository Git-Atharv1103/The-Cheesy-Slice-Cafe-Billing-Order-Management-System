import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import { broadcastEvent } from '../services/events.js';

const router = express.Router();

// Helper: get today's IST date as YYYY-MM-DD
function getISTDate() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Helper: get next daily order number (atomic-ish using SQLite)
async function getNextOrderNumber(db, date) {
  const existing = await db.execute({
    sql: 'SELECT last_sequence FROM daily_order_sequences WHERE date = ?',
    args: [date]
  });

  let nextSeq;
  if (existing.rows.length === 0) {
    await db.execute({
      sql: 'INSERT INTO daily_order_sequences (date, last_sequence) VALUES (?, 1)',
      args: [date]
    });
    nextSeq = 1;
  } else {
    nextSeq = Number(existing.rows[0].last_sequence) + 1;
    await db.execute({
      sql: 'UPDATE daily_order_sequences SET last_sequence = ? WHERE date = ?',
      args: [nextSeq, date]
    });
  }
  return String(nextSeq).padStart(3, '0');
}

// Helper: automatically recalculate overall order status based on individual item statuses
export async function recalculateOrderStatus(db, orderId) {
  const existingOrder = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [orderId] });
  if (existingOrder.rows.length === 0) return null;
  const order = existingOrder.rows[0];

  // If order was explicitly cancelled, don't auto-modify
  if (order.order_status === 'cancelled') {
    const full = await getFullOrder(db, orderId);
    return { orderStatus: 'cancelled', changed: false, order: full, counts: {} };
  }

  const itemsResult = await db.execute({
    sql: 'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at',
    args: [orderId]
  });
  const items = itemsResult.rows;

  if (items.length === 0) {
    const full = await getFullOrder(db, orderId);
    return { orderStatus: order.order_status, changed: false, order: full, counts: {} };
  }

  const totalCount = items.length;
  const readyOrServedCount = items.filter(i => i.status === 'ready' || i.status === 'served').length;
  const servedCount = items.filter(i => i.status === 'served').length;
  const readyCount = items.filter(i => i.status === 'ready').length;
  const pendingCount = items.filter(i => !i.status || i.status === 'pending').length;
  const preparingCount = items.filter(i => i.status === 'preparing').length;

  let newOrderStatus = 'preparing'; // In Progress

  if (servedCount === totalCount) {
    // All items served to customer
    newOrderStatus = 'completed';
  } else if (readyOrServedCount === totalCount) {
    // All items are prepared and ready for handover
    newOrderStatus = 'ready';
  } else if (pendingCount === totalCount) {
    // No work started yet
    newOrderStatus = 'new';
  } else {
    // Some are preparing, or some ready while others are pending/preparing -> IN PROGRESS
    newOrderStatus = 'preparing';
  }

  const changed = newOrderStatus !== order.order_status;
  if (changed) {
    await db.execute({
      sql: `UPDATE orders SET order_status = ?, updated_at = datetime('now') WHERE id = ?`,
      args: [newOrderStatus, orderId]
    });
  }

  const updatedOrder = await getFullOrder(db, orderId);
  return {
    orderStatus: newOrderStatus,
    previousStatus: order.order_status,
    changed,
    order: updatedOrder,
    counts: {
      total: totalCount,
      readyOrServed: readyOrServedCount,
      ready: readyCount,
      served: servedCount,
      pending: pendingCount,
      preparing: preparingCount,
    }
  };
}

// Recent order deduplication cache to prevent accidental double-click duplicates
const recentOrdersMap = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of recentOrdersMap.entries()) {
    if (now - v.time > 6000) recentOrdersMap.delete(k);
  }
}, 30000);

// POST /api/orders - Create new order (cashier & admin only)
router.post('/', authenticateToken, requireRole('admin', 'cashier', 'staff'), async (req, res) => {
  try {
    const { customer_name, customer_phone, special_instructions, items, discount, payments: paymentsList } = req.body;

    if (!customer_name || !items || items.length === 0) {
      return res.status(400).json({ error: 'Customer name and items are required' });
    }

    // Sanitize item prices and quantities to guarantee finite numbers
    const sanitizedItems = (items || []).map(item => {
      let unitPrice = item.unit_price;
      if (unitPrice === undefined || unitPrice === null || isNaN(Number(unitPrice))) {
        unitPrice = item.price != null ? (Number(item.price) > 1000 ? Number(item.price) : Math.round(Number(item.price) * 100)) : 0;
      } else {
        unitPrice = Math.round(Number(unitPrice));
      }
      if (isNaN(unitPrice) || !isFinite(unitPrice)) unitPrice = 0;
      const qty = Math.max(1, parseInt(item.quantity, 10) || 1);
      return {
        ...item,
        unit_price: unitPrice,
        quantity: qty,
        total_price: unitPrice * qty
      };
    });

    // Fast check for double-click duplicate creation within 3 seconds
    const subtotalCalc = sanitizedItems.reduce((sum, item) => sum + item.total_price, 0);
    const dedupeKey = `${req.user?.id || 'anon'}:${customer_name.trim().toLowerCase()}:${sanitizedItems.length}:${subtotalCalc}`;
    const recent = recentOrdersMap.get(dedupeKey);
    if (recent && (Date.now() - recent.time < 3000)) {
      return res.status(200).json(recent.order);
    }

    const db = getDb();
    const orderId = uuidv4();
    const orderDate = getISTDate();
    const dailyOrderNumber = await getNextOrderNumber(db, orderDate);

    // Calculate totals in paise (guaranteed non-negative finite integers)
    const subtotal = Math.max(0, Math.round(subtotalCalc) || 0);
    const discountAmt = Math.max(0, Math.round(Number(discount || 0) * 100) || 0);
    const total = Math.max(0, subtotal - discountAmt);

    // Payments
    const payments = paymentsList || [];
    const totalPaid = payments.reduce((sum, p) => {
      const amt = Math.round(Number(p.amount || 0) * 100);
      return sum + (isNaN(amt) || !isFinite(amt) ? 0 : Math.max(0, amt));
    }, 0);
    const balanceDue = Math.max(0, total - totalPaid);

    let paymentStatus = 'pending';
    if (totalPaid >= total && total > 0) paymentStatus = 'paid';
    else if (totalPaid > 0) paymentStatus = 'partial';

    const nowIso = new Date().toISOString();
    const userId = req.user?.id || 'cashier';

    // Insert order (status begins as 'new' for kitchen display)
    await db.execute({
      sql: `INSERT INTO orders (id, daily_order_number, order_date, customer_name, customer_phone, special_instructions, subtotal, discount, total, total_paid, balance_due, payment_status, order_status, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?, ?)`,
      args: [orderId, dailyOrderNumber, orderDate, customer_name, customer_phone || '', special_instructions || '', subtotal, discountAmt, total, totalPaid, balanceDue, paymentStatus, userId, nowIso, nowIso]
    });

    // Insert items with status = 'pending'
    for (const item of sanitizedItems) {
      await db.execute({
        sql: `INSERT INTO order_items (id, order_id, menu_item_id, name, category_name, unit_price, quantity, total_price, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        args: [uuidv4(), orderId, item.menu_item_id || null, item.name, item.category_name || '', item.unit_price, item.quantity, item.total_price, nowIso]
      });
    }

    // Insert payments
    for (const p of payments) {
      const pAmt = Math.round(Number(p.amount || 0) * 100);
      if (pAmt > 0 && isFinite(pAmt)) {
        const method = p.method || p.payment_method || 'cash';
        await db.execute({
          sql: `INSERT INTO payments (id, order_id, payment_method, amount, reference, payment_status, recorded_by, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
          args: [uuidv4(), orderId, method, pAmt, p.reference || '', userId, nowIso, nowIso]
        });
      }
    }

    // Audit log
    await db.execute({
      sql: `INSERT INTO order_audit_logs (id, order_id, action, new_values, performed_by, created_at) VALUES (?, ?, 'created', ?, ?, ?)`,
      args: [uuidv4(), orderId, JSON.stringify({ customer_name, total, payment_status: paymentStatus }), req.user.id, nowIso]
    });

    // Fetch full order
    const order = await getFullOrder(db, orderId);

    // Save in dedupe map to block immediate duplicate double-taps
    recentOrdersMap.set(dedupeKey, { time: Date.now(), order });

    // Broadcast real-time notification to Kitchen Display & Cashier
    broadcastEvent('order:created', order);

    res.status(201).json(order);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/orders - List orders with filters (Optimized with Batch Queries - No N+1 queries)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { date, date_from, date_to, payment_status, order_status, search, limit = 100, offset = 0 } = req.query;
    const db = getDb();

    let sql = 'SELECT * FROM orders WHERE 1=1';
    const args = [];

    if (date) {
      sql += ' AND order_date = ?'; args.push(date);
    } else if (date_from && date_to) {
      sql += ' AND order_date BETWEEN ? AND ?'; args.push(date_from, date_to);
    }
    if (payment_status) { sql += ' AND payment_status = ?'; args.push(payment_status); }
    if (order_status) { sql += ' AND order_status = ?'; args.push(order_status); }
    if (search) {
      sql += ' AND (customer_name LIKE ? OR daily_order_number LIKE ? OR customer_phone LIKE ?)';
      args.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    args.push(Number(limit), Number(offset));

    const ordersResult = await db.execute({ sql, args });
    const orderRows = ordersResult.rows;

    if (orderRows.length === 0) {
      return res.json([]);
    }

    // Batch load items and payments in 2 parallel queries instead of 2 * N serial roundtrips
    const orderIds = orderRows.map(o => o.id);
    const placeholders = orderIds.map(() => '?').join(',');

    const [itemsResult, paymentsResult] = await Promise.all([
      db.execute({
        sql: `SELECT * FROM order_items WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
        args: orderIds
      }),
      db.execute({
        sql: `SELECT * FROM payments WHERE order_id IN (${placeholders}) ORDER BY created_at ASC`,
        args: orderIds
      })
    ]);

    const itemsByOrder = new Map();
    for (const item of itemsResult.rows) {
      const existing = itemsByOrder.get(item.order_id);
      if (existing) {
        existing.push(item);
      } else {
        itemsByOrder.set(item.order_id, [item]);
      }
    }

    const paymentsByOrder = new Map();
    for (const payment of paymentsResult.rows) {
      const existing = paymentsByOrder.get(payment.order_id);
      if (existing) {
        existing.push(payment);
      } else {
        paymentsByOrder.set(payment.order_id, [payment]);
      }
    }

    const result = orderRows.map(order => ({
      ...order,
      items: itemsByOrder.get(order.id) || [],
      payments: paymentsByOrder.get(order.id) || []
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/orders/:id
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const order = await getFullOrder(db, req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PATCH /api/orders/:orderId/items/:itemId/status - Dedicated item status checkbox/button in KDS
router.patch('/:orderId/items/:itemId/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { orderId, itemId } = req.params;
    const { status } = req.body;

    const validItemStatuses = ['pending', 'preparing', 'ready', 'served'];
    if (!status || !validItemStatuses.includes(status)) {
      return res.status(400).json({ error: `Invalid item status. Allowed: ${validItemStatuses.join(', ')}` });
    }

    const itemResult = await db.execute({
      sql: 'SELECT * FROM order_items WHERE id = ? AND order_id = ?',
      args: [itemId, orderId]
    });
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Order item not found' });
    }
    const currentItem = itemResult.rows[0];

    // Timestamp handling
    let readyAt = currentItem.ready_at;
    let servedAt = currentItem.served_at;
    const nowIso = new Date().toISOString();

    if (status === 'ready' && !readyAt) {
      readyAt = nowIso;
    } else if (status === 'served') {
      if (!readyAt) readyAt = nowIso;
      if (!servedAt) servedAt = nowIso;
    } else if (status === 'pending') {
      readyAt = null;
      servedAt = null;
    }

    await db.execute({
      sql: `UPDATE order_items SET status = ?, ready_at = ?, served_at = ? WHERE id = ?`,
      args: [status, readyAt, servedAt, itemId]
    });

    // Audit log
    await db.execute({
      sql: `INSERT INTO order_audit_logs (id, order_id, action, previous_values, new_values, performed_by) VALUES (?, ?, 'item_status_change', ?, ?, ?)`,
      args: [
        uuidv4(),
        orderId,
        JSON.stringify({ item_id: itemId, item_name: currentItem.name, status: currentItem.status }),
        JSON.stringify({ item_id: itemId, item_name: currentItem.name, status }),
        req.user.id
      ]
    });

    // Recalculate overall order status
    const recalc = await recalculateOrderStatus(db, orderId);
    const updatedOrder = recalc.order;

    const readyCount = recalc.counts.readyOrServed;
    const totalCount = recalc.counts.total;

    // Real-time synchronization:
    // 1. Broadcast item status update across all connected devices
    broadcastEvent('order:item_status_updated', {
      order_id: orderId,
      daily_order_number: updatedOrder.daily_order_number,
      item_id: itemId,
      item_name: currentItem.name,
      status,
      order_status: updatedOrder.order_status,
      progress: `${readyCount} of ${totalCount} items ready`,
      counts: recalc.counts
    });

    // 2. Specific notification rules:
    // Only when ALL items are ready should the full-order ready notification fire
    if (updatedOrder.order_status === 'ready' && recalc.changed) {
      broadcastEvent('order:ready', updatedOrder);
    } else if (status === 'ready' && updatedOrder.order_status !== 'ready') {
      // Individual item ready, overall order still in progress
      broadcastEvent('order:item_ready', {
        order_id: orderId,
        daily_order_number: updatedOrder.daily_order_number,
        item_id: itemId,
        item_name: currentItem.name,
        progress: `${readyCount} of ${totalCount} items ready — In Progress`
      });
    }

    // Broadcast full order update
    broadcastEvent('order:updated', updatedOrder);

    res.json(updatedOrder);
  } catch (err) {
    console.error('Error updating item status:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/orders/:orderId/items - Add items to existing order
router.post('/:orderId/items', authenticateToken, requireRole('admin', 'cashier', 'staff'), async (req, res) => {
  try {
    const db = getDb();
    const { orderId } = req.params;
    const { items: newItemsList } = req.body;

    if (!newItemsList || !Array.isArray(newItemsList) || newItemsList.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }

    const orderResult = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [orderId] });
    if (orderResult.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = orderResult.rows[0];

    if (order.order_status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add items to a cancelled order' });
    }

    let addedSubtotal = 0;
    const insertedItems = [];
    const nowIso = new Date().toISOString();

    for (const item of newItemsList) {
      const itemId = uuidv4();
      const unitPrice = Number(item.unit_price);
      const quantity = Number(item.quantity || 1);
      const totalPrice = unitPrice * quantity;
      addedSubtotal += totalPrice;

      await db.execute({
        sql: `INSERT INTO order_items (id, order_id, menu_item_id, name, category_name, unit_price, quantity, total_price, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
        args: [itemId, orderId, item.menu_item_id || null, item.name, item.category_name || '', unitPrice, quantity, totalPrice, nowIso]
      });

      insertedItems.push({ id: itemId, name: item.name, quantity });
    }

    // Update order subtotal, total, and balance
    const newSubtotal = Number(order.subtotal) + addedSubtotal;
    const newTotal = newSubtotal - Number(order.discount);
    const totalPaid = Number(order.total_paid);
    const newBalanceDue = Math.max(0, newTotal - totalPaid);

    let paymentStatus = 'pending';
    if (totalPaid >= newTotal && newTotal > 0) paymentStatus = 'paid';
    else if (totalPaid > 0) paymentStatus = 'partial';

    await db.execute({
      sql: `UPDATE orders SET subtotal = ?, total = ?, balance_due = ?, payment_status = ?, updated_at = ? WHERE id = ?`,
      args: [newSubtotal, newTotal, newBalanceDue, paymentStatus, nowIso, orderId]
    });

    // Audit log
    await db.execute({
      sql: `INSERT INTO order_audit_logs (id, order_id, action, new_values, performed_by) VALUES (?, ?, 'items_added', ?, ?)`,
      args: [uuidv4(), orderId, JSON.stringify({ added_items: insertedItems, addedSubtotal }), req.user.id]
    });

    // Recalculate order status: since newly added items are 'pending',
    // if the order was previously 'ready' or 'completed', it will automatically become 'preparing' (In Progress)!
    const recalc = await recalculateOrderStatus(db, orderId);
    const updatedOrder = recalc.order;

    // Broadcast item added event to kitchen and cashier
    broadcastEvent('order:item_added', {
      order_id: orderId,
      daily_order_number: updatedOrder.daily_order_number,
      added_items: insertedItems,
      order_status: updatedOrder.order_status,
      message: `New item added to Order #${updatedOrder.daily_order_number}`
    });
    broadcastEvent('order:updated', updatedOrder);

    res.status(201).json(updatedOrder);
  } catch (err) {
    console.error('Error adding items:', err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PUT /api/orders/:id - Update order (preserves existing item statuses)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { customer_name, customer_phone, special_instructions, items, discount, order_status } = req.body;

    const existing = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const prev = existing.rows[0];

    if (prev.order_status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot edit a cancelled order' });
    }

    let subtotal = Number(prev.subtotal);
    let discountAmt = Number(prev.discount);

    if (items) {
      subtotal = items.reduce((sum, item) => sum + (item.unit_price * item.quantity), 0);
      
      // Fetch existing items to preserve their status, ready_at, served_at!
      const existingItemsRes = await db.execute({ sql: 'SELECT * FROM order_items WHERE order_id = ?', args: [id] });
      const existingMap = new Map();
      existingItemsRes.rows.forEach(item => existingMap.set(item.id, item));

      const retainedItemIds = [];

      for (const item of items) {
        if (item.id && existingMap.has(item.id)) {
          // Existing item: preserve status, ready_at, served_at
          await db.execute({
            sql: `UPDATE order_items SET name=?, category_name=?, unit_price=?, quantity=?, total_price=? WHERE id=?`,
            args: [item.name, item.category_name || '', item.unit_price, item.quantity, item.unit_price * item.quantity, item.id]
          });
          retainedItemIds.push(item.id);
        } else {
          // New item: starts as 'pending'
          const newId = uuidv4();
          await db.execute({
            sql: `INSERT INTO order_items (id, order_id, menu_item_id, name, category_name, unit_price, quantity, total_price, status)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            args: [newId, id, item.menu_item_id || null, item.name, item.category_name || '', item.unit_price, item.quantity, item.unit_price * item.quantity]
          });
          retainedItemIds.push(newId);
        }
      }

      // Delete removed items
      if (retainedItemIds.length > 0) {
        const placeholders = retainedItemIds.map(() => '?').join(',');
        await db.execute({
          sql: `DELETE FROM order_items WHERE order_id = ? AND id NOT IN (${placeholders})`,
          args: [id, ...retainedItemIds]
        });
      }
    }

    if (discount !== undefined) {
      discountAmt = Math.round(Number(discount) * 100);
    }

    const total = subtotal - discountAmt;
    const paymentsResult = await db.execute({ sql: `SELECT SUM(amount) as paid FROM payments WHERE order_id = ? AND payment_status = 'confirmed'`, args: [id] });
    const totalPaid = Number(paymentsResult.rows[0].paid || 0);
    const balanceDue = Math.max(0, total - totalPaid);

    let paymentStatus = 'pending';
    if (totalPaid >= total && total > 0) paymentStatus = 'paid';
    else if (totalPaid > 0) paymentStatus = 'partial';

    await db.execute({
      sql: `UPDATE orders SET customer_name=?, customer_phone=?, special_instructions=?, subtotal=?, discount=?, total=?, total_paid=?, balance_due=?, payment_status=?, updated_at=datetime('now') WHERE id=?`,
      args: [
        customer_name || prev.customer_name,
        customer_phone !== undefined ? customer_phone : prev.customer_phone,
        special_instructions !== undefined ? special_instructions : prev.special_instructions,
        subtotal, discountAmt, total, totalPaid, balanceDue, paymentStatus, id
      ]
    });

    // If explicit order_status override was requested and valid:
    if (order_status && order_status !== prev.order_status) {
      await db.execute({
        sql: `UPDATE orders SET order_status=?, updated_at=datetime('now') WHERE id=?`,
        args: [order_status, id]
      });
    } else {
      // Auto-recalculate from item statuses
      await recalculateOrderStatus(db, id);
    }

    // Audit log
    await db.execute({
      sql: `INSERT INTO order_audit_logs (id, order_id, action, previous_values, new_values, performed_by) VALUES (?, ?, 'updated', ?, ?, ?)`,
      args: [uuidv4(), id, JSON.stringify({ total: prev.total, order_status: prev.order_status }), JSON.stringify({ total }), req.user.id]
    });

    const updatedOrder = await getFullOrder(db, id);
    broadcastEvent('order:updated', updatedOrder);
    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// PATCH /api/orders/:id/status - Overall status change (with cascade to item statuses if applicable)
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const newStatus = (req.body.order_status || req.body.status || '').toLowerCase();

    const validStatuses = ['new', 'preparing', 'ready', 'completed', 'cancelled'];
    if (!newStatus || !validStatuses.includes(newStatus)) {
      return res.status(400).json({ error: `Invalid order status. Allowed: ${validStatuses.join(', ')}` });
    }

    const existing = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const prev = existing.rows[0];

    // Cascade appropriate item status updates
    if (newStatus === 'completed') {
      await db.execute({
        sql: `UPDATE order_items SET status = 'served', served_at = COALESCE(served_at, datetime('now')) WHERE order_id = ? AND status != 'served'`,
        args: [id]
      });
    } else if (newStatus === 'ready') {
      await db.execute({
        sql: `UPDATE order_items SET status = 'ready', ready_at = COALESCE(ready_at, datetime('now')) WHERE order_id = ? AND status IN ('pending', 'preparing')`,
        args: [id]
      });
    } else if (newStatus === 'preparing') {
      await db.execute({
        sql: `UPDATE order_items SET status = 'preparing' WHERE order_id = ? AND status = 'pending'`,
        args: [id]
      });
    }

    await db.execute({
      sql: `UPDATE orders SET order_status=?, updated_at=datetime('now') WHERE id=?`,
      args: [newStatus, id]
    });

    await db.execute({
      sql: `INSERT INTO order_audit_logs (id, order_id, action, previous_values, new_values, performed_by) VALUES (?, ?, 'status_change', ?, ?, ?)`,
      args: [uuidv4(), id, JSON.stringify({ order_status: prev.order_status }), JSON.stringify({ order_status: newStatus }), req.user.id]
    });

    const updatedOrder = await getFullOrder(db, id);

    // Broadcast status change across all connected devices
    broadcastEvent('order:status_updated', updatedOrder);
    if (newStatus === 'ready') {
      broadcastEvent('order:ready', updatedOrder);
    }

    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/orders/:id/payments - Add a payment to existing order (cashier & admin only)
router.post('/:id/payments', authenticateToken, requireRole('admin', 'cashier', 'staff'), async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const method = req.body.method || req.body.payment_method;
    const { amount, reference } = req.body;

    if (!method || !amount) return res.status(400).json({ error: 'Method and amount required' });

    const existing = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Order not found' });
    const order = existing.rows[0];

    const amountInPaise = Math.round(Number(amount) * 100);

    const nowIso = new Date().toISOString();

    await db.execute({
      sql: `INSERT INTO payments (id, order_id, payment_method, amount, reference, payment_status, recorded_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)`,
      args: [uuidv4(), id, method, amountInPaise, reference || '', req.user.id, nowIso, nowIso]
    });

    // Update order totals
    const paymentsResult = await db.execute({ sql: `SELECT SUM(amount) as paid FROM payments WHERE order_id = ? AND payment_status = 'confirmed'`, args: [id] });
    const totalPaid = Number(paymentsResult.rows[0].paid || 0);
    const balanceDue = Math.max(0, Number(order.total) - totalPaid);

    let paymentStatus = 'pending';
    if (totalPaid >= Number(order.total) && Number(order.total) > 0) paymentStatus = 'paid';
    else if (totalPaid > 0) paymentStatus = 'partial';

    await db.execute({
      sql: `UPDATE orders SET total_paid=?, balance_due=?, payment_status=?, updated_at=? WHERE id=?`,
      args: [totalPaid, balanceDue, paymentStatus, nowIso, id]
    });

    const updatedOrder = await getFullOrder(db, id);
    broadcastEvent('order:updated', updatedOrder);
    res.json(updatedOrder);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders/:id/cancel
router.post('/:id/cancel', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    const { reason } = req.body;

    const existing = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Order not found' });

    await db.execute({
      sql: `UPDATE orders SET order_status='cancelled', updated_at=datetime('now') WHERE id=?`,
      args: [id]
    });

    await db.execute({
      sql: `INSERT INTO order_audit_logs (id, order_id, action, new_values, performed_by) VALUES (?, ?, 'cancelled', ?, ?)`,
      args: [uuidv4(), id, JSON.stringify({ reason }), req.user.id]
    });

    const order = await getFullOrder(db, id);
    broadcastEvent('order:status_updated', order);
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/orders/fresh-start - Reset order history and start daily numbering fresh from 001
router.post('/fresh-start', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can perform a fresh start' });
    }
    const { confirmation } = req.body;
    if (confirmation !== 'CONFIRM_FRESH_START') {
      return res.status(400).json({ error: 'Explicit confirmation code CONFIRM_FRESH_START required' });
    }

    const db = getDb();
    await db.execute(`DELETE FROM payments`);
    await db.execute(`DELETE FROM order_items`);
    await db.execute(`DELETE FROM order_audit_logs`);
    const ordersResult = await db.execute(`DELETE FROM orders`);
    await db.execute(`DELETE FROM daily_order_sequences`);

    broadcastEvent('orders:refreshed', { message: 'Fresh start: Order sequence reset to 001' });

    res.json({
      message: 'Orders and sequence cleared successfully. Fresh business day ready from #001.',
      orders_deleted: ordersResult.rowsAffected
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// POST /api/orders/clear-test-data - Authorized cleanup of demo/test orders
router.post('/clear-test-data', authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only administrators can clear demo/test orders' });
    }
    const { confirmation } = req.body;
    if (confirmation !== 'CONFIRM_CLEAR_DEMO_DATA') {
      return res.status(400).json({ error: 'Explicit confirmation code CONFIRM_CLEAR_DEMO_DATA required' });
    }

    const db = getDb();
    await db.execute(`DELETE FROM payments WHERE order_id IN (SELECT id FROM orders WHERE customer_name LIKE '%Test%' OR customer_name LIKE '%Demo%')`);
    await db.execute(`DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE customer_name LIKE '%Test%' OR customer_name LIKE '%Demo%')`);
    await db.execute(`DELETE FROM order_audit_logs WHERE order_id IN (SELECT id FROM orders WHERE customer_name LIKE '%Test%' OR customer_name LIKE '%Demo%')`);
    const result = await db.execute(`DELETE FROM orders WHERE customer_name LIKE '%Test%' OR customer_name LIKE '%Demo%'`);

    res.json({ message: 'Demo/test orders cleared safely', count: result.rowsAffected });
  } catch (err) {
    res.status(500).json({ error: 'Server error: ' + err.message });
  }
});

// GET /api/orders/:id/audit
router.get('/:id/audit', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const logs = await db.execute({
      sql: `SELECT l.*, u.full_name FROM order_audit_logs l LEFT JOIN users u ON l.performed_by = u.id WHERE l.order_id = ? ORDER BY l.created_at DESC`,
      args: [req.params.id]
    });
    res.json(logs.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

async function getFullOrder(db, id) {
  const orderResult = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  if (orderResult.rows.length === 0) return null;
  const order = orderResult.rows[0];
  const items = await db.execute({ sql: 'SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at', args: [id] });
  const payments = await db.execute({ sql: 'SELECT * FROM payments WHERE order_id = ? ORDER BY created_at', args: [id] });
  return { ...order, items: items.rows, payments: payments.rows };
}

export default router;
