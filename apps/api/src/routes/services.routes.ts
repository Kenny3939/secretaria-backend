import { Router } from 'express';
import { z } from 'zod';
import pool from '../database';
import { requireAuth, requireRole } from '../auth/middleware';

export const servicesRouter = Router();

servicesRouter.get('/', requireAuth, async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const r = await pool.query('SELECT id, name, price, duration_minutes, is_active FROM services WHERE business_id = $1 ORDER BY name ASC', [businessId]);
  return res.json({ ok: true, services: r.rows });
});

const createSchema = z.object({
  name: z.string().min(1),
  price: z.number().nonnegative().default(0),
  durationMinutes: z.number().int().positive().default(30),
});

servicesRouter.post('/', requireAuth, requireRole(['superadmin', 'admin']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });
  const { name, price, durationMinutes } = parsed.data;
  const r = await pool.query(
    'INSERT INTO services (business_id, name, price, duration_minutes) VALUES ($1, $2, $3, $4) RETURNING id, name, price, duration_minutes, is_active',
    [businessId, name, price, durationMinutes],
  );
  return res.status(201).json({ ok: true, service: r.rows[0] });
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  price: z.number().nonnegative().optional(),
  durationMinutes: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
});

servicesRouter.patch('/:id', requireAuth, requireRole(['superadmin', 'admin']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });
  const id = req.params.id;
  const current = await pool.query('SELECT id FROM services WHERE id = $1 AND business_id = $2', [id, businessId]);
  if (!current.rows[0]) return res.status(404).json({ ok: false, error: 'not_found' });

  const { name, price, durationMinutes, isActive } = parsed.data;
  const r = await pool.query(
    `UPDATE services
     SET name = COALESCE($3, name),
         price = COALESCE($4, price),
         duration_minutes = COALESCE($5, duration_minutes),
         is_active = COALESCE($6, is_active),
         updated_at = NOW()
     WHERE id = $1 AND business_id = $2
     RETURNING id, name, price, duration_minutes, is_active`,
    [id, businessId, name ?? null, price ?? null, durationMinutes ?? null, isActive ?? null],
  );
  return res.json({ ok: true, service: r.rows[0] });
});

