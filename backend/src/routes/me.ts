import { Router } from 'express';
import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { env } from '../config/env.js';
import { db } from '../db/client.js';
import { dayCompletions, favorites, notes, passageGroups, planEnrollments, readingPlans } from '../db/schema.js';
import { badRequest, notFound } from '../lib/errors.js';
import { parseReference, formatReference } from '../lib/reference.js';
import { requireAuth, userId } from '../middleware/auth.js';
import { parse } from '../middleware/validate.js';
import { getGroupSummaries } from '../services/groups.js';
import { getPlanBySlug, planDayFromStart, todayIn } from '../services/plans.js';

export const meRouter = Router();
meRouter.use(requireAuth);

async function planOr404(slug: string) {
  const plan = await getPlanBySlug(slug);
  if (!plan || !plan.published) throw notFound('Plan de lecture introuvable');
  return plan;
}

async function groupIdBySlug(slug: string) {
  const [g] = await db
    .select({ id: passageGroups.id })
    .from(passageGroups)
    .where(and(eq(passageGroups.slug, slug), eq(passageGroups.status, 'published')));
  if (!g) throw notFound('Groupe introuvable');
  return g.id;
}

/** Série de jours lus consécutifs se terminant aujourd'hui (ou hier si aujourd'hui n'est pas encore lu). */
export function computeStreak(completed: Set<number>, currentDay: number): number {
  let day = completed.has(currentDay) ? currentDay : currentDay - 1;
  let streak = 0;
  while (day >= 1 && completed.has(day)) {
    streak++;
    day--;
  }
  return streak;
}

async function progressFor(uid: string, plan: typeof readingPlans.$inferSelect, today: string) {
  const [enrollment] = await db
    .select()
    .from(planEnrollments)
    .where(and(eq(planEnrollments.userId, uid), eq(planEnrollments.planId, plan.id)));
  if (!enrollment) return null;
  const rows = await db
    .select({ dayNumber: dayCompletions.dayNumber, completedAt: dayCompletions.completedAt })
    .from(dayCompletions)
    .where(and(eq(dayCompletions.userId, uid), eq(dayCompletions.planId, plan.id)))
    .orderBy(asc(dayCompletions.dayNumber));
  const completed = new Set(rows.map((r) => r.dayNumber));
  const currentDay = planDayFromStart(enrollment.startDate, today, plan.totalDays);
  return {
    plan: { id: plan.id, slug: plan.slug, name: plan.name, totalDays: plan.totalDays },
    startDate: enrollment.startDate,
    currentDay,
    completedCount: completed.size,
    percent: Math.round((completed.size / plan.totalDays) * 1000) / 10,
    streak: computeStreak(completed, currentDay),
    missedDays: Array.from({ length: currentDay - 1 }, (_, i) => i + 1).filter((d) => !completed.has(d)),
    completedDays: rows,
  };
}

/* ─────────────── Plans de lecture ─────────────── */

meRouter.get('/plans', async (req, res) => {
  const uid = userId(req);
  const today = todayIn(env.APP_TIMEZONE);
  const enrolled = await db
    .select({ plan: readingPlans })
    .from(planEnrollments)
    .innerJoin(readingPlans, eq(readingPlans.id, planEnrollments.planId))
    .where(eq(planEnrollments.userId, uid));
  const progress = await Promise.all(enrolled.map((e) => progressFor(uid, e.plan, today)));
  res.json({ plans: progress.filter(Boolean).map((p) => ({ ...p!, completedDays: undefined, missedDays: p!.missedDays.length })) });
});

/** S'inscrire à un plan (ou le recommencer à une autre date). */
meRouter.put('/plans/:slug', async (req, res) => {
  const uid = userId(req);
  const plan = await planOr404(req.params.slug as string);
  const body = parse(
    z.object({ startDate: z.iso.date().optional(), resetProgress: z.boolean().optional() }),
    req.body ?? {},
  );
  const startDate = body.startDate ?? todayIn(env.APP_TIMEZONE);
  await db.transaction(async (tx) => {
    await tx
      .insert(planEnrollments)
      .values({ userId: uid, planId: plan.id, startDate })
      .onConflictDoUpdate({ target: [planEnrollments.userId, planEnrollments.planId], set: { startDate } });
    if (body.resetProgress) {
      await tx.delete(dayCompletions).where(and(eq(dayCompletions.userId, uid), eq(dayCompletions.planId, plan.id)));
    }
  });
  res.json({ progress: await progressFor(uid, plan, todayIn(env.APP_TIMEZONE)) });
});

meRouter.delete('/plans/:slug', async (req, res) => {
  const uid = userId(req);
  const plan = await planOr404(req.params.slug as string);
  await db.transaction(async (tx) => {
    await tx.delete(planEnrollments).where(and(eq(planEnrollments.userId, uid), eq(planEnrollments.planId, plan.id)));
    await tx.delete(dayCompletions).where(and(eq(dayCompletions.userId, uid), eq(dayCompletions.planId, plan.id)));
  });
  res.status(204).end();
});

meRouter.get('/plans/:slug/progress', async (req, res) => {
  const plan = await planOr404(req.params.slug as string);
  const { date } = parse(z.object({ date: z.iso.date().optional() }), req.query);
  const progress = await progressFor(userId(req), plan, date ?? todayIn(env.APP_TIMEZONE));
  if (!progress) throw notFound('Vous n’êtes pas inscrit à ce plan');
  res.json({ progress });
});

