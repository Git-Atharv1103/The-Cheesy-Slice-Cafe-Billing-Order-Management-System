import { getDb } from './database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function performFreshStart() {
  const db = getDb();
  const dbPath = path.resolve(__dirname, '../../../data/cheesy_slice.db');
  const backupPath = path.resolve(__dirname, `../../../data/cheesy_slice_backup_${Date.now()}.db`);

  // 1. Create a safe backup before deleting anything
  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`🛡️ Safe database backup created at: ${backupPath}`);
  }

  // 2. Clear all orders and related records
  console.log('🧹 Clearing old orders, items, payments, and audit logs...');
  await db.execute('DELETE FROM payments');
  await db.execute('DELETE FROM order_items');
  await db.execute('DELETE FROM order_audit_logs');
  const ordersResult = await db.execute('DELETE FROM orders');
  
  // 3. Reset daily order sequence so the next order starts at 001
  await db.execute('DELETE FROM daily_order_sequences');

  console.log(`✅ Fresh start complete! Removed ${ordersResult.rowsAffected} old orders.`);
  console.log('✅ Daily order numbering sequence reset to 001.');
  console.log('✅ Menu, categories, cafe settings, and user accounts preserved intact.');

  return { ordersDeleted: ordersResult.rowsAffected, backupPath };
}

// If run directly: node src/db/fresh_start.js
if (process.argv[1] === __filename) {
  performFreshStart()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Fresh start error:', err);
      process.exit(1);
    });
}
