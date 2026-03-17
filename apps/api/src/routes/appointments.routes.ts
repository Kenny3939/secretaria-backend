import { Router } from 'express';
import { z } from 'zod';
import pool from '../database';
import { requireAuth, requireRole } from '../auth/middleware';

export const appointmentsRouter = Router();

appointmentsRouter.get('/', requireAuth, async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;
  if (!from || !to) return res.status(400).json({ ok: false, error: 'missing_range' });

  const r = await pool.query(
    `SELECT a.id, a.start_datetime, a.end_datetime, a.status,
            c.id as client_id, c.name as client_name, c.phone_number,
            s.id as service_id, s.name as service_name, s.duration_minutes
     FROM appointments a
     JOIN clients c ON a.client_id = c.id
     JOIN services s ON a.service_id = s.id
     WHERE a.business_id = $1 AND a.start_datetime >= $2 AND a.start_datetime < $3
     ORDER BY a.start_datetime ASC`,
    [businessId, from, to],
  );
  return res.json({ ok: true, appointments: r.rows });
});

const createSchema = z.object({
  clientId: z.string().uuid(),
  serviceId: z.string().uuid(),
  start: z.string().datetime(),
});

appointmentsRouter.post('/', requireAuth, requireRole(['superadmin', 'admin', 'asistente']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });
  const { clientId, serviceId, start } = parsed.data;

  const biz = await pool.query('SELECT capacity FROM businesses WHERE id = $1', [businessId]);
  const capacity = Number(biz.rows[0]?.capacity ?? 1);

  const settings = await pool.query('SELECT buffer_minutes FROM business_settings WHERE business_id = $1', [businessId]);
  const buffer = Number(settings.rows[0]?.buffer_minutes ?? 0);

  const srv = await pool.query('SELECT duration_minutes FROM services WHERE id = $1 AND business_id = $2', [serviceId, businessId]);
  const duration = Number(srv.rows[0]?.duration_minutes);
  if (!duration) return res.status(400).json({ ok: false, error: 'invalid_service' });

  const startDt = new Date(start);
  const endDt = new Date(startDt.getTime() + duration * 60_000);
  const startBuf = new Date(startDt.getTime() - buffer * 60_000);
  const endBuf = new Date(endDt.getTime() + buffer * 60_000);

  const overlap = await pool.query(
    `SELECT COUNT(*)::int as cnt
     FROM appointments
     WHERE business_id = $1
       AND status = 'scheduled'
       AND start_datetime < $3
       AND end_datetime > $2`,
    [businessId, startBuf.toISOString(), endBuf.toISOString()],
  );
  if ((overlap.rows[0]?.cnt ?? 0) >= capacity) return res.status(409).json({ ok: false, error: 'overlap' });

  const inserted = await pool.query(
    `INSERT INTO appointments (business_id, client_id, service_id, start_datetime, end_datetime, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING id, start_datetime, end_datetime, status`,
    [businessId, clientId, serviceId, startDt.toISOString(), endDt.toISOString()],
  );
  return res.status(201).json({ ok: true, appointment: inserted.rows[0] });
});

const statusSchema = z.object({
  status: z.enum(['scheduled', 'completed', 'no-show', 'cancelled']),
});

appointmentsRouter.patch('/:id/status', requireAuth, requireRole(['superadmin', 'admin', 'asistente']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });

  const r = await pool.query(
    `UPDATE appointments
     SET status = $3, updated_at = NOW()
     WHERE id = $1 AND business_id = $2
     RETURNING id, status`,
    [req.params.id, businessId, parsed.data.status],
  );
  if (!r.rows[0]) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, appointment: r.rows[0] });
});

const followUpSchema = z.object({
  start: z.string().datetime(),
});

appointmentsRouter.post('/:id/follow-up', requireAuth, requireRole(['superadmin', 'admin', 'asistente']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = followUpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });

  const orig = await pool.query(
    `SELECT client_id, service_id FROM appointments WHERE id = $1 AND business_id = $2 LIMIT 1`,
    [req.params.id, businessId],
  );
  const row = orig.rows[0];
  if (!row) return res.status(404).json({ ok: false, error: 'not_found' });

  // Reuse creation logic by inserting directly (overlap rules will be applied minimally here too).
  const createRes = await pool.query(
    `SELECT duration_minutes FROM services WHERE id = $1 AND business_id = $2 LIMIT 1`,
    [row.service_id, businessId],
  );
  const duration = Number(createRes.rows[0]?.duration_minutes ?? 0);
  if (!duration) return res.status(400).json({ ok: false, error: 'invalid_service' });

  const startDt = new Date(parsed.data.start);
  const endDt = new Date(startDt.getTime() + duration * 60_000);
  const inserted = await pool.query(
    `INSERT INTO appointments (business_id, client_id, service_id, start_datetime, end_datetime, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING id, start_datetime, end_datetime, status`,
    [businessId, row.client_id, row.service_id, startDt.toISOString(), endDt.toISOString()],
  );
  return res.status(201).json({ ok: true, appointment: inserted.rows[0] });
});

