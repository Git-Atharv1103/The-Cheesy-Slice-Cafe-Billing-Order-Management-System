import express from 'express';
import { addClient } from '../services/events.js';

const router = express.Router();

// GET /api/events - SSE endpoint
router.get('/', (req, res) => {
  addClient(req, res);
});

export default router;
