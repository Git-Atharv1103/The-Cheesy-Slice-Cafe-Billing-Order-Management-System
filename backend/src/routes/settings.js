import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/database.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../../data/uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `qr_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

const router = express.Router();

// GET /api/settings - Public cafe settings (branding, name, upi)
router.get('/', async (req, res) => {
  try {
    const db = getDb();
    const result = await db.execute('SELECT * FROM cafe_settings WHERE id = 1');
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings
router.put('/', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { cafe_name, tagline, address, contact_number, upi_id, business_timezone, order_number_prefix, receipt_footer, logo_path, qr_code_path } = req.body;
    const db = getDb();
    await db.execute({
      sql: `UPDATE cafe_settings SET cafe_name=?, tagline=?, address=?, contact_number=?, upi_id=?, business_timezone=?, order_number_prefix=?, receipt_footer=?, logo_path=COALESCE(?, logo_path), qr_code_path=COALESCE(?, qr_code_path), updated_at=datetime('now') WHERE id=1`,
      args: [cafe_name, tagline, address, contact_number, upi_id, business_timezone, order_number_prefix, receipt_footer, logo_path !== undefined ? logo_path : null, qr_code_path !== undefined ? qr_code_path : null]
    });
    const result = await db.execute('SELECT * FROM cafe_settings WHERE id = 1');
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/upload-qr
router.post('/upload-qr', authenticateToken, requireRole('admin'), upload.single('qr_code'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/${req.file.filename}`;
    const db = getDb();
    await db.execute({ sql: `UPDATE cafe_settings SET qr_code_path=?, updated_at=datetime('now') WHERE id=1`, args: [filePath] });
    res.json({ qr_code_path: filePath });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/upload-logo
router.post('/upload-logo', authenticateToken, requireRole('admin'), upload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filePath = `/uploads/${req.file.filename}`;
    const db = getDb();
    await db.execute({ sql: `UPDATE cafe_settings SET logo_path=?, updated_at=datetime('now') WHERE id=1`, args: [filePath] });
    res.json({ logo_path: filePath });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/settings/users
router.get('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    const users = await db.execute('SELECT id, username, full_name, role, is_active, created_at FROM users ORDER BY created_at');
    res.json(users.rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/settings/users
router.post('/users', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { username, password, full_name, role } = req.body;
    if (!username || !password || !full_name || !role) return res.status(400).json({ error: 'All fields required' });
    const db = getDb();
    const exists = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
    if (exists.rows.length > 0) return res.status(400).json({ error: 'Username already exists' });
    const hash = await bcrypt.hash(password, 10);
    const id = uuidv4();
    await db.execute({
      sql: 'INSERT INTO users (id, username, password_hash, full_name, role) VALUES (?, ?, ?, ?, ?)',
      args: [id, username, hash, full_name, role]
    });
    res.status(201).json({ id, username, full_name, role, is_active: 1 });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings/users/:id
router.put('/users/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const { full_name, role, is_active, password } = req.body;
    const db = getDb();
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      await db.execute({
        sql: `UPDATE users SET full_name=?, role=?, is_active=?, password_hash=?, updated_at=datetime('now') WHERE id=?`,
        args: [full_name, role, is_active, hash, req.params.id]
      });
    } else {
      await db.execute({
        sql: `UPDATE users SET full_name=?, role=?, is_active=?, updated_at=datetime('now') WHERE id=?`,
        args: [full_name, role, is_active, req.params.id]
      });
    }
    res.json({ message: 'User updated' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/settings/users/:id
router.delete('/users/:id', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const db = getDb();
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete currently logged in administrator' });
    }
    await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [req.params.id] });
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

import { performFreshStart } from '../db/fresh_start.js';

// POST /api/settings/fresh-start - Reset order history and start fresh from order 001
router.post('/fresh-start', authenticateToken, requireRole('admin'), async (req, res) => {
  try {
    const result = await performFreshStart();
    res.json({ message: 'Order data cleared and order numbering reset to 001.', ...result });
  } catch (err) {
    console.error('Fresh start error:', err);
    res.status(500).json({ error: 'Failed to reset order data' });
  }
});

export default router;
