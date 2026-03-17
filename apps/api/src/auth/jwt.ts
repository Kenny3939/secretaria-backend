import jwt from 'jsonwebtoken';

export type JwtPayload = {
  sub: string; // user id
  role: 'superadmin' | 'admin' | 'asistente';
  businessId: string | null;
};

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('Falta JWT_SECRET en variables de entorno.');
  return secret;
}

export function signJwt(payload: JwtPayload) {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyJwt(token: string): JwtPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  return decoded as JwtPayload;
}

