import { Router } from 'express';
import pool from '../database';
import { requireAuth } from '../auth/middleware';

export const notificationsRouter = Router();

notificationsRouter.get('/', requireAuth, async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });

  const r = await pool.query(
    'SELECT id, type, message, appointment_id, is_read, created_at FROM notifications WHERE business_id = $1 ORDER BY created_at DESC LIMIT 50',
    [businessId],
  );
  return res.json({ ok: true, notifications: r.rows });
});

// Server-Sent Events stream: realtime cancelaciones, etc.
notificationsRouter.get('/stream', requireAuth, async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).end();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let lastSeen = new Date(Date.now() - 60_000).toISOString();
  const interval = setInterval(async () => {
    try {
      const r = await pool.query(
        'SELECT id, type, message, appointment_id, created_at FROM notifications WHERE business_id = $1 AND created_at > $2 ORDER BY created_at ASC LIMIT 50',
        [businessId, lastSeen],
      );
      for (const n of r.rows) {
        lastSeen = new Date(n.created_at).toISOString();
        res.write(`event: notification\n`);
        res.write(`data: ${JSON.stringify(n)}\n\n`);
      }
    } catch {
      // keep-alive errors are ignored; client reconnects
    }
  }, 2000);

  const keepAlive = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 25_000);

  req.on('close', () => {
    clearInterval(interval);
    clearInterval(keepAlive);
  });
});

