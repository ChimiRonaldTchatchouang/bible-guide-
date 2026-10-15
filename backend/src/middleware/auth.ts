import type { NextFunction, Request, Response } from 'express';
import { verifyAccessToken, type AccessPayload, type Role } from '../lib/auth.js';
import { forbidden, unauthorized } from '../lib/errors.js';

declare global {
  namespace Express {
    interface Request {
      user?: AccessPayload;
    }
  }
}

function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Renseigne req.user si un jeton valide est présent, sans l'exiger. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (token) req.user = verifyAccessToken(token);
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readToken(req);
  if (!token) throw unauthorized();
  req.user = verifyAccessToken(token);
  next();
}

const RANK: Record<Role, number> = { user: 0, editor: 1, admin: 2 };

/** Exige un rôle minimum (editor < admin). */
export const requireRole = (min: Role) => (req: Request, res: Response, next: NextFunction) => {
  requireAuth(req, res, () => {
    if (RANK[req.user!.role] < RANK[min]) throw forbidden();
    next();
  });
};

export const userId = (req: Request) => {
  if (!req.user) throw unauthorized();
  return req.user.sub;
};
