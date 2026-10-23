import { getDb } from './database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrate.js';

const MENU_DATA = [
  {
    category: 'Cold Coffee', order: 0,
    items: [
      { name: 'Regular Cold Coffee', price: 6000 },
      { name: 'Strong Cold Coffee', price: 7000 },
    ]
  },
  {
    category: 'Hot Coffee', order: 1,
    items: [
      { name: 'Black Coffee', price: 3000 },
      { name: 'Regular Hot Coffee', price: 4000 },
      { name: 'Strong Hot Coffee', price: 5000 },
    ]
  },
  {
    category: 'Mojitos and Beverages', order: 2,
    items: [
      { name: 'Virgin Mojito', price: 9000 },
      { name: 'Blue Curacao Mojito', price: 9000 },
      { name: 'Pink Goa Blast Mojito', price: 9000 },
      { name: 'Kala Khatta Mojito', price: 9000 },
      { name: 'Jeera Masala Mojito', price: 9000 },
      { name: 'Lemon Ice Tea', price: 8000 },
      { name: 'Peach Ice Tea', price: 8000 },
      { name: 'Fresh Lime Soda', price: 7000 },
    ]
  },
  {
    category: 'Pasta', order: 3,
    items: [
      { name: 'Cheesy White Sauce Pasta', price: 18000 },
      { name: 'Red Sauce Pasta', price: 18000 },
      { name: 'Mix Pasta', price: 18000 },
      { name: 'Mexican Pasta', price: 18000 },
    ]
  },
  {
    category: 'Sandwich', order: 4,
    items: [
      { name: 'Veg Club Sandwich', price: 8000 },
      { name: 'Veg Grill Cheese Sandwich', price: 10000 },
      { name: 'Cheesy Bombay Masala Sandwich', price: 12000 },
      { name: 'Cheesy Corn Mayo Sandwich', price: 11000 },
      { name: 'Schezwan Sandwich', price: 12000 },
      { name: 'Aloo Masala Sandwich', price: 10000 },
      { name: 'Tandoori Paneer Sandwich', price: 12000 },
      { name: 'Peri Peri Paneer Sandwich', price: 12000 },
      { name: 'Chocolate Sandwich', price: 12000 },
    ]
  },
  {
    category: 'Pizza', order: 5,
    items: [
      { name: 'Margherita Pizza', price: 14000 },
      { name: 'Classic Pizza', price: 16000 },
      { name: 'Corn Cheese Pizza', price: 16000 },
      { name: 'Paneer Tikka Pizza', price: 19000 },
      { name: 'Exotic Pizza', price: 20000 },
      { name: 'Schezwan Mushroom Pizza', price: 19000 },
      { name: 'Peri Peri Paneer Pizza', price: 20000 },
      { name: 'Tandoori Veggie Pizza', price: 19000 },
      { name: 'Cheesy Tandoori Paneer Pizza', price: 20000 },
    ]
  },
  {
    category: 'Garlic Bread', order: 6,
    items: [
      { name: 'Garlic Bread', price: 8000 },
      { name: 'Garlic Bread with Cheese', price: 11000 },
      { name: 'Garlic Bread with Cheese & Chilli', price: 12000 },
      { name: 'Garlic Bread with Cheese & Olive', price: 12000 },
    ]
  },
  {
    category: 'Nachos', order: 7,
    items: [
      { name: 'Nachos with Salsa', price: 9000 },
      { name: 'Loaded Nachos with Salsa & Cheese', price: 15000 },
    ]
  },
  {
    category: 'Extra Cheese and Add-ons', order: 8,
    items: [
      { name: 'Extra Cheese', price: 3000 },
      { name: 'Extra Paneer', price: 3000 },
      { name: 'Extra Mushroom', price: 3000 },
    ]
  },
];

export async function runSeed() {
  await runMigrations();
  const db = getDb();

  // Seed users idempotently
  const adminHash = await bcrypt.hash('admin123', 10);
  await db.execute({
    sql: 'INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    args: [uuidv4(), 'admin', adminHash, 'Admin Owner', 'admin']
  });

  const staffHash = await bcrypt.hash('staff123', 10);
  await db.execute({
    sql: 'INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    args: [uuidv4(), 'staff', staffHash, 'Staff Member', 'cashier']
  });

  const cashierEmailHash = await bcrypt.hash('cashier123', 10);
  await db.execute({
    sql: 'INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    args: [uuidv4(), 'cashier@thecheesyslice.local', cashierEmailHash, 'Main Cashier', 'cashier']
  });

  const kitchenHash = await bcrypt.hash('kitchen123', 10);
  await db.execute({
    sql: 'INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    args: [uuidv4(), 'kitchen', kitchenHash, 'Kitchen Staff', 'kitchen']
  });

  const kitchenEmailHash = await bcrypt.hash('kitchen123', 10);
  await db.execute({
    sql: 'INSERT OR IGNORE INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
    args: [uuidv4(), 'kitchen@thecheesyslice.local', kitchenEmailHash, 'Kitchen Head Chef', 'kitchen']
  });

  console.log('✅ Seed users verified: admin, staff, cashier@thecheesyslice.local, kitchen, kitchen@thecheesyslice.local');

  // Seed menu
  const existingCats = await db.execute('SELECT COUNT(*) as cnt FROM menu_categories');
  if (Number(existingCats.rows[0].cnt) === 0) {
    for (const cat of MENU_DATA) {
      const catId = uuidv4();
      await db.execute({
        sql: 'INSERT INTO menu_categories (id, name, display_order) VALUES (?, ?, ?)',
        args: [catId, cat.category, cat.order]
      });
      for (let i = 0; i < cat.items.length; i++) {
        const item = cat.items[i];
        await db.execute({
          sql: 'INSERT INTO menu_items (id, category_id, name, price, display_order) VALUES (?, ?, ?, ?, ?)',
          args: [uuidv4(), catId, item.name, item.price, i]
        });
      }
    }
    console.log('✅ Menu data seeded.');
  }

  console.log('✅ Seed complete.');
}

runSeed().catch(console.error);
