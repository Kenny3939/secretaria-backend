import { Router } from 'express';
import { z } from 'zod';
import pool from '../database';
import { requireAuth, requireRole } from '../auth/middleware';

export const settingsRouter = Router();

settingsRouter.get('/', requireAuth, async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });

  const biz = await pool.query('SELECT id, name, open_time, close_time, capacity FROM businesses WHERE id = $1', [businessId]);
  const settings = await pool.query('SELECT buffer_minutes, off_hours_message FROM business_settings WHERE business_id = $1', [businessId]);

  return res.json({ ok: true, business: biz.rows[0], settings: settings.rows[0] });
});

const patchSchema = z.object({
  openTime: z.string().regex(/^\d{2}:\d{2}/).optional(),
  closeTime: z.string().regex(/^\d{2}:\d{2}/).optional(),
  capacity: z.number().int().positive().optional(),
  bufferMinutes: z.number().int().min(0).max(240).optional(),
  offHoursMessage: z.string().max(2000).nullable().optional(),
});

settingsRouter.patch('/', requireAuth, requireRole(['superadmin', 'admin']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });

  const { openTime, closeTime, capacity, bufferMinutes, offHoursMessage } = parsed.data;
  await pool.query(
    `UPDATE businesses
     SET open_time = COALESCE($2, open_time),
         close_time = COALESCE($3, close_time),
         capacity = COALESCE($4, capacity)
     WHERE id = $1`,
    [businessId, openTime ?? null, closeTime ?? null, capacity ?? null],
  );

  await pool.query(
    `INSERT INTO business_settings (business_id, buffer_minutes, off_hours_message)
     VALUES ($1, COALESCE($2, 0), $3)
     ON CONFLICT (business_id) DO UPDATE SET
       buffer_minutes = COALESCE($2, business_settings.buffer_minutes),
       off_hours_message = COALESCE($3, business_settings.off_hours_message),
       updated_at = NOW()`,
    [businessId, bufferMinutes ?? null, offHoursMessage ?? null],
  );

  return res.json({ ok: true });
});

