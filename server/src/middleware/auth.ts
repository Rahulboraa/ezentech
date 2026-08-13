import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env.js';
import type { Role } from '../models/User.js';

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

declare module 'express-serve-static-core' {
  interface Request {
    user: AuthUser;
  }
}

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, { expiresIn: '12h' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as AuthUser & { iat: number; exp: number };
    req.user = { id: payload.id, name: payload.name, role: payload.role };
    // sliding session — a shift never gets logged out mid-scan
    res.setHeader('x-refresh-token', signToken(req.user));
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.user.role !== 'admin' && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Your role cannot perform this action' });
    }
    next();
  };
}
