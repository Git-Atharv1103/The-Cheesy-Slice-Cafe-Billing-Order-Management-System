import { app } from './app.js';
import { runSeed } from './db/seed.js';

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await runSeed();
    app.listen(PORT, () => {
      console.log(`🚀 The Cheesy Slice Backend running on http://localhost:${PORT}`);
      console.log(`📊 API available at http://localhost:${PORT}/api`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

if (!process.env.VERCEL) {
  start();
}

export default app;
