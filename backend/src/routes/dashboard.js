import express from 'express';
import { getDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/dashboard/summary?date=YYYY-MM-DD or ?date_from=&date_to=
router.get('/summary', authenticateToken, requireRole('admin', 'cashier', 'staff'), async (req, res) => {
  try {
    const { date, date_from, date_to } = req.query;
    const db = getDb();

    let dateFilter = '';
    const args = [];

    if (date) {
      dateFilter = 'AND o.order_date = ?';
      args.push(date);
    } else if (date_from && date_to) {
      dateFilter = 'AND o.order_date BETWEEN ? AND ?';
      args.push(date_from, date_to);
    } else {
      // Default: today IST
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      dateFilter = 'AND o.order_date = ?';
      args.push(today);
    }

    // Total orders (excluding cancelled)
    const totalsResult = await db.execute({
      sql: `SELECT 
        COUNT(*) as total_orders,
        SUM(CASE WHEN order_status != 'cancelled' THEN total ELSE 0 END) as total_sales,
        SUM(CASE WHEN order_status != 'cancelled' THEN discount ELSE 0 END) as total_discounts,
        SUM(CASE WHEN payment_status = 'paid' AND order_status != 'cancelled' THEN 1 ELSE 0 END) as paid_count,
        SUM(CASE WHEN payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
        SUM(CASE WHEN payment_status = 'pending' AND order_status != 'cancelled' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_count,
        SUM(CASE WHEN order_status != 'cancelled' THEN balance_due ELSE 0 END) as total_outstanding
        FROM orders o WHERE 1=1 ${dateFilter}`,
      args
    });

    // Payments by method
    const paymentsResult = await db.execute({
      sql: `SELECT p.payment_method, SUM(p.amount) as total
            FROM payments p
            JOIN orders o ON p.order_id = o.id
            WHERE p.payment_status = 'confirmed' AND o.order_status != 'cancelled'
            ${dateFilter}
            GROUP BY p.payment_method`,
      args
    });

    // Best selling items
    const bestsellers = await db.execute({
      sql: `SELECT oi.name, oi.category_name, SUM(oi.quantity) as qty_sold, SUM(oi.total_price) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.order_status != 'cancelled'
            ${dateFilter}
            GROUP BY oi.name
            ORDER BY qty_sold DESC
            LIMIT 10`,
      args
    });

    // Category sales
    const categorySales = await db.execute({
      sql: `SELECT oi.category_name, SUM(oi.quantity) as qty_sold, SUM(oi.total_price) as revenue
            FROM order_items oi
            JOIN orders o ON oi.order_id = o.id
            WHERE o.order_status != 'cancelled'
            ${dateFilter}
            GROUP BY oi.category_name
            ORDER BY revenue DESC`,
      args
    });

    // Daily orders (for chart)
    const dailyOrders = await db.execute({
      sql: `SELECT order_date, COUNT(*) as order_count, SUM(CASE WHEN order_status != 'cancelled' THEN total ELSE 0 END) as sales
            FROM orders
            WHERE 1=1 ${dateFilter.replace('o.', '')}
            GROUP BY order_date
            ORDER BY order_date`,
      args
    });

    const summary = totalsResult.rows[0];
    const paymentBreakdown = {};
    paymentsResult.rows.forEach(p => { paymentBreakdown[p.payment_method] = Number(p.total); });

    res.json({
      summary: {
        total_orders: Number(summary.total_orders),
        total_sales: Number(summary.total_sales || 0),
        total_discounts: Number(summary.total_discounts || 0),
        total_outstanding: Number(summary.total_outstanding || 0),
        paid_count: Number(summary.paid_count),
        partial_count: Number(summary.partial_count),
        pending_count: Number(summary.pending_count),
        cancelled_count: Number(summary.cancelled_count),
        online_collected: (paymentBreakdown.online || 0) + (paymentBreakdown.upi || 0),
        cash_collected: paymentBreakdown.cash || 0,
      },
      bestsellers: bestsellers.rows,
      category_sales: categorySales.rows,
      daily_orders: dailyOrders.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/dashboard/orders-table - for export
router.get('/orders-table', authenticateToken, requireRole('admin', 'cashier', 'staff'), async (req, res) => {
  try {
    const { date, date_from, date_to } = req.query;
    const db = getDb();

    let dateFilter = '';
    const args = [];
    if (date) { dateFilter = 'AND order_date = ?'; args.push(date); }
    else if (date_from && date_to) { dateFilter = 'AND order_date BETWEEN ? AND ?'; args.push(date_from, date_to); }

    const orders = await db.execute({
      sql: `SELECT * FROM orders WHERE 1=1 ${dateFilter} ORDER BY created_at DESC`,
      args
    });
    res.json(orders.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
