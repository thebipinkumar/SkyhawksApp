import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'skyhawks-secret-key-2024';

export interface AuthRequest extends Request {
  user?: { id: number; email: string; roles: string[]; name: string };
}

export function authenticate(req: AuthRequest, res: Response, next: NextFunction) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) { res.status(401).json({ error: 'Authentication required' }); return; }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // Support both old tokens (role: string) and new tokens (roles: string[])
    req.user = {
      id: payload.id,
      email: payload.email,
      name: payload.name,
      roles: Array.isArray(payload.roles) ? payload.roles : [payload.role].filter(Boolean),
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function authorize(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.roles.some(r => roles.includes(r))) {
      res.status(403).json({ error: 'Insufficient permissions' }); return;
    }
    next();
  };
}

export function signToken(payload: { id: number; email: string; roles: string[]; name: string }) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
}
