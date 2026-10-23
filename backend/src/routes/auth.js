import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db/database.js';
import { generateToken } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }

    const db = getDb();
    const result = await db.execute({
      sql: 'SELECT * FROM users WHERE (LOWER(username) = LOWER(?) OR username = ?) AND is_active = 1',
      args: [username.trim(), username.trim()]
    });

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const rawRole = (user.role || '').toLowerCase().trim();
    const normalizedRole = rawRole === 'staff' ? 'cashier' : rawRole;
    const token = generateToken({ ...user, role: normalizedRole });
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: normalizedRole,
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/auth/change-password
import { authenticateToken } from '../middleware/auth.js';
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const db = getDb();
    const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [req.user.id] });
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user = result.rows[0];
    const valid = await bcrypt.compare(current_password, user.password_hash);
    if (!valid) return res.status(400).json({ error: 'Current password incorrect' });

    const hash = await bcrypt.hash(new_password, 10);
    await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [hash, req.user.id] });
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
