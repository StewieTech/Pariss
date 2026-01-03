import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export type AuthRequest = Request & { userId?: string };

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  const token = m?.[1];
  if (!token) return res.status(401).json({ error: 'missing bearer token' });

  const secret = process.env.JWT_SECRET;
  if (!secret) return res.status(500).json({ error: 'JWT_SECRET is not set' });

  try {
    const payload = jwt.verify(token, secret) as any;
    req.userId = String(payload?.sub || payload?.userId || '').trim();
    if (!req.userId) return res.status(401).json({ error: 'invalid token' });
    return next();
  } catch (e: any) {
    return res.status(401).json({ error: 'invalid token', details: String(e?.message || e) });
  }
}
