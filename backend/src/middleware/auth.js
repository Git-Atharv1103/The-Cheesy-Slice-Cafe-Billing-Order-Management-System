import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cheesy-slice-secret-2024';

export function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    const rawRole = (req.user.role || '').toLowerCase().trim();
    // Normalize aliases: 'staff' is alias for 'cashier'
    const userRole = rawRole === 'staff' ? 'cashier' : rawRole;

    const allowed = roles.flatMap(r => {
      const lr = r.toLowerCase().trim();
      return (lr === 'cashier' || lr === 'staff') ? ['cashier', 'staff'] : [lr];
    });

    if (!allowed.includes(userRole) && !allowed.includes(rawRole)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

export function generateToken(user) {
  const role = (user.role || '').toLowerCase().trim();
  const normalizedRole = role === 'staff' ? 'cashier' : role;
  return jwt.sign(
    { id: user.id, username: user.username, role: normalizedRole, full_name: user.full_name },
    JWT_SECRET,
    { expiresIn: '12h' }
  );
}
