import { randomUUID } from 'crypto';

// Server-Sent Events (SSE) broadcaster for multi-device real-time sync
const clients = new Set();

export function addClient(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Initial connection ping
  res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Connected to Cheesy Slice Real-time Bus', timestamp: Date.now() })}\n\n`);

  clients.add(res);

  // Keep-alive heartbeat every 20 seconds
  const heartbeat = setInterval(() => {
    try {
      res.write(': keepalive\n\n');
    } catch (_) {
      clearInterval(heartbeat);
    }
  }, 20000);

  req.on('close', () => {
    clearInterval(heartbeat);
    clients.delete(res);
  });
}

export function broadcastEvent(eventType, payload = {}) {
  const enrichedPayload = {
    ...payload,
    _eventId: payload._eventId || randomUUID(),
    _timestamp: payload._timestamp || Date.now(),
  };
  const message = `event: ${eventType}\ndata: ${JSON.stringify(enrichedPayload)}\n\n`;
  for (const client of clients) {
    try {
      client.write(message);
    } catch (_) {
      clients.delete(client);
    }
  }
}

export function getClientCount() {
  return clients.size;
}

export default { addClient, broadcastEvent, getClientCount };
