import { Router } from 'express';
import { z } from 'zod';
import pool from '../database';
import { requireAuth, requireRole } from '../auth/middleware';

export const clientsRouter = Router();

clientsRouter.get('/', requireAuth, async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const q = (req.query.q as string | undefined)?.trim();

  const r = await pool.query(
    q
      ? `SELECT id, name, phone_number, tag, internal_notes, created_at
         FROM clients
         WHERE business_id = $1 AND (LOWER(COALESCE(name,'')) LIKE $2 OR phone_number LIKE $2)
         ORDER BY created_at DESC LIMIT 100`
      : `SELECT id, name, phone_number, tag, internal_notes, created_at
         FROM clients
         WHERE business_id = $1
         ORDER BY created_at DESC LIMIT 100`,
    q ? [businessId, `%${q.toLowerCase()}%`] : [businessId],
  );
  return res.json({ ok: true, clients: r.rows });
});

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  tag: z.enum(['Nuevo', 'Frecuente', 'VIP', 'Pendiente']).nullable().optional(),
  internalNotes: z.string().max(5000).nullable().optional(),
});

clientsRouter.patch('/:id', requireAuth, requireRole(['superadmin', 'admin', 'asistente']), async (req, res) => {
  const businessId = req.auth!.businessId;
  if (!businessId) return res.status(400).json({ ok: false, error: 'missing_business' });
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });

  const { name, tag, internalNotes } = parsed.data;
  const r = await pool.query(
    `UPDATE clients
     SET name = COALESCE($3, name),
         tag = COALESCE($4, tag),
         internal_notes = COALESCE($5, internal_notes)
     WHERE id = $1 AND business_id = $2
     RETURNING id, name, phone_number, tag, internal_notes, created_at`,
    [req.params.id, businessId, name ?? null, tag ?? null, internalNotes ?? null],
  );
  if (!r.rows[0]) return res.status(404).json({ ok: false, error: 'not_found' });
  return res.json({ ok: true, client: r.rows[0] });
});