meRouter.put('/plans/:slug/days/:day', async (req, res) => {
  const uid = userId(req);
  const plan = await planOr404(req.params.slug as string);
  const dayNumber = parse(z.coerce.number().int().min(1).max(plan.totalDays), req.params.day);
  const [enrollment] = await db
    .select()
    .from(planEnrollments)
    .where(and(eq(planEnrollments.userId, uid), eq(planEnrollments.planId, plan.id)));
  if (!enrollment) throw badRequest('Inscrivez-vous d’abord au plan');
  await db.insert(dayCompletions).values({ userId: uid, planId: plan.id, dayNumber }).onConflictDoNothing();
  res.json({ progress: await progressFor(uid, plan, todayIn(env.APP_TIMEZONE)) });
});

meRouter.delete('/plans/:slug/days/:day', async (req, res) => {
  const uid = userId(req);
  const plan = await planOr404(req.params.slug as string);
  const dayNumber = parse(z.coerce.number().int().min(1).max(plan.totalDays), req.params.day);
  await db
    .delete(dayCompletions)
    .where(and(eq(dayCompletions.userId, uid), eq(dayCompletions.planId, plan.id), eq(dayCompletions.dayNumber, dayNumber)));
  res.json({ progress: await progressFor(uid, plan, todayIn(env.APP_TIMEZONE)) });
});

/* ─────────────── Favoris ─────────────── */

meRouter.get('/favorites', async (req, res) => {
  const rows = await db
    .select({ groupId: favorites.groupId, createdAt: favorites.createdAt })
    .from(favorites)
    .innerJoin(passageGroups, eq(passageGroups.id, favorites.groupId))
    .where(and(eq(favorites.userId, userId(req)), eq(passageGroups.status, 'published')))
    .orderBy(desc(favorites.createdAt));
  const summaries = await getGroupSummaries(rows.map((r) => r.groupId));
  res.json({ favorites: summaries.map((g, i) => ({ group: g, addedAt: rows[i]!.createdAt })) });
});

meRouter.put('/favorites/:groupSlug', async (req, res) => {
  const groupId = await groupIdBySlug(req.params.groupSlug as string);
  await db.insert(favorites).values({ userId: userId(req), groupId }).onConflictDoNothing();
  res.status(204).end();
});

meRouter.delete('/favorites/:groupSlug', async (req, res) => {
  const groupId = await groupIdBySlug(req.params.groupSlug as string);
  await db.delete(favorites).where(and(eq(favorites.userId, userId(req)), eq(favorites.groupId, groupId)));
  res.status(204).end();
});

/* ─────────────── Notes personnelles ─────────────── */

const noteBody = z.object({
  content: z.string().trim().min(1).max(10_000),
  groupSlug: z.string().optional(),
  reference: z.string().trim().max(60).optional(),
});

async function normalizeNoteInput(body: Partial<z.infer<typeof noteBody>>) {
  const out: { groupId?: number | null; reference?: string | null; content?: string } = {};
  if (body.content !== undefined) out.content = body.content;
  if (body.groupSlug !== undefined) out.groupId = body.groupSlug ? await groupIdBySlug(body.groupSlug) : null;
  if (body.reference !== undefined) {
    try {
      out.reference = body.reference ? formatReference(parseReference(body.reference)) : null;
    } catch (e) {
      throw badRequest((e as Error).message);
    }
  }
  return out;
}

const noteDto = (n: typeof notes.$inferSelect, groupSlug: string | null) => ({
  id: n.id,
  content: n.content,
  reference: n.reference,
  groupSlug,
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

meRouter.get('/notes', async (req, res) => {
  const { groupSlug } = parse(z.object({ groupSlug: z.string().optional() }), req.query);
  const filters = [eq(notes.userId, userId(req))];
  if (groupSlug) filters.push(eq(passageGroups.slug, groupSlug));
  const rows = await db
    .select({ note: notes, groupSlug: passageGroups.slug })
    .from(notes)
    .leftJoin(passageGroups, eq(passageGroups.id, notes.groupId))
    .where(and(...filters))
    .orderBy(desc(notes.updatedAt));
  res.json({ notes: rows.map((r) => noteDto(r.note, r.groupSlug)) });
});

meRouter.post('/notes', async (req, res) => {
  const body = parse(noteBody, req.body);
  const input = await normalizeNoteInput(body);
  const [note] = await db
    .insert(notes)
    .values({ userId: userId(req), content: input.content!, groupId: input.groupId ?? null, reference: input.reference ?? null })
    .returning();
  res.status(201).json({ note: noteDto(note!, body.groupSlug ?? null) });
});

meRouter.patch('/notes/:id', async (req, res) => {
  const id = parse(z.uuid(), req.params.id);
  const input = await normalizeNoteInput(parse(noteBody.partial(), req.body));
  const [note] = await db
    .update(notes)
    .set(input)
    .where(and(eq(notes.id, id), eq(notes.userId, userId(req))))
    .returning();
  if (!note) throw notFound('Note introuvable');
  const [g] = note.groupId
    ? await db.select({ slug: passageGroups.slug }).from(passageGroups).where(eq(passageGroups.id, note.groupId))
    : [];
  res.json({ note: noteDto(note, g?.slug ?? null) });
});

meRouter.delete('/notes/:id', async (req, res) => {
  const id = parse(z.uuid(), req.params.id);
  const [deleted] = await db
    .delete(notes)
    .where(and(eq(notes.id, id), eq(notes.userId, userId(req))))
    .returning({ id: notes.id });
  if (!deleted) throw notFound('Note introuvable');
  res.status(204).end();
});
