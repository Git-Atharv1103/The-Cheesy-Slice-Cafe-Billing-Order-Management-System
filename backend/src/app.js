import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { runSeed } from './db/seed.js';

// Routes
import authRoutes from './routes/auth.js';
import menuRoutes from './routes/menu.js';
import ordersRoutes from './routes/orders.js';
import dashboardRoutes from './routes/dashboard.js';
import settingsRoutes from './routes/settings.js';
import eventsRoutes from './routes/events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const app = express();

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files (logos & QR codes)
const uploadsPath = path.join(__dirname, '../../data/uploads');
if (fs.existsSync(uploadsPath)) {
  app.use('/uploads', express.static(uploadsPath));
}

// Auto-seed guarantee on initial requests
let seedPromise = null;
app.use(async (req, res, next) => {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      console.error('Database auto-seed error:', err);
      seedPromise = null;
    });
  }
  await seedPromise;
  next();
});

// Routes - Mounted both with /api and without for proxy/serverless flexibility
app.use('/api/auth', authRoutes);
app.use('/auth', authRoutes);

app.use('/api/menu', menuRoutes);
app.use('/menu', menuRoutes);

app.use('/api/orders', ordersRoutes);
app.use('/orders', ordersRoutes);

app.use('/api/dashboard', dashboardRoutes);
app.use('/dashboard', dashboardRoutes);

app.use('/api/settings', settingsRoutes);
app.use('/settings', settingsRoutes);

app.use('/api/events', eventsRoutes);
app.use('/events', eventsRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Serve production frontend build if available
const frontendDist = path.join(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

export default app;
