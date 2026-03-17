import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import pool from '../database';
import { signJwt } from '../auth/jwt';
import { requireAuth } from '../auth/middleware';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ ok: false, error: 'invalid_body' });

  const { email, password } = parsed.data;
  const r = await pool.query(
    'SELECT id, email, name, role, business_id, password_hash, is_active FROM users WHERE email = $1 LIMIT 1',
    [email.toLowerCase()],
  );
  const user = r.rows[0];
  if (!user || !user.is_active) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ ok: false, error: 'invalid_credentials' });

  const token = signJwt({
    sub: user.id,
    role: user.role,
    businessId: user.business_id ?? null,
  });

  const isProd = process.env.NODE_ENV === 'production';
  res.cookie('access_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, businessId: user.business_id } });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie('access_token', { path: '/' });
  return res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const userId = req.auth!.sub;
  const r = await pool.query('SELECT id, email, name, role, business_id FROM users WHERE id = $1 LIMIT 1', [userId]);
  const user = r.rows[0];
  if (!user) return res.status(401).json({ ok: false, error: 'unauthorized' });
  return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role, businessId: user.business_id } });
});

