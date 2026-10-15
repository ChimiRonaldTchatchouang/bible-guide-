import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { refreshTokens, users, type User } from '../db/schema.js';
import {
  consumeRefreshToken,
  hashPassword,
  issueTokens,
  revokeRefreshToken,
  verifyPassword,
} from '../lib/auth.js';
import { conflict, notFound, unauthorized } from '../lib/errors.js';
import { optionalAuth, requireAuth, userId } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';

export const authRouter = Router();

const limiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.NODE_ENV === 'test' ? 10_000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'too_many_requests', message: 'Trop de tentatives, réessayez plus tard' } },
});

const email = z.string().trim().toLowerCase().pipe(z.email('Adresse e-mail invalide')).pipe(z.string().max(254));
const password = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(128);

export const publicUser = (u: User) => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  createdAt: u.createdAt,
});

authRouter.post('/register', limiter, async (req, res) => {
  const body = parse(
    z.object({ email, password, displayName: z.string().trim().min(1).max(100).optional() }),
    req.body,
  );
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, body.email));
  if (existing) throw conflict('Un compte existe déjà avec cette adresse');
  const [user] = await db
    .insert(users)
    .values({ email: body.email, passwordHash: await hashPassword(body.password), displayName: body.displayName })
    .returning();
  res.status(201).json({ user: publicUser(user!), ...(await issueTokens(user!)) });
});

authRouter.post('/login', limiter, async (req, res) => {
  const body = parse(z.object({ email, password: z.string().min(1) }), req.body);
  const [user] = await db.select().from(users).where(eq(users.email, body.email));
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    throw unauthorized('E-mail ou mot de passe incorrect');
  }
  res.json({ user: publicUser(user), ...(await issueTokens(user)) });
});

authRouter.post('/refresh', limiter, async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string().min(10) }), req.body);
  const id = await consumeRefreshToken(refreshToken);
  const [user] = await db.select().from(users).where(eq(users.id, id));
  if (!user) throw unauthorized();
  res.json({ user: publicUser(user), ...(await issueTokens(user)) });
});

authRouter.post('/logout', optionalAuth, async (req, res) => {
  const { refreshToken, allDevices } = parse(
    z.object({ refreshToken: z.string().optional(), allDevices: z.boolean().optional() }),
    req.body ?? {},
  );
  if (refreshToken) await revokeRefreshToken(refreshToken);
  if (allDevices) {
    // Déconnexion de tous les appareils : nécessite un jeton d'accès valide.
    await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.userId, userId(req)));
  }
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const [user] = await db.select().from(users).where(eq(users.id, userId(req)));
  if (!user) throw notFound('Utilisateur introuvable');
  res.json({ user: publicUser(user) });
});

authRouter.patch('/me', requireAuth, async (req, res) => {
  const body = parse(
    z
      .object({
        displayName: z.string().trim().min(1).max(100).optional(),
        currentPassword: z.string().optional(),
        newPassword: password.optional(),
      })
      .refine((b) => !b.newPassword || b.currentPassword, {
        message: 'currentPassword est requis pour changer de mot de passe',
        path: ['currentPassword'],
      }),
    req.body,
  );
  const [user] = await db.select().from(users).where(eq(users.id, userId(req)));
  if (!user) throw notFound('Utilisateur introuvable');
  const patch: Partial<typeof users.$inferInsert> = {};
  if (body.displayName !== undefined) patch.displayName = body.displayName;
  if (body.newPassword) {
    if (!(await verifyPassword(body.currentPassword!, user.passwordHash))) throw unauthorized('Mot de passe actuel incorrect');
    patch.passwordHash = await hashPassword(body.newPassword);
  }
  const [updated] = Object.keys(patch).length
    ? await db.update(users).set(patch).where(eq(users.id, user.id)).returning()
    : [user];
  res.json({ user: publicUser(updated!) });
});

authRouter.delete('/me', requireAuth, async (req, res) => {
  const { password: pwd } = parse(z.object({ password: z.string().min(1) }), req.body);
  const [user] = await db.select().from(users).where(eq(users.id, userId(req)));
  if (!user || !(await verifyPassword(pwd, user.passwordHash))) throw unauthorized('Mot de passe incorrect');
  await db.delete(users).where(eq(users.id, user.id));
  res.status(204).end();
});
