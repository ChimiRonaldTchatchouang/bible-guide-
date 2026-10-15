import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { refreshTokens, type User } from '../db/schema.js';
import { unauthorized } from './errors.js';

export type Role = User['role'];
export interface AccessPayload {
  sub: string;
  role: Role;
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  const payload: AccessPayload = { sub: user.id, role: user.role };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_TTL as SignOptions['expiresIn'] });
}

export function verifyAccessToken(token: string): AccessPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (typeof decoded === 'string' || !decoded.sub) throw new Error('payload');
    return { sub: decoded.sub, role: (decoded as AccessPayload).role };
  } catch {
    throw unauthorized('Jeton invalide ou expiré');
  }
}

const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');

/** Jeton de rafraîchissement opaque, stocké haché en base (rotation à chaque usage). */
export async function issueRefreshToken(userId: string): Promise<string> {
  const token = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86_400_000);
  await db.insert(refreshTokens).values({ userId, tokenHash: sha256(token), expiresAt });
  return token;
}

/** Consomme un jeton de rafraîchissement valide et renvoie l'id utilisateur. */
export async function consumeRefreshToken(token: string): Promise<string> {
  const [row] = await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(refreshTokens.tokenHash, sha256(token)),
        isNull(refreshTokens.revokedAt),
        gt(refreshTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: refreshTokens.userId });
  if (!row) throw unauthorized('Session expirée, reconnectez-vous');
  return row.userId;
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.tokenHash, sha256(token)));
}

export async function issueTokens(user: Pick<User, 'id' | 'role'>) {
  return {
    accessToken: signAccessToken(user),
    refreshToken: await issueRefreshToken(user.id),
    tokenType: 'Bearer' as const,
  };
}
