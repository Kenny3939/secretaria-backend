import type { NextFunction, Request, Response } from 'express';
import { verifyJwt, type JwtPayload } from './jwt';

declare global {
  namespace Express {
    interface Request {
      auth?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.access_token;
  if (!token) return res.status(401).json({ ok: false, error: 'unauthorized' });
  try {
    req.auth = verifyJwt(token);
    return next();
  } catch {
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }
}

export function requireRole(roles: JwtPayload['role'][]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) return res.status(401).json({ ok: false, error: 'unauthorized' });
    if (!roles.includes(req.auth.role)) return res.status(403).json({ ok: false, error: 'forbidden' });
    return next();
  };
}

