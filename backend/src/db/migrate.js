import { getDb } from './database.js';

export async function runMigrations() {
  const db = getDb();

  // Execute each CREATE TABLE as a batch
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS cafe_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      cafe_name TEXT NOT NULL DEFAULT 'The Cheesy Slice',
      tagline TEXT DEFAULT 'Loaded with Love & Cheese!',
      address TEXT DEFAULT 'FC Road, Pune, Maharashtra, India',
      contact_number TEXT DEFAULT '',
      upi_id TEXT DEFAULT '',
      qr_code_path TEXT DEFAULT '',
      business_timezone TEXT DEFAULT 'Asia/Kolkata',
      order_number_prefix TEXT DEFAULT '',
      receipt_footer TEXT DEFAULT 'Thank you for visiting The Cheesy Slice!',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    INSERT OR IGNORE INTO cafe_settings (id) VALUES (1);

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      display_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INTEGER NOT NULL,
      image_path TEXT DEFAULT '',
      is_available INTEGER DEFAULT 1,
      display_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS daily_order_sequences (
      date TEXT PRIMARY KEY,
      last_sequence INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      daily_order_number TEXT NOT NULL,
      order_date TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      special_instructions TEXT DEFAULT '',
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      total_paid INTEGER NOT NULL DEFAULT 0,
      balance_due INTEGER NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      order_status TEXT NOT NULL DEFAULT 'preparing',
      created_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      menu_item_id TEXT,
      name TEXT NOT NULL,
      category_name TEXT NOT NULL DEFAULT '',
      unit_price INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      total_price INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      ready_at TEXT DEFAULT NULL,
      served_at TEXT DEFAULT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      amount INTEGER NOT NULL,
      reference TEXT DEFAULT '',
      payment_status TEXT NOT NULL DEFAULT 'confirmed',
      recorded_by TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_audit_logs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_values TEXT DEFAULT '{}',
      new_values TEXT DEFAULT '{}',
      performed_by TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(payment_status, order_status);
    CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_orders_daily_num ON orders(daily_order_number);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_name);
    CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_order_items_status ON order_items(status);
    CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
    CREATE INDEX IF NOT EXISTS idx_menu_items_category ON menu_items(category_id);
    CREATE INDEX IF NOT EXISTS idx_menu_items_avail ON menu_items(is_available, display_order);
  `);

  try {
    await db.execute("ALTER TABLE cafe_settings ADD COLUMN logo_path TEXT DEFAULT ''");
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE order_items ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'");
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE order_items ADD COLUMN ready_at TEXT DEFAULT NULL");
  } catch (_) {
    // Column already exists
  }

  try {
    await db.execute("ALTER TABLE order_items ADD COLUMN served_at TEXT DEFAULT NULL");
  } catch (_) {
    // Column already exists
  }

  console.log('✅ Database migrations complete.');
}
