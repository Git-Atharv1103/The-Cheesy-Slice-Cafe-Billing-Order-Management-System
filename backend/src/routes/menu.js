import express from 'express';
import { getDb } from '../db/database.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

// GET /api/menu - public
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const categories = await db.execute(
      'SELECT * FROM menu_categories WHERE is_active = 1 ORDER BY display_order ASC'
    );
    const items = await db.execute(
      'SELECT * FROM menu_items WHERE is_available = 1 ORDER BY display_order ASC'
    );

    const result = categories.rows.map(cat => ({
      ...cat,
      items: items.rows.filter(item => item.category_id === cat.id)
    }));

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/menu/all - admin view (all items including unavailable)
router.get('/all', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    const categories = await db.execute('SELECT * FROM menu_categories ORDER BY display_order ASC');
    const items = await db.execute('SELECT * FROM menu_items ORDER BY display_order ASC');

    const result = categories.rows.map(cat => ({
      ...cat,
      items: items.rows.filter(item => item.category_id === cat.id)
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/menu/categories
router.post('/categories', authenticateToken, async (req, res) => {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const { name, display_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Category name required' });
    const db = getDb();
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO menu_categories (id, name, display_order) VALUES (?, ?, ?)',
      args: [id, name, display_order || 0]
    });
    res.status(201).json({ id, name, display_order: display_order || 0 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/menu/categories/:id
router.put('/categories/:id', authenticateToken, async (req, res) => {
  try {
    const { name, display_order, is_active } = req.body;
    const db = getDb();
    await db.execute({
      sql: 'UPDATE menu_categories SET name = ?, display_order = ?, is_active = ?, updated_at = datetime(\'now\') WHERE id = ?',
      args: [name, display_order, is_active === undefined ? 1 : is_active, req.params.id]
    });
    res.json({ message: 'Category updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/menu/items
router.post('/items', authenticateToken, async (req, res) => {
  try {
    const { v4: uuidv4 } = await import('uuid');
    const { category_id, name, description, price, display_order } = req.body;
    if (!category_id || !name || price == null) {
      return res.status(400).json({ error: 'category_id, name, and price are required' });
    }
    const db = getDb();
    const id = uuidv4();
    // Price stored in paise
    const priceInPaise = Math.round(Number(price) * 100);
    await db.execute({
      sql: 'INSERT INTO menu_items (id, category_id, name, description, price, display_order) VALUES (?, ?, ?, ?, ?, ?)',
      args: [id, category_id, name, description || '', priceInPaise, display_order || 0]
    });
    res.status(201).json({ id, category_id, name, description, price: priceInPaise });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/menu/items/:id
router.put('/items/:id', authenticateToken, async (req, res) => {
  try {
    const { name, description, price, is_available, display_order, category_id } = req.body;
    const db = getDb();
    const priceInPaise = Math.round(Number(price) * 100);
    await db.execute({
      sql: `UPDATE menu_items SET name=?, description=?, price=?, is_available=?, display_order=?, category_id=?, updated_at=datetime('now') WHERE id=?`,
      args: [name, description || '', priceInPaise, is_available === undefined ? 1 : is_available, display_order || 0, category_id, req.params.id]
    });
    res.json({ message: 'Item updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/menu/items/:id
router.delete('/items/:id', authenticateToken, async (req, res) => {
  try {
    const db = getDb();
    await db.execute({ sql: 'UPDATE menu_items SET is_available = 0 WHERE id = ?', args: [req.params.id] });
    res.json({ message: 'Item hidden from menu' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
